import { authenticate, authorizeRole } from '../hooks/authenticate.js';
import { createCaseBodySchema, updateCaseBodySchema, caseQuerySchema }
  from '../schemas/case.schema.js';
import { getAllCases, getCaseById, createCase, updateCase, getCaseStats }
  from '../services/case.service.js';
import { sendError, sendSuccess } from '../utils/errors.js';
import { mkdirSync, existsSync, createWriteStream, createReadStream } from 'fs';
import { pipeline }   from 'stream/promises';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { Case }          from '../models/index.js';
import { summarizeCasePdf } from '../services/caseSummary.service.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = join(__dirname, '..', '..', 'uploads');
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

export default async function casesRoutes(fastify) {

  // GET /api/cases/stats — lawyer only (must be before /:id)
  fastify.get('/stats', {
    preHandler: [authenticate, authorizeRole('lawyer')],
  }, async (request, reply) => {
    try {
      return sendSuccess(reply, { data: await getCaseStats() });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  // GET /api/cases
  fastify.get('/', {
    preHandler: [authenticate],
    schema:     { querystring: caseQuerySchema },
  }, async (request, reply) => {
    try {
      return sendSuccess(reply, { data: await getAllCases(request.currentUser, request.query) });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  // GET /api/cases/test-email
  fastify.get('/test-email', async (request, reply) => {
    try {
      const { sendHearingNotification } = await import("../services/mail.service.js");
      const result = await sendHearingNotification({
        to:          process.env.MAIL_USER || 'keshav.qualwebs@gmail.com',
        clientName:  "System Admin",
        caseTitle:   "Production SMTP Test",
        caseId:      "TEST-999",
        hearingDate: "2024-12-31"
      });
      return sendSuccess(reply, { data: result });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  // POST /api/cases — client only
  fastify.post('/', {
    preHandler: [authenticate, authorizeRole('client')],
    schema:     { body: createCaseBodySchema },
  }, async (request, reply) => {
    try {
      const newCase = await createCase(request.body, request.currentUser);
      return sendSuccess(reply, { data: { case: newCase } }, 201);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  // GET /api/cases/:id
  fastify.get('/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const caseData = await getCaseById(request.params.id, request.currentUser);
      return sendSuccess(reply, { data: { case: caseData } });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  // PATCH /api/cases/:id — lawyer only
  fastify.patch('/:id', {
    preHandler: [authenticate, authorizeRole('lawyer')],
    schema:     { body: updateCaseBodySchema },
  }, async (request, reply) => {
    try {
      const updated = await updateCase(request.params.id, request.body, request.currentUser);
      return sendSuccess(reply, { data: { case: updated } });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  // ── POST /api/cases/:id/documents — FIXED ─────────────────
  // Both client and lawyer can upload.
  // FIX: directly uses Case.findByPk() to get a real Sequelize
  //      instance with .save() method — no more undefined error.
  // Security: client verified they own the case via JWT user check.
  fastify.post('/:id/documents', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'No file uploaded', status: 400 },
        });
      }

      // Sanitize filename — prevent path traversal attacks
      const safeName = data.filename
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/\.\./g, '_');

      const filename = `${request.params.id}_${Date.now()}_${safeName}`;
      const filepath = join(UPLOAD_DIR, filename);

      // Stream file to disk
      await pipeline(data.file, createWriteStream(filepath));

      // FIX: directly fetch Sequelize instance — ensures .save() works
      // for BOTH client uploads and lawyer uploads
      const found = await Case.findByPk(request.params.id);

      if (!found) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Case not found', status: 404 },
        });
      }

      // Security: client can only upload to their own case
      if (request.currentUser.role === 'client' && found.clientId !== request.currentUser.id) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You can only upload to your own cases', status: 403 },
        });
      }

      // Add filename to the JSONB documents array and save
      found.documents   = [...found.documents, filename];
      found.lastUpdated = new Date().toISOString().split('T')[0];
      await found.save();

      return sendSuccess(reply, { data: { filename, case: found } });

    } catch (err) {
      return sendError(reply, err);
    }
  });

  // ── GET /api/cases/:id/documents/:filename — download 
  // Serves the file so browser saves it to device.
  fastify.get('/:id/documents/:filename', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      // Verify file belongs to this case
      const found = await Case.findByPk(request.params.id);
      if (!found) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', status: 404 } });
      }

      // Security: client can only download from their own case
      if (request.currentUser.role === 'client' && found.clientId !== request.currentUser.id) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', status: 403 } });
      }

      const requestedFile = request.params.filename;

      // Verify file is actually in this case's documents list
      if (!found.documents.includes(requestedFile)) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found in this case', status: 404 } });
      }

      // basename() strips path components — prevents ../../../etc attacks
      const safeFilename = basename(requestedFile);
      const filepath     = join(UPLOAD_DIR, safeFilename);

      if (!existsSync(filepath)) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'File not found on server', status: 404 } });
      }

      // Clean display name (strips caseId_timestamp_ prefix)
      const displayName = safeFilename.replace(/^[A-Z0-9-]+_\d+_/, '') || safeFilename;

      // Detect MIME type
      const ext     = safeFilename.split('.').pop()?.toLowerCase() || '';
      const mimes   = {
        pdf:  'application/pdf',
        jpg:  'image/jpeg', jpeg: 'image/jpeg',
        png:  'image/png',
        doc:  'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };
      const mime    = mimes[ext] || 'application/octet-stream';

      // Robust Content-Disposition (RFC 5987) to prevent "Failed to download"
      // and handle special characters in filenames.
      const encodedName = encodeURIComponent(displayName).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\*/g, '%2a');
      
      reply.header('Content-Type', mime);
      reply.header('Content-Disposition', `attachment; filename="${displayName.replace(/"/g, '\\"')}"; filename*=UTF-8''${encodedName}`);
      reply.header('Content-Security-Policy', "default-src 'self'");
      
      const stream = createReadStream(filepath);
      
      // Handle stream errors to prevent server crash or hanging request
      stream.on('error', (err) => {
        request.log.error(err);
        if (!reply.sent) {
          reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: 'Error reading file' } });
        }
      });

      return reply.send(stream);

    } catch (err) {
      return sendError(reply, err);
    }
  });

  // ── POST /api/cases/:id/summarize — generate & persist PDF summary ─────────
  // Flow: get case → read latest PDF → extract → chunk (~1200 chars) → summarize chunks → final summary → store in DB
  fastify.post('/:id/summarize', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const result = await summarizeCasePdf({
        caseId: request.params.id,
        currentUser: request.currentUser,
      });
      return sendSuccess(reply, {
        data: {
          caseId: request.params.id,
          document: result.document,
          chunkCount: result.chunkCount,
          summary: result.summary,
        },
      });
    } catch (err) {
      return sendError(reply, err);
    }
  });
}
