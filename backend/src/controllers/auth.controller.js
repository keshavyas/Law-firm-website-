import { registerUser, loginUser } from "../services/auth.service.js";
import { sendError, sendSuccess }  from "../utils/errors.js";

export async function login(request, reply) {
  try {
    const { email, password, role } = request.body;
    const user  = await loginUser(email, password, role);
    const token = request.server.jwt.sign({ id: user.id, role: user.role });
    return sendSuccess(reply, { data: { token, user } });
  } catch (err) {
    return sendError(reply, err);
  }
}

export async function register(request, reply) {
  try {
    const user  = await registerUser(request.body);
    const token = request.server.jwt.sign({ id: user.id, role: user.role });
    return sendSuccess(reply, { data: { token, user } }, 201);
  } catch (err) {
    return sendError(reply, err);
  }
}