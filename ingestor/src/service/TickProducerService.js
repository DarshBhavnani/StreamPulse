export class TickProducerService {
  constructor(producer, topic) {
    this.producer = producer;
    this.topic = topic;
  }

  async send(event) {
    try {
      await this.producer.send({
        topic: this.topic,
        messages: [
          {
            key: event.symbol,
            value: JSON.stringify(event),
          },
        ],
      });

      console.log('[Kafka] Sent tick', event.symbol);
    } catch (err) {
      console.error('[Kafka] Failed to send message', err);
    }
  }
}
