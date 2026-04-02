import {
  getAllMatters,
  getMatterById,
  createMatter,
  updateMatter,
  transitionMatter,
  deleteMatter,
} from '../services/matter.service.js';
import { sendError, sendSuccess } from '../utils/errors.js';

export async function getMatters(request, reply) {
  try {
    const result = await getAllMatters(
      request.params.caseId,
      request.currentUser,
      request.query
    );
    return sendSuccess(reply, { data: result });
  } catch (err) {
    return sendError(reply, err);
  }
}

export async function getMatter(request, reply) {
  try {
    const matter = await getMatterById(
      request.params.matterId,
      request.currentUser
    );
    return sendSuccess(reply, { data: { matter } });
  } catch (err) {
    return sendError(reply, err);
  }
}

export async function createMatterHandler(request, reply) {
  try {
    const matter = await createMatter(
      request.params.caseId,
      request.body,
      request.currentUser
    );
    return sendSuccess(reply, { data: { matter } }, 201);
  } catch (err) {
    return sendError(reply, err);
  }
}

export async function updateMatterHandler(request, reply) {
  try {
    const matter = await updateMatter(
      request.params.matterId,
      request.body,
      request.currentUser
    );
    return sendSuccess(reply, { data: { matter } });
  } catch (err) {
    return sendError(reply, err);
  }
}

export async function transitionMatterHandler(request, reply) {
  try {
    const matter = await transitionMatter(
      request.params.matterId,
      request.body.status,   
      request.body.reason,   
      request.currentUser
    );
    return sendSuccess(reply, { data: { matter } });
  } catch (err) {
    return sendError(reply, err);
  }
}

export async function deleteMatterHandler(request, reply) {
  try {
    const result = await deleteMatter(
      request.params.matterId,
      request.currentUser
    );
    return sendSuccess(reply, { data: result });
  } catch (err) {
    return sendError(reply, err);
  }
}