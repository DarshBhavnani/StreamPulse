// src/pages/Detail.jsx
import React, { useEffect, useState, useMemo, useRef } from 'react';
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
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';

import '../styles.css'; // <-- ensure this path matches your project structure

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, TimeScale, Tooltip, Legend);

export default function Detail(){
  const { symbol } = useParams();
  const [history, setHistory] = useState([]);        // array of { x: ms, y: number }
  const [livePrice, setLivePrice] = useState(null);
  const socketRef = useRef(null);
  const loadedRef = useRef(false);                   // indicates historical data has been loaded
  const bufferRef = useRef([]);                      // buffer ticks that arrive before history loaded

  // Helper: map/normalize rows to {x, y}
  function normalizeRows(rows) {
    const map = new Map();
    for (const r of rows || []) {
      const rawT = r.t ?? r.ts ?? r.timestamp ?? r.bucket_start ?? null;
      let t;
      if (typeof rawT === 'number') t = Number(rawT);
      else if (typeof rawT === 'string' && rawT.length > 8) t = new Date(rawT).getTime();
      else t = Number(rawT);

      const y = Number(r.y ?? r.close ?? r.price ?? r.lastPrice ?? r.p ?? NaN);

      if (!Number.isFinite(t) || !Number.isFinite(y)) continue;
      map.set(Number(t), { x: Number(t), y });
    }
    return Array.from(map.values()).sort((a, b) => a.x - b.x);
  }

  // 1) Fetch history first
  useEffect(() => {
    let mounted = true;
    loadedRef.current = false;
    bufferRef.current = [];

    fetchHistory(symbol, 200)
      .then(rows => {
        if (!mounted) return;

        const points = normalizeRows(rows);
        setHistory(points);
        loadedRef.current = true;

        // flush buffered live ticks (if any) - keep chronological order & dedupe by timestamp
        if (bufferRef.current.length > 0) {
          setHistory(prev => {
            const m = new Map(prev.map(p => [p.x, p]));
            for (const p of bufferRef.current) m.set(p.x, p);
            const merged = Array.from(m.values()).sort((a,b)=>a.x - b.x);
            return merged.slice(-2000);
          });
          bufferRef.current = [];
        }
      })
      .catch(err => {
        console.error('fetchHistory', err);
      });

    return () => { mounted = false; };
  }, [symbol]);

  // 2) Create socket subscription AFTER starting history fetch
  useEffect(() => {
    if (!socketRef.current) socketRef.current = connectSocket();
    const s = socketRef.current;

    const onConnect = () => {
      if (!symbol) return;
      s.emit('join-symbol', symbol);
    };
    s.on('connect', onConnect);

    const onTick = (data) => {
      if (!data) return;
      if (data.symbol && data.symbol !== symbol) return;

      const price = Number(data.price ?? data.lastPrice ?? data.p ?? data.y);
      const ts = Number(data.timestamp ?? data.t ?? Date.now());
      if (!Number.isFinite(price) || !Number.isFinite(ts)) return;

      setLivePrice(price);

      const newPoint = { x: ts, y: price };

      if (!loadedRef.current) {
        bufferRef.current.push(newPoint);
        if (bufferRef.current.length > 1000) bufferRef.current.shift();
        return;
      }

      setHistory(prev => {
        const last = prev[prev.length - 1];
        if (last && last.x === newPoint.x) {
          return [...prev.slice(0, -1), newPoint];
        }
        return [...prev, newPoint].slice(-2000);
      });
    };

    s.on('price-tick', onTick);

    if (s.connected && symbol) s.emit('join-symbol', symbol);

    return () => {
      s.off('connect', onConnect);
      s.off('price-tick', onTick);
    };
  }, [symbol]);

  // chart dataset
  const chartData = useMemo(() => ({
    datasets: [
      {
        label: `${symbol} price`,
        data: history, // array of { x: ms, y: number }
        fill: false,
        tension: 0.12,
        borderWidth: 2,
        borderColor: "rgba(255,159,64,1)",
        backgroundColor: "rgba(255,159,64,0.2)",
        pointRadius: 0,
        pointHoverRadius: 5,
        parsing: false,
      }
    ]
  }), [symbol, history]);

  // compute suggested min/max to increase vertical scaling for small deltas
  const options = useMemo(() => {
    const ys = history.map((p) => p.y).filter(Number.isFinite);
    let suggestedMin, suggestedMax;
    if (ys.length > 0) {
      const min = Math.min(...ys);
      const max = Math.max(...ys);
      const delta = Math.max((max - min) * 0.12, Math.abs(max) * 0.0005);
      suggestedMin = min - delta;
      suggestedMax = max + delta;
    }

    return {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: "time",
          time: {
            tooltipFormat: "PPpp",
            unit: "minute",
          },
          ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
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
        tooltip: {
          mode: "index",
          intersect: false,
        },
      },
      elements: {
        line: { borderJoinStyle: "round" },
      },
    };
  }, [history]);

  return (
    <div className="max-w-[1100px] mx-auto px-4 my-6">
      <div className="text-[1.75rem] font-bold text-center mb-2 text-white">{symbol}</div>

      <div className="text-center text-[#9fb0c8] mb-[18px]" aria-live="polite">
        <strong style={{ color: 'inherit' }}>Live:</strong>
        <span className="text-[#ffb86b] font-semibold ml-2">
          {livePrice ? Number(livePrice).toFixed(6) : '—'}
        </span>
      </div>

      <div 
        className="bg-[#09121a] rounded-xl p-3 h-[65vh] shadow-[0_6px_20px_rgba(0,0,0,0.45)]" 
        role="region" 
        aria-label={`${symbol} price chart`}
      >
        {/* The Line chart will fill the parent; maintainAspectRatio is false so it respects the card height */}
        <Line data={chartData} options={options} />
      </div>

    </div>
  );
}
