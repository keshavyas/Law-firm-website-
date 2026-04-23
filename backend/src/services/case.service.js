
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

// ── Helper to normalize date strings
function normalizeDate(d) {
  if (!d) return null;
  if (typeof d !== 'string') {
    try {
      return new Date(d).toISOString().split('T')[0];
    } catch (e) { return null; }
  }
  // If DD-MM-YYYY
  const match = d.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match) {
    const [_, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  // Try native
  try {
    const date = new Date(d);
    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
  } catch (e) { return null; }
}

// ── updateCase
export async function updateCase(caseId, updates, currentUser) {
  console.log(`[CaseService] updateCase called for ${caseId}`);
  console.log(`[CaseService] RAW updates:`, JSON.stringify(updates));

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

  // Apply partial updates
  if (updates.status      !== undefined) found.status      = updates.status;
  if (updates.lawyerNote  !== undefined) found.lawyerNote  = updates.lawyerNote;
  
  // Handle hearing date update with normalization
  if (updates.nextHearing !== undefined) {
    const normalized = normalizeDate(updates.nextHearing);
    console.log(`[CaseService] Normalizing hearing date: "${updates.nextHearing}" -> "${normalized}"`);
    found.nextHearing = normalized;
  }

  found.timeline    = [...found.timeline, { date: today, event: timelineEvent, by: "lawyer" }];
  found.lastUpdated = today;

  await found.save();

  // 🔥 Trigger Auto Email Notification
  const oldDateStr = normalizeDate(oldHearingDate);
  const newDateStr = normalizeDate(found.nextHearing);

  console.log(`[CaseService] --- EMAIL TRIGGER CHECK ---`);
  console.log(`[CaseService] Case ID: ${caseId}`);
  console.log(`[CaseService] Old Date: ${oldDateStr}`);
  console.log(`[CaseService] New Date: ${newDateStr}`);
  console.log(`[CaseService] Client ID: ${found.clientId}`);

  if (newDateStr && newDateStr !== oldDateStr) {
    console.log(`[CaseService] ✅ TRIGGER CONDITION MET. Fetching client email...`);
    
    try {
      const client = await User.findByPk(found.clientId, { attributes: ['email', 'name'] });
      
      if (!client) {
        console.error(`[CaseService] ❌ ERROR: Client with ID ${found.clientId} not found in database!`);
      } else if (!client.email) {
        console.error(`[CaseService] ❌ ERROR: Client found (${client.name}) but has NO EMAIL address!`);
      } else {
        console.log(`[CaseService] 📧 Sending email to: ${client.name} <${client.email}>`);
        
        const mailResult = await sendHearingNotification({
          to:          client.email,
          clientName:  client.name,
          caseTitle:   found.title,
          caseId:      found.id,
          hearingDate: newDateStr,
        });
        
        if (mailResult && mailResult.success) {
          console.log(`[CaseService] 🚀 SUCCESS: Email delivered to ${client.email} (MsgID: ${mailResult.messageId})`);
        } else {
          console.error(`[CaseService] ❌ FAILURE: Mail service returned error:`, mailResult?.error);
        }
      }
    } catch (dbErr) {
      console.error(`[CaseService] ❌ DB ERROR while fetching client:`, dbErr);
    }
  } else {
    console.log(`[CaseService] ℹ️ TRIGGER SKIPPED: Date didn't change or is invalid.`);
  }

  console.log(`[CaseService] --- END EMAIL TRIGGER CHECK ---`);

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
