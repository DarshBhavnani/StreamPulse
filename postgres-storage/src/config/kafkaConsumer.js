import { Kafka } from 'kafkajs';

const broker = process.env.KAFKA_BROKER;
const clientId = process.env.KAFKA_CLIENT_ID;
const groupId = process.env.KAFKA_GROUP_ID;

export function createKafkaConsumer() {
    const kafka = new Kafka({
        clientId: clientId,
        brokers: [broker],
    });

    const consumer = kafka.consumer({ groupId });
    return consumer;
}

