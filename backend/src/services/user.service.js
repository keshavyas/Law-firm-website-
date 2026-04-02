
import { User }     from "../models/index.js";
import { notFound } from "../utils/errors.js";

export async function getUserById(id) {
  const user = await User.findByPk(id); // defaultScope already excludes password
  if (!user) throw notFound("User not found");
  return user;
}

export async function getAllLawyers() {
  return User.scope("lawyers").findAll({
    attributes: ["id", "name", "email", "initials", "firm", "specialization", "bar"],
    order: [["name", "ASC"]],
  });
}