export const loginBodySchema = {
  type: "object",
  required: ["email", "password", "role"],
  properties: {
    email:    { type: "string", format: "email", maxLength: 150 },
    password: { type: "string", minLength: 6, maxLength: 100 },
    role:     { type: "string", enum: ["lawyer", "client"] },
  },
  additionalProperties: false,
};

export const registerBodySchema = {
  type: "object",
  required: ["name", "email", "password", "role"],
  properties: {
    name:           { type: "string", minLength: 2, maxLength: 100 },
    email:          { type: "string", format: "email", maxLength: 150 },
    password:       { type: "string", minLength: 6, maxLength: 100 },
    role:           { type: "string", enum: ["lawyer", "client"] },
    firm:           { type: "string", maxLength: 100 },
    specialization: { type: "string", maxLength: 100 },
    bar:            { type: "string", maxLength: 50  },
    phone:          { type: "string", maxLength: 20  },
  },
  additionalProperties: false,
};

export const authResponseSchema = {
  200: {
    type: "object",
    properties: {
      success: { type: "boolean" },
      data: {
        type: "object",
        properties: {
          token: { type: "string" },
          user:  {
            type: "object",
            properties: {
              id: { type: "string" }, name: { type: "string" },
              email: { type: "string" }, role: { type: "string" },
              initials: { type: "string" },
            },
          },
        },
      },
    },
  },
};