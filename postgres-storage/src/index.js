import { createKafkaConsumer } from "./config/kafkaConsumer.js";
import { createTables, pgPool } from "./config/postgresClient.js";

const consumer = createKafkaConsumer();
const topic = process.env.KAFKA_TOPIC;

const tickBuffer = [];
const FLUSH_INTERVAL_MS = 400;


function getBucketStart(date, interval) {
  const d = new Date(date);

  if (interval === "1m") {
    d.setSeconds(0, 0);
  } else if (interval === "1h") {
    d.setMinutes(0, 0, 0);
  } else if (interval === "1d") {
    d.setUTCHours(0, 0, 0, 0);
  }

  return d;
}

async function updateCandles(batch) {
  const intervals = ["1m", "1h", "1d"];
  const candleMap = new Map();

  for (const tick of batch) {
    const symbol = tick.symbol;
    const price = Number(tick.price);
    const volume = Number(tick.volume ?? 0);
    const ts = new Date(tick.timestamp);

    for (const interval of intervals) {
      const bucketStart = getBucketStart(ts, interval);
      const key = `${symbol}-${interval}-${bucketStart.toISOString()}`;

      if (!candleMap.has(key)) {
        candleMap.set(key, {
          symbol,
          interval,
          bucketStart,
          open: price,
          high: price,
          low: price,
          close: price,
          volume
        });
      } else {
        const c = candleMap.get(key);
        c.high = Math.max(c.high, price);
        c.low = Math.min(c.low, price);
        c.close = price;
        c.volume += volume;
      }
    }
  }

  const candles = Array.from(candleMap.values());
  if (candles.length === 0) return;

  const params = [];
  const values = candles
    .map((c, i) => {
      const base = i * 8;
      params.push(
        c.symbol,        // $1
        c.interval,      // $2
        c.bucketStart,   // $3
        c.open,          // $4
        c.high,          // $5
        c.low,           // $6
        c.close,         // $7
        c.volume         // $8
      );
      return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8})`;
    })
    .join(",");

  const q = `
    INSERT INTO candles (
      symbol, interval, bucket_start,
      open, high, low, close, volume
    )
    VALUES ${values}
    ON CONFLICT (symbol, interval, bucket_start)
    DO UPDATE SET
      high   = GREATEST(candles.high, EXCLUDED.high),
      low    = LEAST(candles.low, EXCLUDED.low),
      close  = EXCLUDED.close,
      volume = candles.volume + EXCLUDED.volume;
  `;

  await pgPool.query(q, params);
}

async function flushBatch() {
  if (tickBuffer.length === 0) return;

  const batch = tickBuffer.splice(0, tickBuffer.length);

  const tickParams = [];
  const tickValues = batch
    .map((tick, i) => {
      const base = i * 5;
      tickParams.push(
        tick.symbol,
        new Date(tick.timestamp),
        Number(tick.price),
        Number(tick.volume ?? 0),
        tick
      );
      return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5})`;
    })
    .join(",");

  const tickQuery = `
    INSERT INTO ticks (symbol, ts, price, volume, raw)
    VALUES ${tickValues}
  `;

  await pgPool.query(tickQuery, tickParams);

  // ---- 2. Batch update all candles ----
  await updateCandles(batch);

  console.log(`[Postgres] Flushed batch (${batch.length} ticks)`);
}


async function runConsumer() {
  await consumer.connect();
  console.log("[Postgres Storage] Connected to Kafka");

  await consumer.subscribe({ topics: [topic] });
  console.log("[Postgres Storage] Subscribed to:", topic);

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const tick = JSON.parse(message.value.toString());
        tickBuffer.push(tick);
      } catch (err) {
        console.error("[Postgres] Error parsing message:", err);
      }
    },
  });
}


await createTables();  
console.log("[Postgres Storage] Tables ready.");

setInterval(flushBatch, FLUSH_INTERVAL_MS);

runConsumer().catch(err => {
  console.error("[Postgres Storage] Fatal error:", err);
  process.exit(1);
});
