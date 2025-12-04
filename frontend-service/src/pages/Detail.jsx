import React, { useEffect, useState, useMemo } from 'react';
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

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, TimeScale, Tooltip, Legend);

export default function Detail(){
  const { symbol } = useParams();
  const [history, setHistory] = useState([]);
  const [livePrice, setLivePrice] = useState(null);

  useEffect(() => {
    let mounted = true;
    fetchHistory(symbol, 200)
      .then(rows => {
        if (!mounted) return;
        // Expect rows with bucket_start, open, high, low, close etc. Adjust mapping to your DB schema

        const map = new Map();
        for (const r of rows) {
          const t = Number(r.ts ?? 0);
          const y = Number(r.price ?? 0);
          if (!Number.isFinite(t) || !Number.isFinite(y)) continue;
          // if bucket_start was a string, convert to ms
          const ts = String(r.bucket_start || "").length > 8 && isNaN(r.t)
            ? new Date(r.bucket_start).getTime()
            : t;
          map.set(Number(ts), { x: Number(ts), y: y });
        }

        // convert map -> array sorted ascending by timestamp
        const points = Array.from(map.values()).sort((a, b) => a.x - b.x);
        setHistory(points);
        console.log(points);
      })
      .catch(err => console.error('fetchHistory', err));
    return () => { mounted = false; };
  }, [symbol]);

  useEffect(() => {
    const s = connectSocket();
    const onTick = (data) => {
      if (!data || data.symbol !== symbol) return;
      const price = Number(data.price ?? data.lastPrice ?? data.p ?? data.y);
      const ts = Number(data.timestamp ?? data.t ?? Date.now());
      setLivePrice(price);
      setHistory((prev) => {
        const newPoint = { x: ts, y: price };
        const last = prev[prev.length - 1];
        if (last && last.x === newPoint.x) {
          // replace last if timestamp same
          return [...prev.slice(0, -1), newPoint];
        }
        return [...prev, newPoint].slice(-1000); // keep last N points
      });
    };
    s.on('price-tick', onTick);
    // join the room for this token
    s.emit('join-symbol', symbol);
    return () => {
      s.off('price-tick', onTick);
    };
  }, [symbol]);

  // chart dataset
  const chartData = useMemo(() => {
    return {
      datasets: [
        {
          label: `${symbol} price`,
          data: history, // array of { x: ms, y: number }
          fill: false,
          tension: 0.12,
          borderWidth: 2,
          borderColor: "rgba(255,159,64,1)", // visible orange
          backgroundColor: "rgba(255,159,64,0.2)",
          pointRadius: 0,
          pointHoverRadius: 5,
          parsing: false, // important: data already in {x,y} form
        },
      ],
    };
  }, [symbol, history]);

  // compute suggested min/max to increase vertical scaling for small deltas
  const options = useMemo(() => {
    const ys = history.map((p) => p.y).filter(Number.isFinite);
    let suggestedMin, suggestedMax;
    if (ys.length > 0) {
      const min = Math.min(...ys);
      const max = Math.max(...ys);
      const delta = Math.max((max - min) * 0.12, Math.abs(max) * 0.0005); // small cushion
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  return (
    <div>
      <h2>{symbol}</h2>
      <div style={{ marginBottom: 12 }}>
        <strong>Live:</strong> {livePrice ? Number(livePrice).toFixed(6) : '—'}
      </div>

      <div style={{ height: "50vh", width: '100%', maxWidth: 1100, margin: "0 auto" }}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}