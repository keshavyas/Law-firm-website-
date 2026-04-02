//create matter 
export const createMatterBodySchema = {
  type: 'object',
  required: ['title'], 
  properties: {
    title: {
      type:      'string',
      minLength: 3,
      maxLength: 200,
    },
    description: {
      type:      'string',
      maxLength: 2000,
    },
    priority: {
      type:    'string',
      enum:    ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    assignedTo: {
      type:      'string',
      maxLength: 100,
    },
    dueDate: {
      
      type: ['string', 'null'],
    },
    notes: {
      type:      'string',
      maxLength: 1000,
    },
  },

  additionalProperties: false,
};

//Update Matter 
export const updateMatterBodySchema = {
  type: 'object',
  minProperties: 1,
  properties: {
    title:       { type: 'string', minLength: 3, maxLength: 200 },
    description: { type: 'string', maxLength: 2000 },
    priority:    { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
    assignedTo:  { type: ['string', 'null'], maxLength: 100 },
    dueDate:     { type: ['string', 'null'] },
    notes:       { type: 'string', maxLength: 1000 },
  },

  additionalProperties: false,
};

//Status Transition
export const transitionMatterSchema = {
  type: 'object',
  required: ['status'],

  properties: {
    status: {
      type: 'string', 
      enum: ['open', 'in_progress', 'pending_review', 'on_hold', 'closed'],
    },
    reason: {
      type:      'string',
      maxLength: 500,
    },
  },

  additionalProperties: false,
};

export const matterQuerySchema = {
  type: 'object',
  properties: {
    status: {
      type:    'string',
      enum:    ['open', 'in_progress', 'pending_review', 'on_hold', 'closed', 'all'],
      default: 'all', 
    },
    priority: {
      type: 'string',
      enum: ['low', 'medium', 'high', 'urgent'],
    },
    page:  { type: 'integer', minimum: 1, default: 1  },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
};
