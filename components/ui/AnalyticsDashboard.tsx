
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Chart from 'chart.js/auto';
import { X, BarChart2, Users, MousePointer2, TrendingUp, Share2, ExternalLink, Activity, PieChart, Map as MapIcon, ArrowUpRight, ArrowDownRight, Calendar, MapPin, Clock, Ticket, Sparkles, Eye, Trophy, Orbit, ListOrdered, Sun, Image as ImageIcon, Monitor, Smartphone, Globe, Info } from 'lucide-react';
import { Exhibition, ExhibitionArtItem, FirebaseArtwork } from '../../types'; // NEW: Import types
import BlackDotLogo from './BlackDotLogo'; // NEW: Import Logo
import TrafficTrendChart from './TrafficTrendChart';
import { fetchUmamiProxy } from '../../utils/apiUtils';
import { countryCodeToFlag, getCountryName } from '../../utils/locationUtils';

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
  onlineCount?: number; // NEW: Pass the real-time pusher count
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  isOpen,
  onClose,
  uiConfig,
  exhibition,
  currentLayout,
  firebaseArtworks,
  standalone = false,
  onlineCount = 0,
}) => {
  const [mounted, setMounted] = useState(false);
  const [timeRange, setTimeRange] = useState<'24H' | '7D' | '30D' | '90D' | '12M'>('24H');
  const [umamiStats, setUmamiStats] = useState<{
    pageviews: any;
    visitors: any;
    visits: any;
    bounces: any;
    totaltime: any;
  } | null>(null);
  
  const [techStats, setTechStats] = useState<{
    devices: any[];
    browsers: any[];
    screens: any[];
  }>({
    devices: [],
    browsers: [],
    screens: []
  });
  
  const [locationStats, setLocationStats] = useState<{
    countries: any[];
    regions: any[];
    cities: any[];
  }>({
    countries: [],
    regions: [],
    cities: []
  });
  
  const [umamiEvents, setUmamiEvents] = useState<any[]>([]);

  const exhibitionId = exhibition.id;
  const exhibitionTitle = exhibition.title || '';

  // NEW: Fetch Umami Analytics data
  useEffect(() => {
    if (!isOpen || !exhibitionId) return;

    const fetchUmamiData = async () => {
      console.group(`📊 [Analytics Dashboard] Loading data for: ${exhibitionTitle}`);
      console.log(`- Exhibition ID: ${exhibitionId}`);
      console.log(`- Filter Path: /exhibition/${exhibitionId}`);
      console.log(`- Time Range: ${timeRange}`);

      const timeRangeMs = {
        '24H': 24 * 60 * 60 * 1000,
        '7D': 7 * 24 * 60 * 60 * 1000,
        '30D': 30 * 24 * 60 * 60 * 1000,
        '90D': 90 * 24 * 60 * 60 * 1000,
        '12M': 365 * 24 * 60 * 60 * 1000,
      }[timeRange as string] || 7 * 24 * 60 * 60 * 1000;

      const now = Date.now();
      const startTimestamp = now - timeRangeMs;
      // Remove exhibitionId from fetch params for now to avoid filtering issues while keeping it in tracking
      const commonParams = `&start=${startTimestamp}&end=${now}&_t=${now}`;

      console.log('[Umami-In] Requesting Global Stats (Filter disabled)');

      try {
        // Fetch summary stats
        const statsRes = await fetchUmamiProxy(`?type=stats${commonParams}`);
        if (statsRes.ok) {
          const stats = await statsRes.json();
          console.log('✅ Received Stats:', stats);
          setUmamiStats(stats);
        }

        // Fetch metrics in parallel
        const [deviceRes, browserRes, screenRes, eventRes, countryRes, regionRes, cityRes] = await Promise.all([
          fetchUmamiProxy(`?type=metrics&metric=device${commonParams}`),
          fetchUmamiProxy(`?type=metrics&metric=browser${commonParams}`),
          fetchUmamiProxy(`?type=metrics&metric=screen${commonParams}`),
          fetchUmamiProxy(`?type=metrics&metric=event${commonParams}`),
          fetchUmamiProxy(`?type=metrics&metric=country${commonParams}`),
          fetchUmamiProxy(`?type=metrics&metric=region${commonParams}`),
          fetchUmamiProxy(`?type=metrics&metric=city${commonParams}`)
        ]);

        const [devices, browsers, screens, events, countries, regions, cities] = await Promise.all([
          deviceRes.ok ? deviceRes.json().then(d => Array.isArray(d) ? d : []) : Promise.resolve([]),
          browserRes.ok ? browserRes.json().then(d => Array.isArray(d) ? d : []) : Promise.resolve([]),
          screenRes.ok ? screenRes.json().then(d => Array.isArray(d) ? d : []) : Promise.resolve([]),
          eventRes.ok ? eventRes.json().then(d => Array.isArray(d) ? d : []) : Promise.resolve([]),
          countryRes.ok ? countryRes.json().then(d => Array.isArray(d) ? d : []) : Promise.resolve([]),
          regionRes.ok ? regionRes.json().then(d => Array.isArray(d) ? d : []) : Promise.resolve([]),
          cityRes.ok ? cityRes.json().then(d => Array.isArray(d) ? d : []) : Promise.resolve([])
        ]);

        console.log('✅ Received Metrics:', { devices, browsers, screens, events, countries });

        setUmamiEvents(events);
        setLocationStats({ 
          countries: Array.isArray(countries) ? countries : [], 
          regions: Array.isArray(regions) ? regions : [], 
          cities: Array.isArray(cities) ? cities : [] 
        });

        // Fallback: If device distribution is empty, try OS distribution
        if (Array.isArray(devices) && devices.length === 0) {
          const osRes = await fetchUmamiProxy(`?type=metrics&metric=os${commonParams}`);
          if (osRes.ok) {
            const osData = await osRes.json();
            setTechStats({ 
              devices: Array.isArray(osData) ? osData : [], 
              browsers: Array.isArray(browsers) ? browsers : [], 
              screens: Array.isArray(screens) ? screens : [] 
            });
          } else {
            setTechStats({ 
              devices: [], 
              browsers: Array.isArray(browsers) ? browsers : [], 
              screens: Array.isArray(screens) ? screens : [] 
            });
          }
        } else {
          setTechStats({ 
            devices: Array.isArray(devices) ? devices : [], 
            browsers: Array.isArray(browsers) ? browsers : [], 
            screens: Array.isArray(screens) ? screens : [] 
          });
        }
      } catch (err) {
        console.error('[Analytics] Failed to fetch Umami data:', err);
      } finally {
        console.groupEnd();
      }
    };

    fetchUmamiData();
  }, [isOpen, exhibitionId, timeRange, exhibitionTitle]);

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

  // Derived rankings: likes (engagement) and views
  const likesSorted = useMemo(() => {
    return (artworkStats as any[]).slice().sort((a, b) => (b.val || 0) - (a.val || 0));
  }, [artworkStats]);

  const viewsSorted = useMemo(() => {
    return (artworkStats as any[]).slice().sort((a, b) => (b.views || 0) - (a.views || 0));
  }, [artworkStats]);

  // NEW: Process feature adoption data from events
  const featureAdoption = useMemo(() => {
    const getCount = (names: string[]) => {
      if (!Array.isArray(umamiEvents)) return 0;
      return umamiEvents
        .filter(e => names.some(n => e.x?.toLowerCase() === n.toLowerCase() || e.x?.toLowerCase() === n.toLowerCase().replace(/ /g, '-')))
        .reduce((acc, curr) => acc + curr.y, 0);
    };

    const rawData = [
      { id: 'focus', names: ['Focus-Artwork', 'zoom'], label: 'ARTWORK FOCUS / ZOOM' },
      { id: 'zeroG', names: ['Zero-Gravity', 'Zero-Gravity-Mode'], label: 'ZERO GRAVITY MODE' },
      { id: 'ranking', names: ['Ranking-Mode', 'vote', 'like_artwork'], label: 'RANKING & VOTING' },
      { id: 'lighting', names: ['Light-Toggle', 'lighting'], label: 'LIGHTING CONTROLS' },
      { id: 'info', names: ['Exhibit-Info', 'info_open'], label: 'EXHIBIT INFO VIEW' },
    ].map(f => ({ ...f, count: getCount(f.names) }));

    const totalEngagementCount = rawData.reduce((acc, curr) => acc + curr.count, 0) || 1;

    return rawData.map(f => ({
      ...f,
      pct: Math.round((f.count / totalEngagementCount) * 100)
    })).sort((a, b) => b.count - a.count);
  }, [umamiEvents]);

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

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

            {/* 1. Hero Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <HeroMetric 
                icon={<Activity />} 
                label="Online Now" 
                value={onlineCount.toString()} 
                trend={"Real-time"} 
                positive={onlineCount > 0} 
                uiConfig={uiConfig} 
              />
              <HeroMetric 
                icon={<Users />} 
                label="Visitors" 
                value={umamiStats ? (typeof umamiStats.visitors === 'object' ? (umamiStats.visitors as any).value : umamiStats.visitors).toLocaleString() : "0"} 
                trend={"+0%"} 
                positive={true} 
                uiConfig={uiConfig} 
              />
              <HeroMetric 
                icon={<Activity />} 
                label="Visits" 
                value={umamiStats ? (typeof umamiStats.visits === 'object' ? (umamiStats.visits as any).value : (umamiStats.visits || 0)).toLocaleString() : "0"} 
                trend={"+0%"} 
                positive={true} 
                uiConfig={uiConfig} 
              />
              <HeroMetric 
                icon={<Eye />} 
                label="Views" 
                value={umamiStats ? (typeof umamiStats.pageviews === 'object' ? (umamiStats.pageviews as any).value : umamiStats.pageviews).toLocaleString() : "0"} 
                trend={"+0%"} 
                positive={true} 
                uiConfig={uiConfig} 
              />
              <HeroMetric 
                icon={<BarChart2 />} 
                label="Bounce rate" 
                value={umamiStats ? (() => {
                  const v = (obj: any) => typeof obj === 'object' ? obj.value : (obj || 0);
                  const bounces = v(umamiStats.bounces);
                  const visits = v(umamiStats.visits);
                  const rate = Math.round((bounces / Math.max(1, visits)) * 100);
                  return `${rate}%`;
                })() : "0%"} 
                trend={"0%"} 
                positive={false} 
                uiConfig={uiConfig} 
              />
              <HeroMetric 
                icon={<Clock />} 
                label="Visit duration" 
                value={umamiStats ? (() => {
                  const v = (obj: any) => typeof obj === 'object' ? obj.value : (obj || 0);
                  const totalSeconds = Math.round(v(umamiStats.totaltime) / Math.max(1, v(umamiStats.visits)));
                  const mins = Math.floor(totalSeconds / 60);
                  const secs = totalSeconds % 60;
                  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
                })() : '0s'} 
                trend={"0%"} 
                positive={true} 
                uiConfig={uiConfig} 
              />
            </div>

            {/* 2. Engagement & Traffic Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              {/* Feature Adoption / Heatmap */}
              <div className={`lg:col-span-4 p-6 rounded-2xl border ${border} ${lightsOn ? 'bg-white' : 'bg-neutral-800/10'} flex flex-col justify-between`}>
                <div className="space-y-6">
                  <div className="space-y-0.5">
                    <h3 className={`text-[8px] font-bold uppercase tracking-[0.3em] ${subtext} opacity-50`}>Engagement Heatmap</h3>
                    <p className={`text-lg font-serif ${text}`}>Feature Adoption</p>
                  </div>

                  <div className="space-y-7 py-2">
                    {featureAdoption.map((feature, i) => (
                      <div key={feature.id} className="space-y-3">
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-3">
                             {feature.id === 'focus' && <ImageIcon size={12} className="opacity-40" />}
                             {feature.id === 'zeroG' && <Orbit size={12} className="opacity-40" />}
                             {feature.id === 'ranking' && <ListOrdered size={12} className="opacity-40" />}
                             {feature.id === 'lighting' && <Sun size={12} className="opacity-40" />}
                             {feature.id === 'info' && <Info size={12} className="opacity-40" />}
                             <span className={`text-sm font-bold ${text}`}>{feature.label}</span>
                           </div>
                           <div className="flex items-center gap-3">
                             <span className={`text-[10px] font-bold ${subtext} opacity-40 uppercase tracking-widest`}>{feature.count} CLICKS</span>
                             <span className="text-sm font-bold text-orange-500">{feature.pct}%</span>
                           </div>
                        </div>
                        <div className={`h-0.5 w-full ${lightsOn ? 'bg-neutral-100' : 'bg-neutral-800/50'} rounded-full overflow-hidden`}>
                           <div 
                              className="h-full bg-orange-500 transition-all duration-1000"
                              style={{ width: `${feature.pct}%` }}
                           />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Traffic Trend Chart */}
              <div className="lg:col-span-8 h-full">
                <TrafficTrendChart exhibitionId={exhibitionId} uiConfig={{ lightsOn, text, subtext, border }} />
              </div>
            </div>

            {/* 3. NEW: Technical Specifications Section */}
            <div className={`p-6 rounded-2xl border ${border} ${lightsOn ? 'bg-white' : 'bg-neutral-800/10'} space-y-8`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <h3 className={`text-[8px] font-bold uppercase tracking-[0.3em] ${subtext} opacity-50`}>Technical Specifications</h3>
                  <p className={`text-lg font-serif ${text}`}>Audience Technology Breakdown</p>
                </div>
                <div className={`px-4 py-2 rounded-full border ${border} ${lightsOn ? 'bg-neutral-50' : 'bg-neutral-900/50'} flex items-center gap-2.5`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                  <span className={`text-[10px] font-black uppercase tracking-[0.1em] ${text} opacity-70`}>Umami Cloud Stats</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Device Distribution */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg ${lightsOn ? 'bg-neutral-50 border-neutral-100' : 'bg-neutral-800/50 border-neutral-700/50'} border`}>
                       <Monitor size={12} className="opacity-50" />
                    </div>
                    <h4 className={`text-[10px] font-bold uppercase tracking-[0.2em] ${subtext} opacity-60`}>Device Distribution</h4>
                  </div>
                  
                  <div className="flex flex-col gap-6">
                    <TechDonutChart data={techStats.devices} uiConfig={uiConfig} />
                    
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {Array.isArray(techStats.devices) && techStats.devices.map((dev: any, i: number) => {
                        const total = techStats.devices.reduce((acc, d) => acc + d.y, 0);
                        const pct = Math.round((dev.y / total) * 100);
                        const label = dev.x.charAt(0).toUpperCase() + dev.x.slice(1);
                        const colors = ['bg-orange-500', 'bg-violet-500', 'bg-emerald-500', 'bg-blue-500', 'bg-rose-500'];
                        return (
                          <div key={dev.x} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full ${colors[i % colors.length]}`} />
                              <span className={`text-[10px] font-bold ${text} opacity-70`}>{label}</span>
                            </div>
                            <span className={`text-[10px] font-bold ${text}`}>{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Browser Share */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg ${lightsOn ? 'bg-neutral-50 border-neutral-100' : 'bg-neutral-800/50 border-neutral-700/50'} border`}>
                       <Globe size={12} className="opacity-50" />
                    </div>
                    <h4 className={`text-[10px] font-bold uppercase tracking-[0.2em] ${subtext} opacity-60`}>Browser Share</h4>
                  </div>
                  <div className="space-y-5">
                    {Array.isArray(techStats.browsers) && techStats.browsers.length > 0 ? techStats.browsers.slice(0, 4).map((br: any, i: number) => {
                      const total = techStats.browsers.reduce((acc, b) => acc + b.y, 0);
                      const pct = (br.y / total * 100).toFixed(1);
                      return (
                        <div key={br.x} className="group">
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-sm font-bold ${text}`}>{br.x}</span>
                            <span className={`text-sm font-bold ${i === 0 ? 'text-violet-500' : 'text-violet-400'}`}>{pct}%</span>
                          </div>
                          <div className={`h-1.5 w-full ${lightsOn ? 'bg-neutral-100' : 'bg-neutral-800/50'} rounded-full overflow-hidden`}>
                             <div 
                                className={`h-full transition-all duration-1000 ${i === 0 ? 'bg-violet-500' : 'bg-violet-400 opacity-60'}`}
                                style={{ width: `${pct}%` }}
                             />
                          </div>
                        </div>
                      )
                    }) : (
                      <div className="py-10 text-center opacity-20 italic text-[10px]">No Browser Data</div>
                    )}
                  </div>
                </div>

                {/* Common Resolutions */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg ${lightsOn ? 'bg-neutral-50 border-neutral-100' : 'bg-neutral-800/50 border-neutral-700/50'} border`}>
                       <Smartphone size={12} className="opacity-50" />
                    </div>
                    <h4 className={`text-[10px] font-bold uppercase tracking-[0.2em] ${subtext} opacity-60`}>Common Resolutions</h4>
                  </div>
                  <div className="space-y-2.5">
                    {Array.isArray(techStats.screens) && techStats.screens.length > 0 ? techStats.screens.slice(0, 5).map((screen: any, i: number) => (
                      <div key={screen.x} className={`group flex items-center justify-between p-3 rounded-xl border ${border} ${lightsOn ? 'bg-neutral-50/50' : 'bg-neutral-800/20'} transition-all hover:scale-[1.02]`}>
                        <div className="flex items-center gap-3">
                           <div className={`w-10 h-10 flex items-center justify-center p-1`}>
                              {(() => {
                                const parts = screen.x.split('x');
                                const w = parseInt(parts[0]) || 1;
                                const h = parseInt(parts[1]) || 1;
                                const maxSide = 24;
                                let displayW, displayH;
                                if (w >= h) {
                                  displayW = maxSide;
                                  displayH = Math.max(4, (h / w) * maxSide);
                                } else {
                                  displayH = maxSide;
                                  displayW = Math.max(4, (w / h) * maxSide);
                                }
                                return (
                                  <div 
                                    className={`rounded-[2px] border ${border} ${lightsOn ? 'bg-neutral-200' : 'bg-neutral-700'} opacity-60 shadow-sm transition-transform group-hover:scale-110`}
                                    style={{ width: `${displayW}px`, height: `${displayH}px` }}
                                  />
                                );
                              })()}
                           </div>
                           <span className={`text-xs font-mono font-bold ${text}`}>{screen.x}</span>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-bold ${text}`}>{screen.y} views</span>
                        </div>
                      </div>
                    )) : (
                      <div className="py-10 text-center opacity-20 italic text-[10px]">No Screen Data</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 4. NEW: Location Section */}
            <div className={`p-6 rounded-2xl border ${border} ${lightsOn ? 'bg-white' : 'bg-neutral-800/10'} space-y-8`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <h3 className={`text-[8px] font-bold uppercase tracking-[0.3em] ${subtext} opacity-50`}>Geographic Distribution</h3>
                  <p className={`text-lg font-serif ${text}`}>Visitor Location Breakdown</p>
                </div>
                <div className={`px-4 py-2 rounded-full border ${border} ${lightsOn ? 'bg-neutral-50' : 'bg-neutral-900/50'} flex items-center gap-2.5`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                  <span className={`text-[10px] font-black uppercase tracking-[0.1em] ${text} opacity-70`}>Umami Cloud Stats</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Countries */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg ${lightsOn ? 'bg-neutral-50 border-neutral-100' : 'bg-neutral-800/50 border-neutral-700/50'} border`}>
                      <Globe size={12} className="opacity-50" />
                    </div>
                    <h4 className={`text-[10px] font-bold uppercase tracking-[0.2em] ${subtext} opacity-60`}>Countries</h4>
                  </div>
                  <div className="flex flex-col gap-3">
                    {Array.isArray(locationStats.countries) && locationStats.countries.length > 0 ? locationStats.countries.slice(0, 5).map((country: any, i: number) => {
                      const total = locationStats.countries.reduce((acc: number, c: any) => acc + c.y, 0);
                      const pct = ((country.y / total) * 100).toFixed(1);
                      const flag = countryCodeToFlag(country.x);
                      const name = getCountryName(country.x);
                      return (
                        <div key={country.x} className={`group flex items-center justify-between p-3 rounded-xl border ${border} ${lightsOn ? 'bg-neutral-50/50' : 'bg-neutral-800/20'} transition-all hover:scale-[1.02]`}>
                          <div className="flex items-center gap-2.5">
                            <span className="text-xl">{flag}</span>
                            <span className={`text-xs font-bold ${text}`}>{name}</span>
                          </div>
                          <span className={`text-xs font-bold ${text}`}>{pct}%</span>
                        </div>
                      );
                    }) : (
                      <div className="py-10 text-center opacity-20 italic text-[10px]">No Country Data</div>
                    )}
                  </div>
                </div>

                {/* Regions */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg ${lightsOn ? 'bg-neutral-50 border-neutral-100' : 'bg-neutral-800/50 border-neutral-700/50'} border`}>
                      <MapPin size={12} className="opacity-50" />
                    </div>
                    <h4 className={`text-[10px] font-bold uppercase tracking-[0.2em] ${subtext} opacity-60`}>Regions</h4>
                  </div>
                  <div className="space-y-2.5">
                    {Array.isArray(locationStats.regions) && locationStats.regions.length > 0 ? locationStats.regions.slice(0, 5).map((region: any) => {
                      const total = locationStats.regions.reduce((acc: number, r: any) => acc + r.y, 0);
                      const pct = ((region.y / total) * 100).toFixed(1);
                      return (
                        <div key={region.x} className="group">
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-sm font-bold ${text}`}>{region.x || 'Unknown'}</span>
                            <span className={`text-sm font-bold text-emerald-500`}>{pct}%</span>
                          </div>
                          <div className={`h-1.5 w-full ${lightsOn ? 'bg-neutral-100' : 'bg-neutral-800/50'} rounded-full overflow-hidden`}>
                            <div 
                              className="h-full transition-all duration-1000 bg-emerald-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="py-10 text-center opacity-20 italic text-[10px]">No Region Data</div>
                    )}
                  </div>
                </div>

                {/* Cities */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg ${lightsOn ? 'bg-neutral-50 border-neutral-100' : 'bg-neutral-800/50 border-neutral-700/50'} border`}>
                      <MapIcon size={12} className="opacity-50" />
                    </div>
                    <h4 className={`text-[10px] font-bold uppercase tracking-[0.2em] ${subtext} opacity-60`}>Top Cities</h4>
                  </div>
                  <div className="space-y-2.5">
                    {Array.isArray(locationStats.cities) && locationStats.cities.length > 0 ? locationStats.cities.slice(0, 5).map((city: any) => (
                      <div key={city.x} className={`group flex items-center justify-between p-3 rounded-xl border ${border} ${lightsOn ? 'bg-neutral-50/50' : 'bg-neutral-800/20'} transition-all hover:scale-[1.02]`}>
                        <span className={`text-xs font-bold ${text}`}>{city.x || 'Unknown'}</span>
                        <span className={`text-xs font-bold ${text}`}>{city.y} visitors</span>
                      </div>
                    )) : (
                      <div className="py-10 text-center opacity-20 italic text-[10px]">No City Data</div>
                    )}
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

const TechDonutChart: React.FC<{
  data: { x: string; y: number }[];
  uiConfig: any;
}> = ({ data, uiConfig }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const { lightsOn } = uiConfig;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const colors = [
      '#f97316', // orange-500
      '#8b5cf6', // violet-500
      '#10b981', // emerald-500
      '#3b82f6', // blue-500
      '#f43f5e', // rose-500
    ];

    chartRef.current = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map(d => d.x),
        datasets: [{
          data: data.map(d => d.y),
          backgroundColor: colors,
          borderColor: lightsOn ? '#fff' : '#121212',
          borderWidth: 2,
          hoverOffset: 4
        }]
      },
      options: {
        cutout: '70%',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: lightsOn ? '#fff' : '#1e1e1e',
            titleColor: lightsOn ? '#000' : '#fff',
            bodyColor: lightsOn ? '#666' : '#ccc',
            padding: 10,
            cornerRadius: 8,
            displayColors: true
          }
        }
      }
    });

    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, [data, uiConfig.lightsOn]);

  if (data.length === 0) return <div className="h-full flex items-center justify-center opacity-20 italic text-[10px]">No Data</div>;

  return (
    <div className="relative w-full h-[180px]">
      <canvas ref={canvasRef} />
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className={`text-[10px] font-bold uppercase tracking-widest ${uiConfig.subtext} opacity-40`}>Total</span>
        <span className={`text-xl font-serif ${uiConfig.text}`}>
          {data.reduce((acc, d) => acc + d.y, 0)}
        </span>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;

// reload