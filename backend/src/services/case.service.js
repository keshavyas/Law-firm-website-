
import { Op }             from "sequelize";
import { Case, User }     from "../models/index.js";
import { notFound, forbidden } from "../utils/errors.js";
import { sendHearingNotification } from "./mail.service.js";

// ── getAllCases 
export async function getAllCases(currentUser, query = {}) {
  const { status = "all", category, priority, search, page = 1, limit = 20 } = query;

  // Build WHERE clause dynamically based on role + filters
  const where = {};
  if (currentUser.role === "client") where.clientId = currentUser.id; // RBAC
  if (status && status !== "all")    where.status   = status;
  if (category)                      where.category  = category;
  if (priority)                      where.priority  = priority;

  // Full-text search across title, id, clientName
  if (search) {
    where[Op.or] = [
      { title:      { [Op.iLike]: `%${search}%` } },
      { id:         { [Op.iLike]: `%${search}%` } },
      { clientName: { [Op.iLike]: `%${search}%` } },
    ];
  }

  // Pagination: page=2, limit=20 → offset=20, items 21-40
  const pageNum  = parseInt(page);
  const limitNum = parseInt(limit);
  const offset   = (pageNum - 1) * limitNum;

  // findAndCountAll = one query that returns rows + total count
  const { count, rows } = await Case.findAndCountAll({
    where,
    order:  [["lastUpdated", "DESC"]],
    limit:  limitNum,
    offset,
  });

  return {
    cases:      rows,
    total:      count,
    page:       pageNum,
    limit:      limitNum,
    totalPages: Math.ceil(count / limitNum),
  };
}

// ── getCaseById
export async function getCaseById(caseId, currentUser) {
  const found = await Case.findByPk(caseId);
  if (!found) throw notFound(`Case ${caseId} not found`);

  // Clients can only view their own cases
  if (currentUser.role === "client" && found.clientId !== currentUser.id) {
    throw forbidden("You can only view your own cases");
  }

  return found;
}

// ── createCase
export async function createCase(data, currentUser) {
  const { title, category, priority = "medium", description, documents = [] } = data;

  // Generate human-readable case ID: CASE-2024-001
  const year   = new Date().getFullYear();
  const count  = await Case.count();
  const caseId = `CASE-${year}-${String(count + 1).padStart(3, "0")}`;
  const today  = new Date().toISOString().split("T")[0];

  return await Case.create({
    id:          caseId,
    clientId:    currentUser.id,
    clientName:  currentUser.name,
    title, category, description, priority,
    status:      "pending",
    filedDate:   today,
    lastUpdated: today,
    documents,
    timeline:    [{ date: today, event: "Complaint filed by client", by: "client" }],
    lawyerNote:  null,
    nextHearing: null,
  });
}

// ── updateCase
export async function updateCase(caseId, updates, currentUser) {
  const found = await Case.findByPk(caseId);
  if (!found) throw notFound(`Case ${caseId} not found`);

  const oldHearingDate = found.nextHearing;
  const today = new Date().toISOString().split("T")[0];

  // Build timeline event message automatically if not provided
  let timelineEvent = updates.timelineEvent;
  if (!timelineEvent) {
    if (updates.status && updates.status !== found.status) {
      timelineEvent = `Status changed from "${found.status}" to "${updates.status}"`;
    } else if (updates.nextHearing) {
      timelineEvent = `Hearing scheduled for ${updates.nextHearing}`;
    } else {
      timelineEvent = "Case updated by lawyer";
    }
  }

  // Apply partial updates (PATCH = only update what was sent)
  if (updates.status      !== undefined) found.status      = updates.status;
  if (updates.lawyerNote  !== undefined) found.lawyerNote  = updates.lawyerNote;
  if (updates.nextHearing !== undefined) found.nextHearing = updates.nextHearing;

  // Append to timeline — never overwrite (it's a history log)
  found.timeline    = [...found.timeline, { date: today, event: timelineEvent, by: "lawyer" }];
  found.lastUpdated = today;

  await found.save(); // UPDATE WHERE id = ? with only changed columns

  // 🔥 Trigger Auto Email Notification if nextHearing is updated
  if (updates.nextHearing && updates.nextHearing !== oldHearingDate) {
    // Fetch client email if not already present (found.client)
    // Actually, we should have included it in the initial fetch for efficiency
    // but found.save() might have updated the instance.
    // Let's ensure we have the client info.
    const client = await User.findByPk(found.clientId, { attributes: ['email', 'name'] });
    if (client && client.email) {
      console.log(`[CaseService] Triggering hearing notification for ${client.email}`);
      // Async fire-and-forget
      sendHearingNotification({
        to:          client.email,
        clientName:  client.name,
        caseTitle:   found.title,
        caseId:      found.id,
        hearingDate: updates.nextHearing,
      }).catch(err => console.error('[CaseService] Email notification error:', err));
    }
  }

  return found;
}

// ── getCaseStats 
export async function getCaseStats() {
  // Count by status using SQL GROUP BY (one query, not five)
  const statusRows = await Case.findAll({
    attributes: ["status", [Case.sequelize.fn("COUNT", Case.sequelize.col("id")), "count"]],
    group: ["status"],
    raw:   true,
  });

  // Count by category
  const categoryRows = await Case.findAll({
    attributes: ["category", [Case.sequelize.fn("COUNT", Case.sequelize.col("id")), "count"]],
    group: ["category"],
    raw:   true,
  });

  // Upcoming hearings in next 30 days
  const today    = new Date().toISOString().split("T")[0];
  const in30days = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
  const upcoming = await Case.findAll({
    where: { nextHearing: { [Op.between]: [today, in30days] } },
    order: [["nextHearing", "ASC"]],
    limit: 5,
  });

  // Convert arrays to objects: [{ status: "active", count: "3" }] → { active: 3 }
  const byStatus   = statusRows.reduce((acc, r) => { acc[r.status]   = parseInt(r.count); return acc; }, {});
  const byCategory = categoryRows.reduce((acc, r) => { acc[r.category] = parseInt(r.count); return acc; }, {});

  return { total: await Case.count(), byStatus, byCategory, upcoming };
}
