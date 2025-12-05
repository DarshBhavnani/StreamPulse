import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

import { createRedisClient } from './config/redisClient.js';
import { pgPool } from './config/postgresClient.js';
import { normalizeTick } from './utils.js';

const PORT = Number(process.env.PORT || 3000);
const REDIS_CHANNEL = process.env.REDIS_CHANNEL || 'live-updates';
const LATEST_PREFIX = process.env.REDIS_LATEST_PREFIX || 'latest';
const BROADCAST_INTERVAL_MS = Number(process.env.BROADCAST_INTERVAL_MS ?? 400);

const app = express();
app.use(cors({ origin: '*' }));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

let redisSub;
let redisQuery;

// price buffer: latest tick per symbol (ts in ms, price)
const priceBuffer = new Map();

// track per-socket subscriptions if needed (socket.io rooms handles fanout)
io.on('connection', (socket) => {
  console.log('[ws] connect', socket.id);

  socket.on('join-symbol', async (symbol) => {
    if (!symbol) return;
    socket.join(symbol);
    console.log(`[ws] ${socket.id} joined ${symbol}`);

    // send immediate snapshot from Redis latest:<symbol> if exists
    try {
        const tick = await redisQuery.get(`${LATEST_PREFIX}:${symbol}`);
        if (tick) socket.emit('price-tick', tick);

    } catch (err) {
      console.error('[ws] error fetching latest', err);
    }
  });

  socket.on('leave-symbol', (symbol) => {
    socket.leave(symbol);
  });

  socket.on('disconnect', () => {
    console.log('[ws] disconnect', socket.id);
  });
});

// HTTP endpoints
app.get('/tokens', async (req, res) => {
  try {
    // prefer a cached/active-set in redis if you have one; fallback to PG distinct
    const r = await pgPool.query('SELECT DISTINCT symbol FROM ticks LIMIT 1000');
    const tokens = r.rows.map(r => r.symbol);
    res.json(tokens);
  } catch (err) {
    console.error('[http] tokens error', err);
    res.status(500).json({ error: 'failed' });
  }
});

app.get('/history/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol;
    const limit = Math.max(1, Math.min(5000, Number(req.query.limit ?? 500)));
    // return epoch ms for ts to make frontend simple
    const q = `
      SELECT price, (EXTRACT(EPOCH FROM ts) * 1000)::bigint AS ts_ms
      FROM ticks
      WHERE symbol = $1
      ORDER BY ts DESC
      LIMIT $2
    `;
    const r = await pgPool.query(q, [symbol, limit]);
    // return as [{ price, ts_ms }, ...] (desc). Frontend will normalize.
    res.json(r.rows);
  } catch (err) {
    console.error("[history error]", err);
    res.status(500).json({ error: 'failed' });
  }
});

async function start() {
  redisSub = createRedisClient();
  redisQuery = createRedisClient();

  // wait for ready (ioredis emits 'ready' or 'connect' but createRedisClient logs on connect)
  await new Promise((resolve) => setTimeout(resolve, 200)); // tiny wait for connections

  // subscribe
  await redisSub.subscribe(REDIS_CHANNEL);
  redisSub.on('message', (channel, message) => {
    if (channel !== REDIS_CHANNEL) return;
    try {
      const parsed = JSON.parse(message);
      const norm = normalizeTick(parsed);
      if (!norm) return;
      // keep latest per symbol; prefer latest ts
      const existing = priceBuffer.get(norm.symbol);
      if (!existing || norm.ts >= existing.ts) {
        priceBuffer.set(norm.symbol, { price: norm.price, ts: norm.ts });
      }
    } catch (err) {
      console.error('[redis] invalid message', err);
    }
  });

  // periodic broadcasting - throttle to control fanout
  setInterval(() => {
    if (priceBuffer.size === 0) return;
    const now = Date.now();
    priceBuffer.forEach((val, symbol) => {
      // emit: standardize shape frontend expects
      io.to(symbol).emit('price-tick', { symbol, price: val.price, timestamp: val.ts ?? now });
    });
  }, BROADCAST_INTERVAL_MS);

  server.listen(PORT, () => {
    console.log(`[gateway] listening on ${PORT}`);
  });

  // graceful shutdown
  const cleanup = async () => {
    console.log('[gateway] shutting down...');
    try { await redisSub.disconnect(); } catch {}
    try { await redisQuery.disconnect(); } catch {}
    try { await pgPool.end(); } catch {}
    try { server.close(); } catch {}
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

start().catch(err => {
  console.error('[gateway] start error', err);
  process.exit(1);
});
