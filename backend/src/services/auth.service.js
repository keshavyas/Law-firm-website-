import bcrypt     from "bcryptjs";
import { User }   from "../models/index.js";
import { conflict, unauthorized } from "../utils/errors.js";

export async function registerUser(data) {
  const { name, email, password, role, firm, specialization, bar, phone } = data;

  // Check duplicate email
  const existing = await User.findOne({ where: { email: email.toLowerCase() } });
  if (existing) throw conflict("Email already registered");

  // Hash password — ASYNC (does not block event loop)
  const hashed = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 10);

  // Create user — beforeValidate hook auto-generates initials
  const user = await User.scope("withPassword").create({
    name, email, password: hashed, role,
    firm: firm || null, specialization: specialization || null,
    bar: bar || null, phone: phone || null,
  });

  return user.toSafeJSON(); // Never return password to client
}

export async function loginUser(email, password, role) {
  // Must use scope("withPassword") — default scope excludes the password column
  const user = await User.scope("withPassword").findOne({
    where: { email: email.toLowerCase(), role },
  });

  // Same error for "no user" and "wrong password" — prevents email enumeration
  if (!user) throw unauthorized("Invalid email or password");

  const match = await bcrypt.compare(password, user.password);
  if (!match)  throw unauthorized("Invalid email or password");

  return user.toSafeJSON();
}