import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000
});

export async function fetchTokens() {
  return api.get('/tokens').then(r => r.data);
}

export async function fetchHistory(symbol, limit = 200) {
  return api.get(`/history/${encodeURIComponent(symbol)}?limit=${limit}`).then(r => r.data);
}
