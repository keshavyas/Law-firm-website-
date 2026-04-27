// SEQUELIZE INSTANCE
// Builds and exports the active Sequelize connection using database.js config.
// All models and server.js import from here — NOT from database.js directly.

import dotenv from 'dotenv';
dotenv.config();

import { Sequelize } from 'sequelize';
import config from './database.js';

const env = process.env.NODE_ENV || 'development';
const cfg = config[env];

console.log(`\n🔍 Initializing Sequelize [${env}] → ${cfg.host}:${cfg.port}/${cfg.database}`);

const sequelize = cfg.url
  ? new Sequelize(cfg.url, {
      dialect:        cfg.dialect,
      logging:        cfg.logging,
      pool:           cfg.pool,
      dialectOptions: cfg.dialectOptions,
    })
  : new Sequelize(
      cfg.database,
      cfg.username,
      cfg.password,
      {
        host:           cfg.host,
        port:           cfg.port,
        dialect:        cfg.dialect,
        logging:        cfg.logging,
        pool:           cfg.pool,
        dialectOptions: cfg.dialectOptions,
      }
    );

export async function testConnection() {
  const MAX_RETRIES = 5;
  let attempts = 0;

  while (attempts < MAX_RETRIES) {
    try {
      console.log(`   Trying to connect to Postgres at ${cfg.host}:${cfg.port}...`);
      await sequelize.authenticate();
      console.log('   Postgres connection established');
      return true;
    } catch (err) {
      attempts++;
      console.error(`  [Attempt ${attempts}/${MAX_RETRIES}] Cannot connect: ${err.message}`);
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
