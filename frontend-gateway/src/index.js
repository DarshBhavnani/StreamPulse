import express from 'express';
import http from'http';
import { Server } from 'socket.io';
import { createRedisClient } from './config/redisClient.js';
import { pgPool } from './config/postgresClient.js';


const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const redisSubscriber = createRedisClient();
const redisQueryClient = createRedisClient();

let priceBuffer = {};

async function start() {
  await redisSubscriber.subscribe('live-updates');
  redisSubscriber.on('message', (channel, message) => {
    if (channel === 'live-updates') {
      const data = JSON.parse(message);
      console.log("[frontend-service] received message from redis: ", data);
      priceBuffer[data.symbol] = data; 
    }
  });

  const BROADCAST_INTERVAL = 800; 
  
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

  socket.on('request-history', async ({ symbol, limit }) => {
    try {
      const res = await pgPool.query(
        'SELECT * FROM ticks WHERE symbol = $1 ORDER BY timestamp DESC LIMIT $2',
        [symbol, limit || 100]
      );
      socket.emit('history-data', res.rows);
    } catch (err) {
      console.error('Postgres Query Error:', err);
    }
  });

  socket.on('request-active-symbols', async () => {
    try {
      const keys = await redisQueryClient.keys('*');
      socket.emit('active-symbols', keys);
    } catch (err) {
      console.error('Redis Keys Error:', err);
      socket.emit('error', 'Failed to fetch symbols');
    }
  });
});


server.listen(3000, () => {
  console.log('Gateway running with Throttling Service');
});

start();