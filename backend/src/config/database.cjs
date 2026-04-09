// CJS config file for sequelize-cli.
// Required because sequelize-cli does NOT support ESM (import/export) syntax.
// This file mirrors database.js but uses CommonJS module.exports.
// Usage: sequelize --config src/config/database.cjs --migrations-path src/migrations db:migrate

require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'keshav',
    database: process.env.DB_NAME || 'case_db',
    host:     process.env.DB_HOST || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 5432,
    dialect:  'postgres',
    logging:  console.log,
    dialectOptions: {
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    },
  },

  production: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS,
    database: process.env.DB_NAME || 'case_db',
    host:     process.env.DB_HOST || 'db',   // Use env var or default to Docker 'db' alias
    port:     5432,
    dialect:  'postgres',
    logging:  false,
    dialectOptions: {
      ssl: false,
    },
  },
};
