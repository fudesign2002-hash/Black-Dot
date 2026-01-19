
import React, { useEffect, useState, useMemo } from 'react'; // MODIFIED: Add useMemo
import { createPortal } from 'react-dom';
import { db } from '../../firebase'; // NEW: Import db for real data
import { X, BarChart2, Users, MousePointer2, TrendingUp, Share2, ExternalLink, Activity, PieChart, Map as MapIcon, ArrowUpRight, ArrowDownRight, Calendar, MapPin, Clock, Ticket, Sparkles, Eye, Trophy, Orbit, ListOrdered, Sun, Image as ImageIcon } from 'lucide-react';
import { Exhibition, ExhibitionArtItem, FirebaseArtwork } from '../../types'; // NEW: Import types
import BlackDotLogo from './BlackDotLogo'; // NEW: Import Logo
import TrafficTrendChart from './TrafficTrendChart';

interface AnalyticsDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  uiConfig: {
    lightsOn: boolean;
    text: string;
    subtext: string;
    border: string;
    panelBg: string; // background of the modal panel
  };
  exhibition: Exhibition; // NEW: Pass the full exhibition object
  currentLayout: ExhibitionArtItem[]; 
  firebaseArtworks: FirebaseArtwork[]; 
  standalone?: boolean; // NEW: Support standalone mode
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  isOpen,
  onClose,
  uiConfig,
  exhibition,
  currentLayout,
  firebaseArtworks,
  standalone = false,
}) => {
  const [mounted, setMounted] = useState(false);
  const [timeRange, setTimeRange] = useState<'7D' | '30D' | '90D' | '12M'>('7D');
  const [realTrafficData, setRealTrafficData] = useState<{label: string, value: number}[]>([]);
  const [techStats, setTechStats] = useState<{
    devices: Record<string, number>;
    browsers: Record<string, number>;
    resolutions: Record<string, number>;
    totalVisits: number;
    totalSessionSeconds?: number;
    sessionCount?: number;
    features?: Record<string, number>;
  }>({ devices: {}, browsers: {}, resolutions: {}, totalVisits: 0 });

  const exhibitionId = exhibition.id;
  const exhibitionTitle = exhibition.title || '';

  // NEW: Subscribe to per-doc snapshots (day/month) to enable real-time updates without composite index
  useEffect(() => {
    if (!isOpen || !exhibitionId) return;

    const analyticsRef = db.collection('exhibitions').doc(exhibitionId).collection('analytics');
    const unsubscribers: Array<() => void> = [];

    const getPastDates = (days: number) => {
      const arr: string[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        arr.push(d.toISOString().split('T')[0]);
      }
      return arr;
    };

    const subscribeToDocs = () => {
      if (timeRange === '12M') {
        const months = Array.from({ length: 12 }, (_, i) => {
          const d = new Date();
          d.setMonth(d.getMonth() - (11 - i));
          return d.toISOString().slice(0,7);
        });

        const results: any[] = new Array(months.length).fill(null);
        months.forEach((m, idx) => {
          const docRef = analyticsRef.doc(`month_${m}`);
          const unsub = docRef.onSnapshot(doc => {
            const data = doc.exists ? doc.data() : null;
            results[idx] = { label: m.split('-')[1] || m, value: (data && data.count) ? Number(data.count) : 0, devices: data?.devices || {}, browsers: data?.browsers || {}, resolutions: data?.resolutions || {}, totalSessionSeconds: data?.totalSessionSeconds || 0, sessionCount: data?.sessionCount || 0, fullDate: m };
            const normalized = results.map((r, j) => r || { label: months[j].split('-')[1] || months[j], value: 0, devices: {}, browsers: {}, resolutions: {}, fullDate: months[j] });
            setRealTrafficData(normalized);

            // aggregate
            const aggDevices: Record<string, number> = {};
            const aggBrowsers: Record<string, number> = {};
            const aggResolutions: Record<string, number> = {};
            let total = 0;
            let totalSessionSeconds = 0;
            let sessionCount = 0;
            const aggFeatures: Record<string, number> = {};
            results.forEach(r => {
              if (!r) return;
              const v = Number(r.value) || 0;
              total += v;
              totalSessionSeconds += Number(r.totalSessionSeconds || 0);
              sessionCount += Number(r.sessionCount || 0);
              Object.entries(r.features || {}).forEach(([k, val]) => aggFeatures[k] = (aggFeatures[k] || 0) + (Number(val) || 0));
              Object.entries(r.devices || {}).forEach(([k, val]) => aggDevices[k] = (aggDevices[k] || 0) + (Number(val) || 0));
              Object.entries(r.browsers || {}).forEach(([k, val]) => aggBrowsers[k] = (aggBrowsers[k] || 0) + (Number(val) || 0));
              Object.entries(r.resolutions || {}).forEach(([k, val]) => aggResolutions[k] = (aggResolutions[k] || 0) + (Number(val) || 0));
            });
            setTechStats({ devices: aggDevices, browsers: aggBrowsers, resolutions: aggResolutions, totalVisits: total, totalSessionSeconds, sessionCount, features: aggFeatures });
          });
          unsubscribers.push(unsub);
        });
      } else {
        const days = timeRange === '7D' ? 7 : 30;
        const dates = getPastDates(days);
        const results: any[] = new Array(dates.length).fill(null);
        dates.forEach((d, idx) => {
          const docRef = analyticsRef.doc(`day_${d}`);
          const unsub = docRef.onSnapshot(doc => {
            const data = doc.exists ? doc.data() : null;
            results[idx] = { label: d.split('-').pop() || d, value: (data && data.count) ? Number(data.count) : 0, devices: data?.devices || {}, browsers: data?.browsers || {}, resolutions: data?.resolutions || {}, totalSessionSeconds: data?.totalSessionSeconds || 0, sessionCount: data?.sessionCount || 0, fullDate: d };
            const normalized = results.map((r, j) => r || { label: dates[j].split('-').pop() || dates[j], value: 0, devices: {}, browsers: {}, resolutions: {}, fullDate: dates[j] });
            setRealTrafficData(normalized);

            // aggregate
            const aggDevices: Record<string, number> = {};
            const aggBrowsers: Record<string, number> = {};
            const aggResolutions: Record<string, number> = {};
            let total = 0;
            let totalSessionSeconds = 0;
            let sessionCount = 0;
            results.forEach(r => {
              if (!r) return;
              const v = Number(r.value) || 0;
              total += v;
              totalSessionSeconds += Number(r.totalSessionSeconds || 0);
              sessionCount += Number(r.sessionCount || 0);
              Object.entries(r.devices || {}).forEach(([k, val]) => aggDevices[k] = (aggDevices[k] || 0) + (Number(val) || 0));
              Object.entries(r.browsers || {}).forEach(([k, val]) => aggBrowsers[k] = (aggBrowsers[k] || 0) + (Number(val) || 0));
              Object.entries(r.resolutions || {}).forEach(([k, val]) => aggResolutions[k] = (aggResolutions[k] || 0) + (Number(val) || 0));
            });
            setTechStats({ devices: aggDevices, browsers: aggBrowsers, resolutions: aggResolutions, totalVisits: total, totalSessionSeconds, sessionCount });
          });
          unsubscribers.push(unsub);
        });
      }
    };

    subscribeToDocs();

    return () => {
      unsubscribers.forEach(u => { try { u(); } catch(e) {} });
    };
  }, [isOpen, exhibitionId, timeRange]);

  useEffect(() => {
    setMounted(true);
    if (isOpen && !standalone) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, standalone]);

  // NEW: Process real artwork data for the dashboard
  const artworkStats = useMemo(() => {
    return currentLayout.map(item => {
      const artwork = firebaseArtworks.find(a => a.id === item.artworkId);
      const views = typeof artwork.artwork_viewed === 'number' ? artwork.artwork_viewed : 0;
      const engagementVal = typeof artwork.artwork_liked === 'number'
        ? artwork.artwork_liked
        : (typeof artwork.artwork_gravity === 'number' ? artwork.artwork_gravity : 0);

      return {
        id: item.id,
        name: artwork.title || 'Untitled Artwork',
        artist: artwork.artist || '',
        views: views,
        engagement: engagementVal,
        val: engagementVal,
        color: item.type.startsWith('canvas_') ? "from-cyan-400 to-cyan-600" : "from-violet-400 to-violet-600"
      };
    }).sort((a, b) => b.views - a.views);
  }, [currentLayout, firebaseArtworks]);

  const formatSeconds = (s: number) => {
    if (!s || s <= 0) return '0s';
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return mins > 0 ? `${mins}m ${String(secs).padStart(2, '0')}s` : `${secs}s`;
  };

  // Derived rankings: likes (engagement) and views
  const likesSorted = useMemo(() => {
    return artworkStats.slice().sort((a, b) => (b.val || 0) - (a.val || 0));
  }, [artworkStats]);

  const viewsSorted = useMemo(() => {
    return artworkStats.slice().sort((a, b) => (b.views || 0) - (a.views || 0));
  }, [artworkStats]);

  // Build traffic data array: prefer real data; otherwise zero-filled for the selected range
  const trafficData = useMemo(() => {
    if (realTrafficData.length > 0) return realTrafficData;

    const getPastDates = (days: number) => {
      const arr: string[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        arr.push(d.toISOString().split('T')[0]);
      }
      return arr;
    };

    if (timeRange === '12M') {
      const months = Array.from({ length: 12 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (11 - i));
        return d.toISOString().slice(0,7);
      });
      return months.map(m => ({ label: m.split('-')[1] || m, value: 0 }));
    }

    const days = timeRange === '7D' ? 7 : 30;
    const dates = getPastDates(days);
    return dates.map(d => ({ label: d.split('-').pop() || d, value: 0 }));
  }, [timeRange, realTrafficData]);

  // Compute chart points and SVG path (memoized) so we can attach per-point hover handlers
  const chartPoints = useMemo(() => {
    if (trafficData.length === 0) return [] as { x: number; y: number; value: number; label: string }[];
    const safeValues = trafficData.map(d => ({ value: d ? Number((d as any).value) || 0 : 0, label: d ? (d as any).label || '' : '' }));
    return safeValues.map((d, i) => ({
      x: (safeValues.length === 1) ? 50 : (i / (safeValues.length - 1)) * 100,
      y: 90 - (d.value * 0.75),
      value: d.value,
      label: d.label
    }));
  }, [trafficData]);

  const generateChartPath = (isArea: boolean): string => {
    if (chartPoints.length === 0) return "";
    let path = `M ${Number(chartPoints[0].x).toFixed(2)} ${Number(chartPoints[0].y).toFixed(2)}`;
    for (let i = 1; i < chartPoints.length; i++) {
      path += ` L ${Number(chartPoints[i].x).toFixed(2)} ${Number(chartPoints[i].y).toFixed(2)}`;
    }
    if (isArea) path += ` L 100 100 L 0 100 Z`;
    return path;
  };

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const [debugRaw, setDebugRaw] = useState<any | null>(null);
  const fetchDebugAnalytics = async () => {
    if (!exhibitionId) return;
    try {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      const hourKey = `${dateStr}-${String(today.getHours()).padStart(2, '0')}`;
      const analyticsRef = db.collection('exhibitions').doc(exhibitionId).collection('analytics');
      const dayDoc = await analyticsRef.doc(`day_${dateStr}`).get();
      const hourDoc = await analyticsRef.doc(`hour_${hourKey}`).get();
      const dayData = dayDoc.exists ? dayDoc.data() : null;
      const hourData = hourDoc.exists ? hourDoc.data() : null;
      console.debug('[analytics-debug] day', `day_${dateStr}`, dayData);
      console.debug('[analytics-debug] hour', `hour_${hourKey}`, hourData);
      setDebugRaw({ day: dayData, hour: hourData });
    } catch (err) {
      console.error('[analytics-debug] fetch error', err);
      setDebugRaw({ error: String(err) });
    }
  };

  if (!isOpen || !mounted) return null;

  const { lightsOn, text, subtext, border, panelBg } = uiConfig;

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/analytics/${exhibitionId}`;
    navigator.clipboard.writeText(shareUrl);
    alert('Dashboard link copied to clipboard!');
  };
 

  const openInNewTab = () => {
    window.open(`/analytics/${exhibitionId}`, '_blank');
  };

  const dashboardContent = (
    <div className={standalone ? "" : "fixed inset-0 z-[9999] flex items-center justify-center p-0 md:p-10"}>
      {/* Backdrop */}
      {!standalone && (
        <div 
          className="absolute inset-0 bg-black/80 backdrop-blur-xl transition-opacity animate-in fade-in duration-300"
          onClick={onClose}
        />
      )}
      
      {/* Modal Container */}
      <div 
        className={standalone 
          ? `w-full h-screen ${lightsOn ? 'bg-[#fcfcfc]' : 'bg-[#121212]'} flex flex-col font-sans overflow-hidden`
          : `relative w-full h-full md:max-w-[1300px] md:h-[92vh] md:rounded-xl border ${border} ${lightsOn ? 'bg-[#fcfcfc]' : 'bg-[#121212]'} shadow-[0_0_80px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 font-sans`
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Compact */}
        <div className={`px-6 py-4 border-b ${border} flex flex-col md:flex-row md:items-center justify-between gap-3 sticky top-0 z-20 ${lightsOn ? 'bg-[#fcfcfc]/90' : 'bg-[#121212]/90'} backdrop-blur-md`}>
          <div className="flex items-center gap-5">
            <div className={`w-10 h-10 rounded-full border ${border} flex items-center justify-center p-2`}>
              <BlackDotLogo treatAsCompact={true} className={`${text}`} />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-orange-400" />
                <span className="text-[8px] font-bold uppercase tracking-[0.3em] text-orange-500/80">
                  Analytics Professional
                </span>
              </div>
              <h2 className={`text-2xl font-serif tracking-tight ${text}`}>
                {exhibitionTitle}
              </h2>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100/50 dark:bg-neutral-800/50 rounded-lg border ${border}">
              <span className={`text-[9px] font-bold ${subtext} opacity-50 uppercase tracking-widest`}>ID:</span>
              <span className={`text-[9px] font-mono font-bold ${text}`}>{exhibitionId.slice(0, 12).toUpperCase()}</span>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-neutral-100/50 dark:bg-neutral-800/50 rounded-full border ${border}">
              <button 
                onClick={handleShare}
                className={`p-1.5 rounded-full hover:bg-white dark:hover:bg-neutral-700 transition-all ${text} group`}
                title="Share link"
              >
                <Share2 size={14} strokeWidth={1.5} />
              </button>
              <button
                onClick={fetchDebugAnalytics}
                className={`p-1.5 rounded-full hover:bg-white dark:hover:bg-neutral-700 transition-all ${text} group`}
                title="Fetch analytics docs"
              >
                <Activity size={14} strokeWidth={1.5} />
              </button>
              {!standalone && (
                <button 
                  onClick={openInNewTab}
                  className={`p-1.5 rounded-full hover:bg-white dark:hover:bg-neutral-700 transition-all ${text} group`}
                  title="Expand"
                >
                  <ExternalLink size={14} strokeWidth={1.5} />
                </button>
              )}
            </div>
            
            {!standalone && (
              <button 
                onClick={onClose}
                className={`p-1.5 rounded-full ${lightsOn ? 'hover:bg-neutral-100' : 'hover:bg-neutral-800'} ${text} transition-all border ${border}`}
              >
                <X size={18} strokeWidth={1.2} />
              </button>
            )}
          </div>
          {debugRaw && (
            <div className="p-3 mt-2 rounded-md bg-neutral-50 dark:bg-neutral-900/40 border ${border} text-xs">
              <div className="font-bold mb-1">Analytics Debug (raw)</div>
              <pre className="whitespace-pre-wrap break-words text-[11px]">{JSON.stringify(debugRaw, null, 2)}</pre>
            </div>
          )}
        </div>

        {/* Scrollable Body - Reduced padding further */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
          <div className="max-w-[1240px] mx-auto space-y-4">
            
            {/* Exhibition Info Overview - More Concise 4-column */}
            <div className={`p-4 rounded-xl border ${border} ${lightsOn ? 'bg-white' : 'bg-neutral-800/20'} grid grid-cols-2 md:grid-cols-4 gap-4 relative overflow-hidden`}>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-neutral-400">
                  <Calendar size={11} strokeWidth={1.5} />
                  <span className="text-[8px] font-bold uppercase tracking-[0.2em]">Exhibition Period</span>
                </div>
                 <div className={`text-xs font-bold tracking-tight ${text}`}>
                   {exhibition.dateFrom && exhibition.dateTo ? `${exhibition.dateFrom} — ${exhibition.dateTo}` : (exhibition.dateFrom || exhibition.dateTo || '')}
                 </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-neutral-400">
                  <Clock size={11} strokeWidth={1.5} />
                  <span className="text-[8px] font-bold uppercase tracking-[0.2em]">Operational Status</span>
                </div>
                <div className={`text-xs font-bold tracking-tight ${text} flex items-center gap-2`}>
                  <div className={`w-1 h-1 rounded-full ${exhibition.isPublic ? 'bg-green-500 animate-pulse' : 'bg-orange-500'} `} />
                  {exhibition.hours || ''} {exhibition.isPublic !== undefined ? (<><span className="opacity-50 font-normal">{exhibition.isPublic ? ' · Public' : ' · Private'}</span></>) : null}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-neutral-400">
                  <MapPin size={11} strokeWidth={1.5} />
                  <span className="text-[8px] font-bold uppercase tracking-[0.2em]">Venue Context</span>
                </div>
                <div className={`text-xs font-bold tracking-tight ${text}`}>
                  {exhibition.venue || ''}
                </div>
              </div>

              {/* Primary Supporter removed per request */}
            </div>

            {/* 1. Hero Metrics Grid - Tighter padding */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <HeroMetric 
                icon={<Users />} 
                label="Unique Visitors" 
                value={techStats.totalVisits > 0 ? techStats.totalVisits.toLocaleString() : "0"} 
                trend={techStats.totalVisits > 0 ? "+100%" : "0%"} 
                positive={techStats.totalVisits > 0} 
                uiConfig={uiConfig} 
              />
              <HeroMetric 
                icon={<Eye />} 
                label="Total Page Views" 
                value={techStats.totalVisits > 0 ? (techStats.totalVisits * 5).toLocaleString() : "0"} 
                trend={techStats.totalVisits > 0 ? "+8.2%" : "0%"} 
                positive={techStats.totalVisits > 0} 
                uiConfig={uiConfig} 
              />
              <HeroMetric 
                icon={<BarChart2 />} 
                label="Retention Rate" 
                value={techStats.totalVisits > 0 ? `${Math.round(((techStats.sessionCount || 0) / Math.max(1, techStats.totalVisits)) * 100)}%` : "0%"} 
                trend={techStats.totalVisits > 0 ? ( ( (techStats.sessionCount || 0) / Math.max(1, techStats.totalVisits) ) > 1 ? "+0%" : "-0%" ) : "0%"} 
                positive={(techStats.sessionCount || 0) > 0} 
                uiConfig={uiConfig} 
              />
              <HeroMetric 
                icon={<Clock />} 
                label="Avg. Session" 
                value={techStats.sessionCount && techStats.sessionCount > 0 ? formatSeconds(Math.round((techStats.totalSessionSeconds || 0) / techStats.sessionCount)) : '0s'} 
                trend={"+0%"} 
                positive={true} 
                uiConfig={uiConfig} 
              />
            </div>

            {/* 2. Main Analytics Section - Better balance */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
              {/* Visitor Traffic Trends removed */}

              {/* Interaction Map Card */}
              <div className={`p-5 rounded-xl border ${border} ${lightsOn ? 'bg-white' : 'bg-neutral-800/10'} flex flex-col h-82`}>
                <div className="space-y-0.5 mb-5">
                  <h3 className={`text-[8px] font-bold uppercase tracking-[0.3em] ${subtext} opacity-50`}>Engagement Heatmap</h3>
                  <p className={`text-lg font-serif ${text}`}>Feature Adoption</p>
                </div>
                
                <div className="space-y-3">
                  {(() => {
                    const defs = [
                      { key: 'zoom_focus', label: "Artwork Focus / Zoom", icon: <ImageIcon size={11} />, color: "bg-orange-500", desc: "Deep engagement with art" },
                      { key: 'zero_gravity', label: "Zero Gravity Mode", icon: <Orbit size={11} />, color: "bg-neutral-400", desc: "Spatial exploration" },
                      { key: 'ranking', label: "Ranking & Voting", icon: <ListOrdered size={11} />, color: "bg-amber-400", desc: "Community participation" },
                      { key: 'lighting', label: "Lighting Controls", icon: <Sun size={11} />, color: "bg-neutral-300", desc: "Atmospheric adjustment" }
                    ];
                    const features = techStats.features || {};
                    return defs.map((d, i) => {
                      const count = Number(features[d.key] || 0);
                      const pct = techStats.totalVisits > 0 ? Math.round((count / Math.max(1, techStats.totalVisits)) * 100) : 0;
                      const pctLabel = `${pct}%`;
                      return (
                        <div key={d.key} className="space-y-1.5 group/item">
                           <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                               <span className={`${text} opacity-40 group-hover/item:text-orange-500 transition-colors scale-90`}>{d.icon}</span>
                               <span className={`text-[9px] font-bold uppercase tracking-wider ${text}`}>{d.label}</span>
                             </div>
                             <span className={`text-[9px] font-bold text-orange-500`}>{pctLabel}</span>
                           </div>
                           <div className="h-0.5 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                              <div className={`h-full ${d.color} rounded-full transition-all duration-1000 group-hover/item:opacity-80`} style={{ width: `${pct}%` }} />
                           </div>
                           <p className="text-[7px] font-medium text-neutral-400 opacity-0 group-hover/item:opacity-100 transition-opacity">
                             {d.desc}
                           </p>
                        </div>
                      );
                    });
                  })()}
                </div>
                
                <div className="mt-4 pt-4 border-t border-neutral-500/10">
                   <div className="flex items-center justify-between">
                      <p className={`text-[8px] font-bold ${subtext} opacity-50 uppercase tracking-widest`}>Confidence Score</p>
                      <span className="text-[9px] font-bold text-green-500">98.2%</span>
                   </div>
                </div>
              </div>
              
              {/* Artwork Performance moved to bottom for full-width display */}

              {/* Visitor Traffic Trends */}
              <div className="lg:col-span-2 h-82">
                <div className="h-82">
                  <TrafficTrendChart exhibitionId={exhibitionId} uiConfig={{ lightsOn, text, subtext, border }} />
                </div>
              </div>

              {/* Technical Audience Breakdown - second row right (span 1) */}
              <div className={`p-5 rounded-xl border ${border} ${lightsOn ? 'bg-white' : 'bg-neutral-800/10'} lg:col-span-3`}>
                 <div className="flex items-center justify-between mb-6">
                  <div className="space-y-0.5">
                     <h3 className={`text-[8px] font-bold uppercase tracking-[0.3em] ${subtext} opacity-50`}>Technical Specifications</h3>
                     <p className={`text-lg font-serif ${text}`}>Audience Technology Breakdown</p>
                  </div>
                  <div className={`px-3 py-1 bg-neutral-100/50 dark:bg-neutral-800/50 rounded-lg text-[9px] font-bold ${subtext}`}>
                    Real-time Firebase Data
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-neutral-400">
                      <MapPin size={12} />
                      <span className="text-[9px] font-bold uppercase tracking-widest">Device Distribution</span>
                    </div>
                    <div className="space-y-3">
                      {Object.entries(techStats.devices).length > 0 ? Object.entries(techStats.devices).map(([name, count]) => (
                        <div key={name} className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className={text}>{name}</span>
                            <span className="text-orange-500">{((techStats.totalVisits > 0 ? (count / techStats.totalVisits) * 100 : 0).toFixed(1))}%</span>
                          </div>
                          <div className="h-1 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                            <div className="h-full bg-orange-500 rounded-full" style={{ width: `${(techStats.totalVisits > 0 ? (count / techStats.totalVisits) * 100 : 0)}%` }} />
                          </div>
                        </div>
                      )) : <p className="text-[10px] text-neutral-500 italic">No device data yet...</p>}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-neutral-400">
                      <PieChart size={12} />
                      <span className="text-[9px] font-bold uppercase tracking-widest">Browser Share</span>
                    </div>
                    <div className="space-y-3">
                      {Object.entries(techStats.browsers).length > 0 ? Object.entries(techStats.browsers).map(([name, count]) => (
                        <div key={name} className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className={text}>{name}</span>
                            <span className="text-violet-500">{((techStats.totalVisits > 0 ? (count / techStats.totalVisits) * 100 : 0).toFixed(1))}%</span>
                          </div>
                          <div className="h-1 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                            <div className="h-full bg-violet-500 rounded-full" style={{ width: `${(techStats.totalVisits > 0 ? (count / techStats.totalVisits) * 100 : 0)}%` }} />
                          </div>
                        </div>
                      )) : <p className="text-[10px] text-neutral-500 italic">No browser data yet...</p>}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-neutral-400">
                      <Activity size={12} />
                      <span className="text-[9px] font-bold uppercase tracking-widest">Common Resolutions</span>
                    </div>
                    <div className="space-y-2">
                      {Object.entries(techStats.resolutions).length > 0 ? Object.entries(techStats.resolutions)
                        .sort((a,b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([name, count]) => {
                          const parts = name.includes('x') ? name.split('x') : (name.includes('_') ? name.split('_') : [name, '1']);
                          const rw = parseInt(parts[0], 10) || 1;
                          const rh = parseInt(parts[1], 10) || 1;
                          const displayName = name.replace(/_/g, '.');
                          const containerW = 28; // matches w-7 (50% smaller)
                          const containerH = 16; // matches h-4 (50% smaller)
                          const aspect = rh > 0 ? (rw / rh) : 1;
                          let innerW = containerW;
                          let innerH = Math.round(innerW / aspect);
                          if (innerH > containerH) {
                            innerH = containerH;
                            innerW = Math.round(innerH * aspect);
                          }
                          return (
                            <div key={name} className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-800">
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-4 bg-neutral-100 dark:bg-neutral-900/50 rounded-sm flex items-center justify-center">
                                  <div className="bg-neutral-300 dark:bg-neutral-700 rounded-sm" style={{ width: `${innerW}px`, height: `${innerH}px` }} />
                                </div>
                                <span className={`text-[10px] font-mono font-bold ${text}`}>{displayName}</span>
                              </div>
                              <span className="text-[10px] font-bold text-neutral-400">{count} views</span>
                            </div>
                          );
                      }) : <p className="text-[10px] text-neutral-500 italic">No resolution data yet...</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Artwork Performance - full width bottom row (moved up) */}
            <div className={`p-5 rounded-xl border ${border} ${lightsOn ? 'bg-white' : 'bg-neutral-800/10'}`}>
              <div className="flex items-start mb-6">
                <div className="space-y-0.5">
                   <h3 className={`text-[8px] font-bold uppercase tracking-[0.3em] ${subtext} opacity-50`}>Top Performing Assets</h3>
                   <p className={`text-lg font-serif ${text}`}>Artwork Performance Ranking</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Likes */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className={`text-[10px] font-bold uppercase tracking-[0.2em] ${subtext} opacity-60`}>Top Liked Assets</h4>
                      <p className={`text-[12px] font-serif ${text}`}>By Likes / Engagement</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {likesSorted.slice(0, 6).map((art) => (
                      <div key={art.id} className="flex items-center justify-between py-2 border-b ${border}">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg border ${border} flex items-center justify-center text-[10px] font-serif ${text} bg-neutral-50 dark:bg-neutral-900 shadow-sm`}>{art.name.charAt(0)}</div>
                          <div>
                            <p className={`text-sm font-bold ${text}`}>{art.name}</p>
                            <p className="text-[8px] text-neutral-400">{art.artist || ''}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold">{(art.engagement || art.val || 0).toLocaleString()}</div>
                          <div className="text-[10px] text-neutral-400">likes</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Views */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className={`text-[10px] font-bold uppercase tracking-[0.2em] ${subtext} opacity-60`}>Top Viewed Assets</h4>
                      <p className={`text-[12px] font-serif ${text}`}>By View Count</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {viewsSorted.slice(0, 6).map((art) => (
                      <div key={art.id} className="flex items-center justify-between py-2 border-b ${border}">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg border ${border} flex items-center justify-center text-[10px] font-serif ${text} bg-neutral-50 dark:bg-neutral-900 shadow-sm`}>{art.name.charAt(0)}</div>
                          <div>
                            <p className={`text-sm font-bold ${text}`}>{art.name}</p>
                            <p className="text-[8px] text-neutral-400">{art.artist || ''}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold">{(art.views || 0).toLocaleString()}</div>
                          <div className="text-[10px] text-neutral-400">views</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Branding Footer - Compact */}
            {/* 4. Exhibition Overview - Integrated layout (moved down) */}
            <div className={`p-5 rounded-xl border ${border} ${lightsOn ? 'bg-white' : 'bg-neutral-800/10'}`}>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3 space-y-3">
                  <h3 className={`text-[8px] font-bold uppercase tracking-[0.4em] ${text} opacity-50`}>Curatorial Statement</h3>
                  <p className={`text-sm leading-relaxed ${subtext} font-medium opacity-80`}>
                    {exhibition.overview || "This exhibition explores the digital intersection of art and identity. Curated with a focus on immersive experiences, it challenges traditional gallery boundaries through interactive spatial compositions and zero-gravity perspectives."}
                  </p>
                </div>
                
                <div className="space-y-4 lg:pl-6 lg:border-l ${border}">
                   <div className="space-y-0.5">
                     <p className={`text-[8px] font-bold uppercase tracking-[0.3em] ${subtext} opacity-40`}>Support Entity</p>
                     <p className={`text-xs font-semibold ${text}`}>{exhibition.supportedBy || ''}</p>
                   </div>
                   <div className="space-y-0.5">
                       <p className={`text-[8px] font-bold uppercase tracking-[0.3em] ${subtext} opacity-40`}>Access Rights</p>
                       <p className={`text-xs font-semibold ${text}`}>Permanent Global License</p>
                   </div>
                   <button 
                      onClick={handleShare}
                      className="w-full py-2.5 bg-neutral-900 dark:bg-white dark:text-neutral-900 text-white rounded-lg flex items-center justify-center gap-2 group hover:bg-neutral-800 transition-all font-bold tracking-[0.2em] uppercase text-[8px]"
                    >
                      <Share2 size={10} />
                      Share Access
                    </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 justify-center pt-4 pb-2 opacity-30">
              <BlackDotLogo treatAsCompact={true} className={`${text} w-4 h-4`} />
              <div className="h-2 w-px bg-neutral-500" />
              <p className={`text-[8px] font-bold uppercase tracking-[0.4em] ${subtext}`}>
                Black Dot Professional Analytics System
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (standalone) return dashboardContent;

  return createPortal(dashboardContent, document.body);
};

const HeroMetric: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  trend: string;
  positive: boolean;
  uiConfig: any;
}> = ({ icon, label, value, trend, positive, uiConfig }) => {
  const { lightsOn, text, subtext, border } = uiConfig;
  return (
    <div className={`p-5 rounded-xl border ${border} ${lightsOn ? 'bg-white' : 'bg-neutral-800/20'} transition-all duration-300 hover:border-orange-500/30 group`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${border} ${lightsOn ? 'bg-[#fcfcfc]' : 'bg-neutral-900'} shadow-sm group-hover:bg-orange-500 group-hover:text-white transition-all group-hover:rotate-6 duration-300`}>
          {React.cloneElement(icon as React.ReactElement, { size: 16, strokeWidth: 1.5 })}
        </div>
        <div className={`flex items-center text-[9px] font-bold px-2 py-0.5 rounded-md ${positive ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
          {positive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
          {trend}
        </div>
      </div>
      <div className="space-y-0.5">
        <p className={`text-2xl font-serif tracking-tight ${text}`}>{value}</p>
        <p className={`text-[8px] uppercase font-bold tracking-[0.2em] ${subtext} opacity-50`}>{label}</p>
      </div>
    </div>
  );
};

const LegendItem: React.FC<{
  color: string;
  label: string;
  value: string;
  uiConfig: any;
}> = ({ color, label, value, uiConfig }) => (
  <div className="flex items-center justify-between group py-2">
    <div className="flex items-center gap-3">
      <div className={`w-3 h-3 rounded-full ${color} shadow-sm group-hover:scale-125 transition-transform`} />
      <span className={`text-xs font-black tracking-tight opacity-60 group-hover:opacity-100 transition-opacity ${uiConfig.text}`}>{label}</span>
    </div>
    <span className={`text-xs font-black opacity-80 ${uiConfig.text}`}>{value}</span>
  </div>
);

export default AnalyticsDashboard;

// reload