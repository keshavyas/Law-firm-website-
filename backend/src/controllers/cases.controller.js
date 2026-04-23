import { getAllCases, getCaseById, createCase, updateCase, getCaseStats }
  from "../services/case.service.js";
import { sendError, sendSuccess } from "../utils/errors.js";
import { createWriteStream }      from "fs";
import { pipeline }               from "stream/promises";
import { join, dirname }          from "path";
import { fileURLToPath }          from "url";

const __dirname  = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = join(__dirname, "..", "..", "uploads");

//getStats 
export async function getStats(request, reply) {
  try {
    const stats = await getCaseStats();
    return sendSuccess(reply, { data: stats });
  } catch (err) {
    return sendError(reply, err);
  }
}

//getCases
export async function getCases(request, reply) {
  try {
    const result = await getAllCases(request.currentUser, request.query);
    return sendSuccess(reply, { data: result });
  } catch (err) {
    return sendError(reply, err);
  }
}

//getCase
export async function getCase(request, reply) {
  try {
    const caseData = await getCaseById(request.params.id, request.currentUser);
    return sendSuccess(reply, { data: { case: caseData } });
  } catch (err) {
    return sendError(reply, err);
  }
}

//createCaseHandler
export async function createCaseHandler(request, reply) {
  try {
    const newCase = await createCase(request.body, request.currentUser);
    return sendSuccess(reply, { data: { case: newCase } }, 201);
  } catch (err) {
    return sendError(reply, err);
  }
}

//updateCaseHandler
export async function updateCaseHandler(request, reply) {
  console.log(`[CasesController] PATCH request received for Case ${request.params.id}`);
  console.log(`[CasesController] Body:`, JSON.stringify(request.body));
  try {
    const updated = await updateCase(
      request.params.id,
      request.body,
      request.currentUser
    );
    return sendSuccess(reply, { data: { case: updated } });
  } catch (err) {
    console.error(`[CasesController] Error updating case ${request.params.id}:`, err);
    return sendError(reply, err);
  }
}

//uploadDocument
export async function uploadDocument(request, reply) {
  try {
    const data = await request.file();
    if (!data) {
      return sendError(reply, {
        message:    "No file uploaded",
        statusCode: 400,
        code:       "BAD_REQUEST",
      });
    }

    const safeName = data.filename
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/\.\./g, "_");

    const filename = `${request.params.id}_${Date.now()}_${safeName}`;
    const filepath = join(UPLOAD_DIR, filename);

    await pipeline(data.file, createWriteStream(filepath));

    const found = await getCaseById(request.params.id, request.currentUser);
    found.documents   = [...found.documents, filename];
    found.lastUpdated = new Date().toISOString().split("T")[0];
    await found.save();

    return sendSuccess(reply, { data: { filename, case: found } });
  } catch (err) {
    return sendError(reply, err);
  }
}