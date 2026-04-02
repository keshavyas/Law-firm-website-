

export const createCaseBodySchema = {
  type: "object",
  required: ["title", "category", "description"],
  properties: {
    title:       { type: "string", minLength: 5, maxLength: 200 },
    category:    { type: "string", enum: ["Civil","Criminal","Family","Labour","Consumer","Corporate","Other"] },
    priority:    { type: "string", enum: ["low","medium","high"], default: "medium" },
    description: { type: "string", minLength: 10, maxLength: 5000 },
    documents:   { type: "array", items: { type: "string" }, default: [] },
  },
  additionalProperties: false,
};

export const updateCaseBodySchema = {
  type: "object",
  minProperties: 1,  // At least one field must be sent
  properties: {
    status:        { type: "string", enum: ["pending","active","urgent","resolved","closed"] },
    lawyerNote:    { type: "string", maxLength: 1000 },
    nextHearing:   { type: ["string","null"] },
    timelineEvent: { type: "string", minLength: 3, maxLength: 300 },
  },
  additionalProperties: false,
};

export const caseQuerySchema = {
  type: "object",
  properties: {
    status:   { type: "string", enum: ["pending","active","urgent","resolved","closed","all"], default: "all" },
    category: { type: "string" },
    priority: { type: "string", enum: ["low","medium","high"] },
    search:   { type: "string", maxLength: 100 },
    page:     { type: "integer", minimum: 1, default: 1 },
    limit:    { type: "integer", minimum: 1, maximum: 100, default: 20 },
  },
};