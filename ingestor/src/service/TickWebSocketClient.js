import WebSocket from 'ws';

export class TickWebSocketClient {
  constructor(wsUrl, tickProducerService) {
    this.wsUrl = wsUrl;
    this.tickProducerService = tickProducerService;
    this.ws = null;
  }

  connect() {
    console.log('[WS] Connecting to Binance WS API v1:', this.wsUrl);
    this.ws = new WebSocket(this.wsUrl);

    this.ws.on('open', () => {
      console.log('[WS] Connected');
      this.sendAllTickersRequest();
      setInterval(() => this.sendAllTickersRequest(), 1000);
    });

    this.ws.on('message', (data) => {
      const text = data.toString();
      this.handleMessage(text).catch((err) => {
        console.error('[WS] Error handling message', err);
      });
    });

    this.ws.on('error', (err) => {
      console.error('[WS] Error', err);
    });

    this.ws.on('close', () => {
      console.warn('[WS] Closed, reconnecting in 5s');
      setTimeout(() => this.connect(), 5000);
    });
  }

  sendAllTickersRequest() {
    const req = {
      id: 'all-tickers',
      method: 'ticker.price',
      params: {},
    };

    this.ws.send(JSON.stringify(req));
  }

  async handleMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return;
    }

    if (!msg.result || !msg.status || msg.status !== 200) {
      return;
    }

    const result = msg.result;

    if (Array.isArray(result)) {
      for (const node of result) {
        await this.publishTicker(node);
      }
    } else if (typeof result === 'object' && result.symbol) {
      await this.publishTicker(result);
    }
  }

  async publishTicker(node) {
    const event = {
      symbol: node.symbol,
      price: parseFloat(node.price),
      volume: 0,
      timestamp: node.time,
    };

    await this.tickProducerService.send(event);
  }
}
