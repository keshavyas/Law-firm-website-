import { User }                         from "../models/index.js";
import { unauthorized, forbidden, sendError } from "../utils/errors.js";

export async function authenticate(request, reply) {
  try {
    await request.jwtVerify();

    const user = await User.findByPk(request.user.id);
    if (!user) {
      return sendError(reply, unauthorized("User account not found"));
    }

    request.currentUser = user;

  } catch (err) {
    return sendError(reply, unauthorized("Invalid or expired token"));
  }
}

export function authorizeRole(...allowedRoles) {
  return async function (request, reply) {
    if (!allowedRoles.includes(request.currentUser?.role)) {
      return sendError(
        reply,
        forbidden(`Access denied. Required role: ${allowedRoles.join(" or ")}`)
      );
    }
  };
}

export const POLICIES = {
  "cases:read_all":   ["lawyer"],
  "cases:read_own":   ["client"],
  "cases:create":     ["client"],
  "cases:update":     ["lawyer"],
  "cases:stats":      ["lawyer"],
  "docs:upload":      ["lawyer", "client"],
  "users:read_self":  ["lawyer", "client"],
};
