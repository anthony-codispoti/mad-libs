const { neon } = require('@neondatabase/serverless');

let sql = null;

function getDb() {
  if (sql) return sql;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED;
  if (!url) {
    throw new Error('DATABASE_URL (or POSTGRES_URL) is not set');
  }
  sql = neon(url);
  return sql;
}

module.exports = { getDb };
