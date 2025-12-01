import { Kafka } from 'kafkajs';

const broker = process.env.KAFKA_BROKER || 'localhost:9092';
const clientId = 'ws-ingestor-node';

export async function createKafkaProducer() {
  const kafka = new Kafka({
    clientId,
    brokers: [broker],
  });

  const producer = kafka.producer();
  await producer.connect();
  console.log('[Kafka] Producer connected:', [broker]);
  return producer;
}
