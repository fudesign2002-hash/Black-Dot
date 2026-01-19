import React, { useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../../firebase';
import Chart from 'chart.js/auto';
import type { Chart as ChartJS } from 'chart.js';

type Granularity = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

interface Point { label: string; value: number; key: string }

interface Props {
  exhibitionId: string;
  uiConfig: { lightsOn: boolean; text: string; subtext: string; border: string };
}

const formatDate = (d: Date) => d.toISOString().slice(0, 10);

const startOfWeek = (d: Date) => {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = (day + 6) % 7; // make Monday the start
  copy.setDate(copy.getDate() - diff);
  copy.setHours(0,0,0,0);
  return copy;
};

const isoMonth = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const TrafficTrendChart: React.FC<Props> = ({ exhibitionId, uiConfig }) => {
  const [granularity, setGranularity] = useState<Granularity>('daily');
  const [points, setPoints] = useState<Point[]>([]);

  useEffect(() => {
    if (!exhibitionId) return;
    const analyticsRef = db.collection('exhibitions').doc(exhibitionId).collection('analytics');
    const unsubscribes: Array<() => void> = [];

    const subscribeDailyDocs = (days: number) => {
      const dates: string[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(formatDate(d));
      }

      const state: Record<string, number | null> = {};
      dates.forEach(d => state[d] = null);

      dates.forEach(d => {
        const doc = analyticsRef.doc(`day_${d}`);
        const unsub = doc.onSnapshot(snap => {
          const data = snap.exists ? snap.data() : null;
          state[d] = data && typeof data.count === 'number' ? Number(data.count) : 0;
          const out = dates.map(label => ({ label: label.split('-').pop() || label, value: state[label] || 0, key: label }));
          setPoints(out);
        });
        unsubscribes.push(unsub);
      });
    };

    const subscribeMonthDocs = (months: number) => {
      const monthsArr: string[] = [];
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        monthsArr.push(isoMonth(d));
      }

      const state: Record<string, number | null> = {};
      monthsArr.forEach(m => state[m] = null);

      monthsArr.forEach(m => {
        const doc = analyticsRef.doc(`month_${m}`);
        const unsub = doc.onSnapshot(snap => {
          const data = snap.exists ? snap.data() : null;
          state[m] = data && typeof data.count === 'number' ? Number(data.count) : 0;
          const out = monthsArr.map(label => ({ label: label.split('-')[1] || label, value: state[label] || 0, key: label }));
          setPoints(out);
        });
        unsubscribes.push(unsub);
      });
    };

    // Weekly and quarterly/yearly aggregate from smaller docs
    const subscribeForGranularity = (g: Granularity) => {
      unsubscribes.forEach(u => u());
      unsubscribes.length = 0;

      if (g === 'hourly') {
        // subscribe last 24 hours
        const hours = 24;
        const hoursArr: string[] = [];
        for (let i = hours - 1; i >= 0; i--) {
          const d = new Date();
          d.setHours(d.getHours() - i, 0, 0, 0);
          const datePart = d.toISOString().slice(0,10);
          const hourPart = String(d.getHours()).padStart(2, '0');
          hoursArr.push(`${datePart}-${hourPart}`);
        }

        const state: Record<string, number> = {};
        hoursArr.forEach(h => state[h] = 0);

        hoursArr.forEach(h => {
          const doc = analyticsRef.doc(`hour_${h}`);
          const unsub = doc.onSnapshot(snap => {
            const data = snap.exists ? snap.data() : null;
            state[h] = data && typeof data.count === 'number' ? Number(data.count) : 0;
            const out = hoursArr.map(label => ({ label: label.split('-').pop() || label, value: state[label] || 0, key: label }));
            setPoints(out);
          });
          unsubscribes.push(unsub);
        });
        return;
      }
      if (g === 'daily') return subscribeDailyDocs(30);
      if (g === 'weekly') {
        // subscribe last 84 days and bucket into 12 weeks
        const days = 84;
        const dates: string[] = [];
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          dates.push(formatDate(d));
        }
        const state: Record<string, number> = {};
        dates.forEach(d => state[d] = 0);

        dates.forEach(d => {
          const doc = analyticsRef.doc(`day_${d}`);
          const unsub = doc.onSnapshot(snap => {
            const data = snap.exists ? snap.data() : null;
            state[d] = data && typeof data.count === 'number' ? Number(data.count) : 0;
            // bucket into weeks starting Monday
            const buckets: { key: string; label: string; total: number }[] = [];
            const seen: Record<string, number> = {};
            dates.forEach(dateStr => {
              const parts = dateStr.split('-').map(Number);
              const dd = new Date(parts[0], parts[1]-1, parts[2]);
              const s = formatDate(startOfWeek(dd));
              seen[s] = (seen[s] || 0) + (state[dateStr] || 0);
            });
            const keys = Object.keys(seen).sort();
            keys.forEach(k => buckets.push({ key: k, label: k.split('-').slice(1).join('/'), total: seen[k] }));
            setPoints(buckets.map(b => ({ label: b.label, value: b.total, key: b.key })));
          });
          unsubscribes.push(unsub);
        });
        return;
      }

      if (g === 'monthly') return subscribeMonthDocs(12);

      if (g === 'quarterly') {
        // subscribe past 24 months then bucket by quarter (8 quarters)
        const months = 24;
        const monthsArr: string[] = [];
        for (let i = months - 1; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          monthsArr.push(isoMonth(d));
        }
        const state: Record<string, number> = {};
        monthsArr.forEach(m => state[m] = 0);

        monthsArr.forEach(m => {
          const doc = analyticsRef.doc(`month_${m}`);
          const unsub = doc.onSnapshot(snap => {
            const data = snap.exists ? snap.data() : null;
            state[m] = data && typeof data.count === 'number' ? Number(data.count) : 0;
            const seen: Record<string, number> = {};
            monthsArr.forEach(monthStr => {
              const [y, mm] = monthStr.split('-').map(Number);
              const q = Math.floor((mm - 1) / 3) + 1;
              const key = `${y}-Q${q}`;
              seen[key] = (seen[key] || 0) + (state[monthStr] || 0);
            });
            const keys = Object.keys(seen).sort();
            const out = keys.map(k => ({ label: k, value: seen[k], key: k }));
            setPoints(out);
          });
          unsubscribes.push(unsub);
        });
        return;
      }

      if (g === 'yearly') {
        // subscribe past 60 months and aggregate by year (5 years)
        const months = 60;
        const monthsArr: string[] = [];
        for (let i = months - 1; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          monthsArr.push(isoMonth(d));
        }
        const state: Record<string, number> = {};
        monthsArr.forEach(m => state[m] = 0);

        monthsArr.forEach(m => {
          const doc = analyticsRef.doc(`month_${m}`);
          const unsub = doc.onSnapshot(snap => {
            const data = snap.exists ? snap.data() : null;
            state[m] = data && typeof data.count === 'number' ? Number(data.count) : 0;
            const seen: Record<string, number> = {};
            monthsArr.forEach(monthStr => {
              const y = Number(monthStr.split('-')[0]);
              const key = String(y);
              seen[key] = (seen[key] || 0) + (state[monthStr] || 0);
            });
            const keys = Object.keys(seen).sort();
            const out = keys.map(k => ({ label: k, value: seen[k], key: k }));
            setPoints(out);
          });
          unsubscribes.push(unsub);
        });
        return;
      }
    };

    subscribeForGranularity(granularity);

    return () => {
      unsubscribes.forEach(u => { try { u(); } catch(e) {} });
    };
  }, [exhibitionId, granularity]);

  const max = useMemo(() => points.reduce((m, p) => Math.max(m, p.value || 0), 0), [points]);

  // Prepare layout and derived points so JSX can safely reference them
  const layout = useMemo(() => {
    const w = 100; const h = 40; const left = 0; const right = 0; const top = 4; const bottom = 6;
    const usableW = w - left - right; const usableH = h - top - bottom;
    if (!points || points.length === 0) return { pts: [] as {x:number;y:number}[], d: '', left, right, top, usableH, w, h };
    const n = points.length;
    const pts = points.map((p, i) => {
      const x = n === 1 ? left + usableW / 2 : left + (i / (n - 1)) * usableW;
      const y = top + (max === 0 ? usableH : (1 - (p.value / Math.max(1, max))) * usableH);
      return { x, y };
    });
    let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`;
    return { pts, d, left, right, top, usableH, w, h };
  }, [points, max]);

  const { d: pathD, left, right, top, usableH } = layout;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<ChartJS | null>(null);

  // Build labels and data arrays from points
  const labels = useMemo(() => points.map(p => p.label), [points]);
  const dataValues = useMemo(() => points.map(p => Number(p.value || 0)), [points]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    if (!chartRef.current) {
      chartRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Visitors',
            data: dataValues,
            borderColor: '#F97316',
            backgroundColor: 'rgba(249,115,22,0.06)',
            borderWidth: 1,
            pointRadius: 0,
            tension: 0.2,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { display: true, grid: { display: false }, ticks: { maxRotation: 0 } },
            y: { display: true, grid: { color: '#F3F4F6' }, beginAtZero: true }
          },
          plugins: { legend: { display: false } }
        }
      });
      return () => { try { chartRef.current?.destroy(); chartRef.current = null; } catch(e) {} };
    }

    // update
    chartRef.current.data.labels = labels as any;
    (chartRef.current.data.datasets[0].data as any) = dataValues as any;
    chartRef.current.update();
  }, [labels, dataValues]);

  return (
    <div className={`p-5 rounded-xl border ${uiConfig.border} ${uiConfig.lightsOn ? 'bg-white' : 'bg-neutral-800/10'}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className={`text-[8px] font-bold uppercase tracking-[0.25em] ${uiConfig.subtext} opacity-50`}>Visitor Traffic</h4>
          <p className={`text-lg font-serif ${uiConfig.text}`}>Traffic Trend</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={granularity} onChange={e => setGranularity(e.target.value as Granularity)} className="text-[11px] px-3 py-1 rounded border bg-white">
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
      </div>

      <div className="w-full h-60">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
    </div>
  );
};

export default TrafficTrendChart;
// touch