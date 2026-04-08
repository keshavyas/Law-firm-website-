// DATABASE CONNECTION
import dotenv from 'dotenv';
dotenv.config();
import { Sequelize } from 'sequelize';

let sequelize;

const dbName = process.env.DB_NAME || 'case_db';
const dbUser = process.env.DB_USER || 'postgres';
const dbPass = process.env.DB_PASS || 'postgres';
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.DB_PORT) || 5432;

if (process.env.DATABASE_URL && !process.env.DB_HOST) {
  console.log(`\n🔍 Using legacy DATABASE_URL for connection...`);
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development'
      ? (sql) => { console.log(sql); }
      : false,
    pool: { max: 10, min: 2, acquire: 30000, idle: 10000 },
    dialectOptions: {
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    },
  });
} else {
  console.log(`\n🔍 Initializing Sequelize with granular variables: ${dbHost}:${dbPort}`);
  sequelize = new Sequelize(
    dbName,
    dbUser,
    dbPass,
    {
      host:    dbHost,
      port:    dbPort,
      dialect: 'postgres',
      logging: process.env.NODE_ENV === 'development'
        ? (sql) => { console.log(sql); }
        : false,
      pool: { max: 10, min: 2, acquire: 30000, idle: 10000 },
      dialectOptions: {
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      },
    }
  );
}


export async function testConnection() {
  const MAX_RETRIES = 5;
  let attempts      = 0;

  while (attempts < MAX_RETRIES) {
    try {
      const dbHost = sequelize.options.host || 'unknown';
      const dbPort = sequelize.options.port || 'unknown';
      console.log(`   Trying to connect to Postgres at ${dbHost}:${dbPort}...`);
      await sequelize.authenticate();
      console.log('   Postgres connection established');
      return true;
    } catch (err) {
      attempts++;
      console.error(`  [Attempt ${attempts}/${MAX_RETRIES}] Cannot connect to Postgres: ${err.message}`);
      
      if (attempts < MAX_RETRIES) {
        console.log('  Retrying in 2s...');
        await new Promise(res => setTimeout(res, 2000));
      } else {
        console.error('  Max retries reached. Giving up.');
        return false;
      }
    }
  }
}

export default sequelize;