import { createKafkaConsumer } from "./config/kafkaConsumer.js";
import { createTables, pgPool } from "./config/postgresClient.js";

const consumer = createKafkaConsumer();
const topic = process.env.KAFKA_TOPIC;
const pg = pgPool;

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

async function handleTickMessage(message) {

  const tick = JSON.parse(message.value.toString());

  const symbol = tick.symbol;
  const price = Number(tick.price);
  const volume = Number(tick.volume ?? 0);
  const ts = new Date(tick.timestamp);

  await pg.query(
    `
    INSERT INTO ticks (symbol, ts, price, volume, raw)
    VALUES ($1, $2, $3, $4, $5)
    `,
    [symbol, ts, price, volume, tick]
  );

  const intervals = ["1m", "1h", "1d"];

  for (const interval of intervals) {
    const bucketStart = getBucketStart(ts, interval);

    await pg.query(
      `
      INSERT INTO candles (
        symbol, interval, bucket_start,
        open, high, low, close, volume
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (symbol, interval, bucket_start) DO UPDATE
      SET high   = GREATEST(candles.high, EXCLUDED.high),
          low    = LEAST(candles.low,  EXCLUDED.low),
          close  = EXCLUDED.close,
          volume = candles.volume + EXCLUDED.volume;
      `,
      [
        symbol,
        interval,
        bucketStart,
        price,
        price,
        price,
        price,
        volume,
      ]
    );
  }
}

async function runConsumer() {
  await consumer.connect();
  console.log("[Postgres Storage] Kafka consumer connected");

  await consumer.subscribe({ topics: [topic] });
  console.log("[Postgres Storage] Subscribed to topic:", topic);

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        await handleTickMessage(message);
        console.log("[Postgres] Inserted tick");
      } catch (error) {
        console.error("[Postgres Storage] Error storing data:", error);
      }
    },
  });
}

await createTables();
await runConsumer();
