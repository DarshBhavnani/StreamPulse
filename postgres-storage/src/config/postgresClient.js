import { Pool } from 'pg'

// Use the environment variables defined in the root .env file
const PG_USER = process.env.PG_USER;
const PG_HOST = process.env.PG_HOST;
const PG_DATABASE = process.env.PG_DATABASE;
const PG_PASSWORD = process.env.PG_PASSWORD;
const PG_PORT = process.env.PG_PORT;

export const pgPool = new Pool({
    user: PG_USER,
    host: PG_HOST,
    database: PG_DATABASE,
    password: PG_PASSWORD,
    port: PG_PORT,
    connectionTimeoutMillis: 5000,
});

export async function createTables() {
    const createTicksTable = `
    CREATE TABLE IF NOT EXISTS ticks (
      id BIGSERIAL PRIMARY KEY,
      symbol TEXT NOT NULL,
      ts TIMESTAMPTZ NOT NULL,
      price NUMERIC(18,8) NOT NULL,
      volume NUMERIC(20,8),
      raw JSONB
    );
  `;

  const createCandlesTable = `
    CREATE TABLE IF NOT EXISTS candles (
      symbol TEXT NOT NULL,
      interval TEXT NOT NULL,            -- '1m', '1h', '1d'
      bucket_start TIMESTAMPTZ NOT NULL, -- start of candle window

      open NUMERIC(18,8) NOT NULL,
      high NUMERIC(18,8) NOT NULL,
      low NUMERIC(18,8) NOT NULL,
      close NUMERIC(18,8) NOT NULL,
      volume NUMERIC(20,8) NOT NULL DEFAULT 0,

      PRIMARY KEY (symbol, interval, bucket_start)
    );
  `;
    try {
        console.log("Creating ticks table...");
        await pgPool.query(createTicksTable);

        console.log("Creating candles table...");
        await pgPool.query(createCandlesTable);

        console.log("✅ Tables created successfully!");
    } catch (err) {
        console.error("❌ Error creating tables:", err);
    }
}