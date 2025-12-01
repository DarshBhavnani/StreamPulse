import { Kafka } from 'kafkajs';

const broker = process.env.KAFKA_BROKER || 'localhost:9092';
const clientId = process.env.KAFKA_CLIENT_ID || 'redis-storage';
const groupId = process.env.KAFKA_GROUP_ID || 'redis-consumer';

export function createKafkaConsumer() {
    const kafka = new Kafka({
        clientId: clientId,
        brokers: [broker],
    });

    const consumer = kafka.consumer({ groupId });
    return consumer;
}

