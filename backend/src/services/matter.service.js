import { Op }       from 'sequelize';
import { Matter, Case} from '../models/index.js';
import { notFound, forbidden, badRequest }         from '../utils/errors.js';

// getAllMatters 
export async function getAllMatters(caseId, currentUser, query = {}) {
  const caseRecord = await Case.findByPk(caseId);
  if (!caseRecord) throw notFound(`Case ${caseId} not found`);

  // Client can only see matters for their own cases
  if (currentUser.role === 'client' && caseRecord.clientId !== currentUser.id) {
    throw forbidden('You can only view matters for your own cases');
  }

  const { status = 'all', priority, page = 1, limit = 20 } = query;

  const where = { caseId };
  if (status && status !== 'all') where.status   = status;
  if (priority)                   where.priority  = priority;

  const pageNum  = parseInt(page);
  const limitNum = parseInt(limit);
  const offset   = (pageNum - 1) * limitNum;

  const { count, rows } = await Matter.findAndCountAll({
    where,
    order: [['createdAt', 'ASC']],
    limit: limitNum,
    offset,
  });

  return {
    matters:    rows,
    total:      count,
    page:       pageNum,
    limit:      limitNum,
    totalPages: Math.ceil(count / limitNum),
  };
}

// getMatterById 
export async function getMatterById(matterId, currentUser) {
  const matter = await Matter.findByPk(matterId, {
    include: [{ model: Case, as: 'case', attributes: ['id', 'title', 'clientId'] }],
  });

  if (!matter) throw notFound(`Matter ${matterId} not found`);

  // Client can only see matters for their own cases
  if (currentUser.role === 'client' && matter.case.clientId !== currentUser.id) {
    throw forbidden('You can only view matters for your own cases');
  }

  return matter;
}

// createMatter 
// FIX 3: Both client and lawyer can create matters.
// Client can only create matters for their own case.
// Lawyer can create for any case.
export async function createMatter(caseId, data, currentUser) {
  const caseRecord = await Case.findByPk(caseId);
  if (!caseRecord) throw notFound(`Case ${caseId} not found`);

  // FIX: client restricted to their own case only (not all cases)
  if (currentUser.role === 'client' && caseRecord.clientId !== currentUser.id) {
    throw forbidden('You can only add matters to your own cases');
  }

  // No restriction for lawyer — can add to any case

  const { title, description, priority = 'medium', assignedTo, dueDate, notes } = data;

  const matter = await Matter.create({
    caseId,
    title,
    description:   description || null,
    priority,
    assignedTo:    assignedTo  || null,
    dueDate:       dueDate     || null,
    notes:         notes       || null,
    status:        'open',
    statusHistory: [{
      from:      null,
      to:        'open',
      changedAt: new Date().toISOString(),
      changedBy: currentUser.name,
      reason:    `Matter created by ${currentUser.role}`,
    }],
  });

  return matter;
}

// updateMatter
export async function updateMatter(matterId, data, currentUser) {
  const matter = await Matter.findByPk(matterId, {
    include: [{ model: Case, as: 'case', attributes: ['clientId'] }],
  });

  if (!matter) throw notFound(`Matter ${matterId} not found`);

  if (currentUser.role !== 'lawyer') {
    throw forbidden('Only lawyers can update matter details');
  }

  if (data.title       !== undefined) matter.title       = data.title;
  if (data.description !== undefined) matter.description = data.description;
  if (data.priority    !== undefined) matter.priority    = data.priority;
  if (data.assignedTo  !== undefined) matter.assignedTo  = data.assignedTo;
  if (data.dueDate     !== undefined) matter.dueDate     = data.dueDate;
  if (data.notes       !== undefined) matter.notes       = data.notes;

  await matter.save();
  return matter;
}

// transitionMatter
export async function transitionMatter(matterId, newStatus, reason, currentUser) {
  const matter = await Matter.findByPk(matterId, {
    include: [{ model: Case, as: 'case', attributes: ['clientId'] }],
  });

  if (!matter) throw notFound(`Matter ${matterId} not found`);

  if (currentUser.role !== 'lawyer') {
    throw forbidden('Only lawyers can change matter status');
  }

  const allowed = MATTER_STATUS_TRANSITIONS[matter.status] || [];

  if (!allowed.includes(newStatus)) {
    const allowedText = allowed.length > 0
      ? allowed.join(', ')
      : 'none — this is a terminal state';

    throw badRequest(
      `Cannot transition from "${matter.status}" to "${newStatus}". ` +
      `Allowed: [${allowedText}]`
    );
  }

  const previousStatus = matter.status;
  matter.status        = newStatus;

  if (newStatus === 'closed') matter.resolvedAt = new Date();

  matter.statusHistory = [
    ...matter.statusHistory,
    {
      from:      previousStatus,
      to:        newStatus,
      changedAt: new Date().toISOString(),
      changedBy: currentUser.name,
      reason:    reason || `Status changed to ${newStatus}`,
    },
  ];

  await matter.save();
  return matter;
}

// deleteMatter
export async function deleteMatter(matterId, currentUser) {
  const matter = await Matter.findByPk(matterId);
  if (!matter) throw notFound(`Matter ${matterId} not found`);

  if (currentUser.role !== 'lawyer') {
    throw forbidden('Only lawyers can delete matters');
  }

  if (matter.status !== 'open') {
    throw badRequest(
      `Cannot delete a matter with status "${matter.status}". Only "open" matters can be deleted.`
    );
  }

  await matter.destroy();
  return { message: 'Matter deleted successfully' };
}