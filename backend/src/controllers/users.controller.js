import { getUserById, getAllLawyers } from "../services/user.service.js";
import { sendError, sendSuccess }    from "../utils/errors.js";

export async function getMe(request, reply) {
  try {
    const user = await getUserById(request.currentUser.id);
    return sendSuccess(reply, { data: { user } });
  } catch (err) {
    return sendError(reply, err);
  }
}

export async function getLawyers(request, reply) {
  try {
    const lawyers = await getAllLawyers();
    return sendSuccess(reply, { data: { lawyers } });
  } catch (err) {
    return sendError(reply, err);
  }
}