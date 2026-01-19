import React, { useEffect, useMemo, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import type { Chart as ChartJS } from 'chart.js';
import { fetchUmamiProxy } from '../../utils/apiUtils';

type Granularity = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

interface Point { label: string; value: number; key: string }

interface Props {
  exhibitionId: string;
  uiConfig: { lightsOn: boolean; text: string; subtext: string; border: string };
}

const TrafficTrendChart: React.FC<Props> = ({ exhibitionId, uiConfig }) => {
  const [granularity, setGranularity] = useState<Granularity>('daily');
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const type = granularity === 'hourly' ? 'hour' : 'day';
        const res = await fetchUmamiProxy(`?exhibitionId=${encodeURIComponent(exhibitionId)}&type=pageviews&groupBy=${type}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        
        // Umami v2 returns { pageviews: [{x: '...', y: 10}, ...], sessions: [...] }
        const pageviews = data.pageviews || (Array.isArray(data) ? data : []);
        
        if (mounted) {
          const formatted = pageviews.map((p: any) => ({
            label: p.x,
            value: p.y,
            key: p.x
          }));
          setPoints(formatted);
        }
      } catch (err) {
        console.error('[TrafficTrendChart] Fetch error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => { mounted = false; };
  }, [exhibitionId, granularity]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartJS | null>(null);

  useEffect(() => {
    if (!canvasRef.current || points.length === 0) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const { lightsOn } = uiConfig;
    const accentColor = '#f97316'; // orange-500

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, lightsOn ? 'rgba(249, 115, 22, 0.15)' : 'rgba(249, 115, 22, 0.1)');
    gradient.addColorStop(1, 'rgba(249, 115, 22, 0)');

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: points.map(p => p.label),
        datasets: [{
          label: 'Visitors',
          data: points.map(p => p.value),
          borderColor: accentColor,
          backgroundColor: gradient,
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: accentColor,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: lightsOn ? 'rgba(255, 255, 255, 0.9)' : 'rgba(18, 18, 18, 0.9)',
            titleColor: lightsOn ? '#000' : '#fff',
            bodyColor: lightsOn ? '#000' : '#fff',
            borderColor: lightsOn ? '#e5e5e5' : '#333',
            borderWidth: 1,
            padding: 12,
            displayColors: false,
            titleFont: { family: 'serif', size: 14 },
            bodyFont: { weight: 'bold', size: 12 },
            callbacks: {
              label: (context) => `${context.parsed.y} Visitors`
            }
          }
        },
        scales: {
          x: {
            display: true,
            grid: { display: false },
            ticks: {
              color: lightsOn ? '#999' : '#555',
              font: { size: 9, weight: 'bold' },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 7,
              padding: 10
            },
            border: { display: false }
          },
          y: {
            display: true,
            beginAtZero: true,
            grid: {
              color: lightsOn ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
            },
            ticks: {
              color: lightsOn ? '#999' : '#555',
              font: { size: 9, weight: 'bold' },
              maxTicksLimit: 5,
              padding: 10
            },
            border: { display: false }
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        }
      }
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [points, uiConfig]);

  return (
    <div className={`p-6 rounded-2xl border ${uiConfig.border} ${uiConfig.lightsOn ? 'bg-white' : 'bg-neutral-800/10'} flex flex-col h-full min-h-[400px]`}>
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-0.5">
          <h3 className={`text-[8px] font-bold uppercase tracking-[0.3em] ${uiConfig.subtext} opacity-50`}>Visitor Traffic</h3>
          <p className={`text-lg font-serif ${uiConfig.text}`}>Traffic Trend</p>
        </div>
        
        <select 
          value={granularity}
          onChange={(e) => setGranularity(e.target.value as Granularity)}
          className={`px-3 py-1.5 text-[11px] font-bold bg-transparent rounded-lg border ${uiConfig.border} ${uiConfig.text} outline-none focus:ring-1 focus:ring-orange-500/20`}
        >
          <option value="hourly">Hourly</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-black/20 backdrop-blur-sm z-10 transition-opacity">
            <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <canvas ref={canvasRef} />
        {!loading && points.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold opacity-30">No traffic data available</span>
          </div>
        )}
      </div>

      <div className={`mt-4 pt-4 border-t ${uiConfig.border} flex items-center justify-between`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span className={`text-[9px] font-bold uppercase tracking-tight ${uiConfig.subtext}`}>Visitors</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-[10px] font-mono ${uiConfig.text}`}>
            {points.reduce((a, b) => a + b.value, 0).toLocaleString()}
          </span>
          <span className={`text-[8px] font-bold ${uiConfig.subtext} opacity-50 uppercase`}>Total</span>
        </div>
      </div>
    </div>
  );
};

export default TrafficTrendChart;
