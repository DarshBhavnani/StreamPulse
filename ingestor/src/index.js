import { createKafkaProducer } from './config/kafkaConfig.js';
import { TickProducerService } from './service/TickProducerService.js';
import { TickWebSocketClient } from './service/TickWebSocketClient.js';

const wsUrl = process.env.WS_URL || 'wss://ws-fapi.binance.com/ws-fapi/v1';
const topic = process.env.KAFKA_TOPIC || 'tick-events';

async function main() {
  const producer = await createKafkaProducer();
  const tickProducerService = new TickProducerService(producer, topic);
  const wsClient = new TickWebSocketClient(wsUrl, tickProducerService);
  wsClient.connect();
}

main().catch((err) => {
  console.error('Fatal error in main()', err);
  process.exit(1);
});
