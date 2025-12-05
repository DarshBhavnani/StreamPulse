// src/pages/Detail.jsx
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { fetchHistory } from '../services/api';
import { connectSocket } from '../services/socket';

import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  TimeScale,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, TimeScale, Tooltip, Legend);

const DEFAULT_HISTORY_LIMIT = 500;
const MAX_POINTS = 2000; // keep chart bounded

function toMs(raw) {
  if (raw == null) return null;
  const n = Number(raw);
  if (Number.isFinite(n)) {
    return n < 1e12 ? Math.round(n * 1000) : Math.round(n);
  }
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.getTime();
  return null;
}

// normalize server rows into { x: ms, y: number }
// supports rows like { price, ts_ms } or { price, ts } or { price, timestamp } or { close, bucket_start }
function normalizeRows(rows = []) {
  const map = new Map();
  for (const r of rows) {
    // find timestamp field
    const rawT = r.ts_ms ?? r.ts ?? r.timestamp ?? r.t ?? r.bucket_start ?? null;
    const rawP = r.price ?? r.close ?? r.y ?? r.lastPrice ?? r.p ?? r.value ?? null;

    const t = toMs(rawT);
    const y = Number(rawP);

    if (!Number.isFinite(t) || !Number.isFinite(y)) continue;
    // dedupe by timestamp (latest wins)
    map.set(Number(t), { x: Number(t), y });
  }
  // return sorted ascending
  return Array.from(map.values()).sort((a, b) => a.x - b.x);
}

export default function Detail() {
  const { symbol } = useParams();
  const [history, setHistory] = useState([]); // array of {x:ms, y:number}
  const [livePrice, setLivePrice] = useState(null);
  const socketRef = useRef(null);
  const loadedRef = useRef(false);
  const bufferRef = useRef([]); // holds {x,y} before history loaded

  // Fetch history once per symbol
  useEffect(() => {
    let mounted = true;
    loadedRef.current = false;
    bufferRef.current = [];
    setHistory([]);
    setLivePrice(null);

    fetchHistory(symbol, DEFAULT_HISTORY_LIMIT)
      .then((rows) => {
        if (!mounted) return;
        const points = normalizeRows(rows);
        setHistory(points);
        loadedRef.current = true;

        // flush buffered live ticks (dedupe by timestamp)
        if (bufferRef.current.length > 0) {
          setHistory((prev) => {
            const m = new Map(prev.map((p) => [p.x, p]));
            for (const p of bufferRef.current) m.set(p.x, p);
            const merged = Array.from(m.values()).sort((a, b) => a.x - b.x);
            // keep last MAX_POINTS
            return merged.slice(-MAX_POINTS);
          });
          bufferRef.current = [];
        }
      })
      .catch((err) => {
        console.error('fetchHistory error', err);
        // leave loadedRef false — we will still accept live ticks into buffer
      });

    return () => {
      mounted = false;
    };
  }, [symbol]);

  // Setup socket connection once (singleton) and event handlers per symbol
  useEffect(() => {
    if (!socketRef.current) socketRef.current = connectSocket();
    const s = socketRef.current;

    const onConnect = () => {
      if (symbol) s.emit('join-symbol', symbol);
    };
    s.on('connect', onConnect);

    const onTick = (data) => {
      if (!data) return;
      // Ensure data belongs to this symbol (some gateways may broadcast many)
      if (data.symbol && data.symbol !== symbol) return;

      const price = Number(data.price ?? data.p ?? data.lastPrice ?? data.y);
      const tsRaw = data.timestamp ?? data.ts ?? data.t ?? Date.now();
      const ts = toMs(tsRaw);
      if (!Number.isFinite(price) || !Number.isFinite(ts)) return;

      setLivePrice(price);

      const point = { x: ts, y: price };

      if (!loadedRef.current) {
        // buffer until history loads
        bufferRef.current.push(point);
        // keep buffer bounded
        if (bufferRef.current.length > 2000) bufferRef.current.shift();
        return;
      }

      // Insert into chart history (dedupe on exact timestamp)
      setHistory((prev) => {
        if (!prev || prev.length === 0) return [point];
        const last = prev[prev.length - 1];
        if (last && last.x === point.x) {
          // replace last
          return [...prev.slice(0, -1), point];
        }
        const merged = [...prev, point].slice(-MAX_POINTS);
        return merged;
      });
    };

    s.on('price-tick', onTick);

    // if already connected, join room immediately
    if (s.connected && symbol) s.emit('join-symbol', symbol);

    return () => {
      s.off('connect', onConnect);
      s.off('price-tick', onTick);
      if (symbol && s.connected) s.emit('leave-symbol', symbol);
    };
  }, [symbol]);

  // Chart dataset
  const chartData = useMemo(() => {
    return {
      datasets: [
        {
          label: `${symbol} price`,
          data: history, // array of {x:ms, y:num}
          fill: false,
          tension: 0.12,
          borderWidth: 2,
          borderColor: 'rgba(255,159,64,1)',
          backgroundColor: 'rgba(255,159,64,0.2)',
          pointRadius: 0,
          pointHoverRadius: 6,
          parsing: false, // we're supplying x/y directly
        },
      ],
    };
  }, [symbol, history]);

  // Chart options — compute suggested min/max to make small deltas visible
  const options = useMemo(() => {
    const ys = history.map((p) => p.y).filter(Number.isFinite);
    let suggestedMin, suggestedMax;
    if (ys.length > 0) {
      const min = Math.min(...ys);
      const max = Math.max(...ys);
      const delta = Math.max((max - min) * 0.12, Math.abs(max) * 0.0005, 1e-8);
      suggestedMin = min - delta;
      suggestedMax = max + delta;
    }

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      scales: {
        x: {
          type: 'time',
          time: {
            tooltipFormat: 'PPpp',
            unit: 'minute',
          },
          ticks: { autoSkip: true, maxRotation: 0, maxTicksLimit: 12 },
        },
        y: {
          beginAtZero: false,
          suggestedMin,
          suggestedMax,
          ticks: { maxTicksLimit: 8 },
        },
      },
      plugins: {
        legend: { display: true },
        tooltip: { mode: 'index', intersect: false },
      },
      elements: { line: { borderJoinStyle: 'round' } },
    };
  }, [history]);

  return (
    <div className="max-w-[1100px] mx-auto px-4 my-6" style={{ color: '#cbd5e1' }}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <h1 style={{ fontSize: '1.75rem', margin: 0 }}>{symbol}</h1>
        <div style={{ color: '#9fb0c8', marginTop: 6 }}>
          <strong style={{ color: 'inherit' }}>Live:</strong>{' '}
          <span style={{ color: '#ffb86b', fontWeight: 600, marginLeft: 8 }}>
            {livePrice ? Number(livePrice).toFixed(6) : '—'}
          </span>
        </div>
      </div>

      <div
        style={{
          background: '#09121a',
          borderRadius: 12,
          padding: 12,
          height: '65vh',
          boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
        }}
        role="region"
        aria-label={`${symbol} price chart`}
      >
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
