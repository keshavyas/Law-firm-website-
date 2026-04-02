// DATABASE CONNECTION
import { Sequelize } from 'sequelize';

let sequelize;

if (process.env.DATABASE_URL) {
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',

    logging: process.env.NODE_ENV === 'development'
      ? (sql) => { console.log(sql); }
      : false,

    pool: {
      max:     10,
      min:     2,
      acquire: 30000,
      idle:    10000,
    },

    dialectOptions: {
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    },
  });

} else {
  sequelize = new Sequelize(
    process.env.DB_NAME || 'democase_db',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASS || 'password',
    {
      host:    process.env.DB_HOST || 'localhost',
      port:    parseInt(process.env.DB_PORT) || 5432,
      dialect: 'postgres',
      logging: process.env.NODE_ENV === 'development'
        ? (sql) => { console.log(sql); }
        : false,
      pool: { max: 10, min: 2, acquire: 30000, idle: 10000 },
    }
  );
}

export async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('   Postgres connection established');
    return true;
  } catch (err) {
    console.error('  Cannot connect to Postgres:', err.message);
    return false;
  }
}

export default sequelize;