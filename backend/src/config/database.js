import dotenv from 'dotenv';
dotenv.config();

// DATABASE CONFIGURATION
// Exports a plain config object (not a Sequelize instance).
// Used by: sequelize.js (app runtime) and database.cjs (sequelize-cli migrations)

const config = {
  development: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'keshav',
    database: process.env.DB_NAME || 'case_db',
    host:     process.env.DB_HOST || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 5432,
    dialect:  'postgres',
    logging:  (sql) => console.log(sql),
    pool: { max: 10, min: 2, acquire: 30000, idle: 10000 },
    dialectOptions: {
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    },
  },

  production: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS,
    database: process.env.DB_NAME || 'case_db',
    host:     process.env.DB_HOST || 'db',             // Use env var or default to Docker 'db' alias
    port:     5432,
    dialect:  'postgres',
    logging:  false,
    pool: { max: 10, min: 2, acquire: 30000, idle: 10000 },
    dialectOptions: {
      ssl: false,
    },
  },
};

export default config;