import { createKafkaConsumer } from "./config/kafkaConsumer.js";
import { createRedisClient } from "./config/redisClient.js";

const consumer = createKafkaConsumer();
const topic = process.env.KAFKA_TOPIC; 
const redis = createRedisClient();

async function storePrice(tick) {
    const key = tick.symbol;
    const value = tick.price.toString();
    await redis.set(key, value);
    console.log(`[Redis] Updated: ${key} = ${value}`);
} 

async function runConsumer() {
    await consumer.connect()

    await consumer.subscribe({ topics: [topic] });
    
    await consumer.run({
        eachMessage: async ({ message }) => {
            try {
                const tick = JSON.parse(message.value.toString());
                await storePrice(tick);
            } catch (error) {
                console.error("[Redis Storage] Error storing data:", error.message);
            }
        },
    })
}

runConsumer();