'use strict';

import dotenv from 'dotenv';
dotenv.config();

import { buildApp } from './app.js';
import db, { testConnection } from './config/database.js';

const PORT = parseInt(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';


async function start() {
  try {
    console.log('\n\uD83D\uDD0D Checking database connection...');
    const dbOk = await testConnection();

    if (!dbOk) {
      console.warn('  \u26A0\uFE0F  Database unreachable \u2014 check DATABASE_URL in .env\n');
    }

    const fastify = await buildApp();

    const address = await fastify.listen({ port: PORT, host: HOST });

    const dbStatus = dbOk ? '\u2705 Postgres connected' : '\u274C Not connected';

    console.log([
      '',
      '\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557',
      '\u2551       \u2696\uFE0F  DemoCase API (CJS) Running          \u2551',
      '\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563',
      '\u2551  Server  : ' + address.padEnd(32) + '\u2551',
      '\u2551  Health  : ' + (address + '/health').padEnd(32) + '\u2551',
      '\u2551  DB      : ' + dbStatus.padEnd(32) + '\u2551',
      '\u2551  Env     : ' + (process.env.NODE_ENV || 'development').padEnd(32) + '\u2551',
      '\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D',
      '',
    ].join('\n'));
      ;
  } catch (err) {
    console.error('\u274C Server failed to start:', err);
    process.exit(1);
  }
}

process.on('SIGINT',  function() { console.log('\n\uD83D\uDCF4 SIGINT \u2014 shutting down'); process.exit(0); });
process.on('SIGTERM', function() { console.log('\n\uD83D\uDCF4 SIGTERM \u2014 shutting down'); process.exit(0); });

start();