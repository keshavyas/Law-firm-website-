'use strict';
import dotenv from 'dotenv';
dotenv.config();

import sequelize from '../models/index.js';

const command = process.argv[2];

async function migrate() {
  console.log(' Running migrations...');

  try {
    await sequelize.authenticate();
    console.log('Connected to Postgres\n');

    if (command === 'undo') {
      console.log('   Dropping all tables...');
      await sequelize.drop({ cascade: true });
      console.log('  All tables dropped\n');
    } else {
      await sequelize.sync({ alter: true });
      console.log(' Tables synced:');
      console.log(' users  (id UUID PK, name, email UNIQUE, password, role ENUM, ...)');
      console.log(' cases  (id STRING PK, clientId UUID FK, title, status ENUM, ...)');
      console.log(' Migration complete!\n');
    }

  } catch (err) {
    console.error(' Migration failed:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

migrate();