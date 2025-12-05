export function toMs(tsRaw) {
  if (tsRaw == null) return null;
  const v = Number(tsRaw);
  if (Number.isFinite(v)) {
    // if already ms (> 1e12) assume ms, if small assume seconds
    return v < 1e12 ? Math.round(v * 1000) : Math.round(v);
  }
  // try parse as ISO string
  const d = new Date(tsRaw);
  if (!isNaN(d.getTime())) return d.getTime();
  return null;
}

export function normalizeTick(tick) {
  // Input can be { symbol, price, volume, timestamp } or other variants.
  const symbol = tick.symbol ?? tick.s ?? tick.sym;
  const price = Number(tick.price ?? tick.p ?? tick.lastPrice ?? tick.y ?? NaN);
  const ts = toMs(tick.timestamp ?? tick.ts ?? tick.t);
  if (!symbol || !Number.isFinite(price) || !Number.isFinite(ts)) return null;
  return { symbol, price, volume: Number(tick.volume ?? tick.v ?? 0), ts };
}
