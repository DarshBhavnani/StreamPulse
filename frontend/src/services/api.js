const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function fetchTokens() {
  const res = await fetch(`${API}/tokens`);
  if (!res.ok) throw new Error('Failed to fetch tokens');
  return res.json(); // expect array of symbols
}

export async function fetchHistory(symbol, limit = 200) {
  const res = await fetch(`${API}/history/${encodeURIComponent(symbol)}?limit=${limit}`);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Failed history: ${res.status} ${txt}`);
  }
  const rows = await res.json();
  // server returns rows like [{ price, ts_ms }] or [{ price, ts_ms }, ...]
  // normalize and return as plain array
  return rows;
}
