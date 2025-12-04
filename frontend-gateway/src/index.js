import express from 'express';
import http from'http';
import { Server } from 'socket.io';
import { createRedisClient } from './config/redisClient.js';
import { pgPool } from './config/postgresClient.js';
import cors from 'cors';

const app = express();
app.use(cors({
  origin: "*",
}));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const redisSubscriber = createRedisClient();
const redisQueryClient = createRedisClient();

let priceBuffer = {};

app.get('/tokens', async (req, res) => {
  try {
    const result = await pgPool.query('SELECT DISTINCT symbol FROM ticks');
    const tokens = result.rows.map(row => row.symbol);
    res.json(tokens);
  } catch (err) {
    console.error('Postgres Token Error:', err);
    res.status(500).json({ error: 'Failed to fetch tokens' });
  }
});

// GET /history/BTCUSDT?limit=50
app.get('/history/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const limit = parseInt(req.query.limit) || 100;

    const result = await pgPool.query(
      'SELECT symbol, price, ts FROM ticks WHERE symbol = $1 ORDER BY ts DESC LIMIT $2',
      [symbol, limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Postgres History Error:', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});


async function start() {
  await redisSubscriber.subscribe('live-updates');
  redisSubscriber.on('message', (channel, message) => {
    if (channel === 'live-updates') {
      const data = JSON.parse(message);
      console.log("[frontend-service] received message from redis: ", data);
      priceBuffer[data.symbol] = data; 
    }
  });

  const BROADCAST_INTERVAL = 400; 
  
  setInterval(() => {
    const symbols = Object.keys(priceBuffer);

    if (symbols.length > 0) {
      console.log(`[frontend-gateway]: Broadcasting updates for ${symbols.length} symbols...`);
      
      symbols.forEach((symbol) => {
        const data = priceBuffer[symbol];
        io.to(symbol).emit('price-tick', data);
      });
    }
  }, BROADCAST_INTERVAL);
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-symbol', (symbol) => {
    socket.join(symbol);
    console.log(`User ${socket.id} joined ${symbol}`);
  });
});


server.listen(3000, () => {
  console.log('Gateway running with Throttling Service');
});

start();