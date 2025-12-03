import { Pool } from 'pg';


export const pgPool = new Pool({
  user: process.env.PG_USER || 'user',
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DATABASE || 'stock_db',
  password: process.env.PG_PASSWORD || 'password',
  port: process.env.PG_PORT || 5432,
});