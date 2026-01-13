
import React, { useEffect, useState, useMemo } from 'react'; // MODIFIED: Add useMemo
import { createPortal } from 'react-dom';
import { X, BarChart2, Users, MousePointer2, TrendingUp, Share2, ExternalLink, Activity, PieChart, Map as MapIcon, ArrowUpRight, ArrowDownRight, Calendar, MapPin, Clock, Ticket, Sparkles } from 'lucide-react';
import { Exhibition, ExhibitionArtItem, FirebaseArtwork } from '../../types'; // NEW: Import types
import BlackDotLogo from './BlackDotLogo'; // NEW: Import Logo

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
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  isOpen,
  onClose,
  uiConfig,
  exhibition,
  currentLayout,
  firebaseArtworks,
}) => {
  const [mounted, setMounted] = useState(false);
  const [timeRange, setTimeRange] = useState<'7D' | '30D' | '90D' | '12M'>('7D');

  const exhibitionId = exhibition.id;
  const exhibitionTitle = exhibition.title || 'Untitled Exhibition';

  useEffect(() => {
    setMounted(true);
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  // NEW: Process real artwork data for the dashboard
  const artworkStats = useMemo(() => {
    return currentLayout.map(item => {
      const artwork = firebaseArtworks.find(a => a.id === item.artworkId);
      const dummyViews = (artwork?.title?.length || 0) * 45 + 120;
      const dummyEngagement = 40 + ((artwork?.description?.length || 0) % 50);
      
      return {
        id: item.id,
        name: artwork?.title || 'Untitled Artwork',
        views: dummyViews,
        engagement: `${dummyEngagement}%`,
        val: dummyEngagement,
        color: item.type.startsWith('canvas_') ? "from-cyan-400 to-cyan-600" : "from-violet-400 to-violet-600"
      };
    }).sort((a, b) => b.views - a.views);
  }, [currentLayout, firebaseArtworks]);

  // IMPROVED: Robust dummy data for specific time ranges
  const trafficData = useMemo(() => {
    if (timeRange === '7D') {
      return [
        { label: 'Mon', value: 12 }, { label: 'Tue', value: 25 }, { label: 'Wed', value: 18 },
        { label: 'Thu', value: 42 }, { label: 'Fri', value: 30 }, { label: 'Sat', value: 55 }, { label: 'Sun', value: 48 }
      ];
    }
    if (timeRange === '30D') {
      return Array.from({ length: 15 }, (_, i) => ({
        label: `Day ${i * 2 + 1}`,
        value: 10 + i * 3 + Math.sin(i) * 15
      }));
    }
    if (timeRange === '90D') {
      return ['W1', 'W4', 'W8', 'W12'].map((w, i) => ({
        label: w,
        value: 20 + i * 15 + Math.random() * 20
      }));
    }
    // 12M
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => ({
      label: m,
      value: 15 + i * 6 + Math.cos(i) * 10
    }));
  }, [timeRange]);

  // Generate SVG path from data - Linear for Pixel Precision
  const generateChartPath = (isArea: boolean): string => {
    if (trafficData.length === 0) return "";
    const points = trafficData.map((d, i) => ({
      x: (i / (trafficData.length - 1)) * 100,
      y: 90 - (d.value * 0.75) // Increased padding
    }));

    // Start path
    let path = `M ${points[0].x} ${points[0].y}`;
    
    // Linear segments to avoid "deformation" from Bézier
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }

    if (isArea) {
      path += ` L 100 100 L 0 100 Z`;
    }
    return path;
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-0 md:p-10">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-xl transition-opacity animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div 
        className={`relative w-full h-full md:max-w-[1300px] md:h-[92vh] md:rounded-xl border ${border} ${lightsOn ? 'bg-[#fcfcfc]' : 'bg-[#121212]'} shadow-[0_0_80px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 font-sans`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - More Compact */}
        <div className={`px-8 py-6 border-b ${border} flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-20 ${lightsOn ? 'bg-[#fcfcfc]/90' : 'bg-[#121212]/90'} backdrop-blur-md`}>
          <div className="flex items-center gap-6">
            <div className={`w-12 h-12 rounded-full border ${border} flex items-center justify-center p-2`}>
              <BlackDotLogo treatAsCompact={true} className={`${text}`} />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-orange-500/80">
                  Analytics Professional
                </span>
              </div>
              <h2 className={`text-3xl font-serif tracking-tight ${text}`}>
                {exhibitionTitle}
              </h2>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-neutral-100/50 dark:bg-neutral-800/50 rounded-lg border ${border}">
              <span className={`text-[10px] font-bold ${subtext} opacity-50 uppercase tracking-widest`}>ID:</span>
              <span className={`text-[10px] font-mono font-bold ${text}`}>{exhibitionId.slice(0, 12).toUpperCase()}</span>
            </div>

            <div className="flex items-center gap-2 p-1 bg-neutral-100/50 dark:bg-neutral-800/50 rounded-full border ${border}">
              <button 
                onClick={handleShare}
                className={`p-2 rounded-full hover:bg-white dark:hover:bg-neutral-700 transition-all ${text} group`}
                title="Share"
              >
                <Share2 size={16} strokeWidth={1.5} />
              </button>
              <button 
                onClick={openInNewTab}
                className={`p-2 rounded-full hover:bg-white dark:hover:bg-neutral-700 transition-all ${text} group`}
                title="Expand"
              >
                <ExternalLink size={16} strokeWidth={1.5} />
              </button>
            </div>
            
            <button 
              onClick={onClose}
              className={`p-2 rounded-full ${lightsOn ? 'hover:bg-neutral-100' : 'hover:bg-neutral-800'} ${text} transition-all border ${border}`}
            >
              <X size={20} strokeWidth={1.2} />
            </button>
          </div>
        </div>

        {/* Scrollable Body - Reduced horizontal padding */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
          <div className="max-w-[1240px] mx-auto space-y-6">
            
            {/* Exhibition Info Overview - More Concise 4-column */}
            <div className={`p-6 rounded-xl border ${border} ${lightsOn ? 'bg-white' : 'bg-neutral-800/20'} grid grid-cols-2 md:grid-cols-4 gap-6 relative overflow-hidden`}>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-neutral-400">
                  <Calendar size={12} strokeWidth={1.5} />
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Exhibition Period</span>
                </div>
                <div className={`text-sm font-bold tracking-tight ${text}`}>
                   {exhibition.startDate || '2026-01-01'} — {exhibition.endDate || '2027-01-01'}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-neutral-400">
                  <Clock size={12} strokeWidth={1.5} />
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Operational Status</span>
                </div>
                <div className={`text-sm font-bold tracking-tight ${text} flex items-center gap-2`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Live & Public Access
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-neutral-400">
                  <MapPin size={12} strokeWidth={1.5} />
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Venue Context</span>
                </div>
                <div className={`text-sm font-bold tracking-tight ${text}`}>
                  {exhibition.subtitle || 'Black Dot Lab'} · <span className="opacity-50 font-normal">Sovereign Point</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-neutral-400">
                  <TrendingUp size={12} strokeWidth={1.5} />
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Primary Goal</span>
                </div>
                <div className={`text-sm font-bold tracking-tight ${text}`}>
                  Visual Immersion · <span className="opacity-50 font-normal">3D</span>
                </div>
              </div>
            </div>

            {/* 1. Hero Metrics Grid - Tighter padding */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <HeroMetric 
                icon={<Users />} 
                label="Unique Visitors" 
                value="2,842" 
                trend="+12.5%" 
                positive={true} 
                uiConfig={uiConfig} 
              />
              <HeroMetric 
                icon={<MousePointer2 />} 
                label="Interaction Count" 
                value="14,204" 
                trend="+8.2%" 
                positive={true} 
                uiConfig={uiConfig} 
              />
              <HeroMetric 
                icon={<TrendingUp />} 
                label="Retention Rate" 
                value="68%" 
                trend="-2.4%" 
                positive={false} 
                uiConfig={uiConfig} 
              />
              <HeroMetric 
                icon={<Clock />} 
                label="Avg. Session" 
                value="4m 32s" 
                trend="+15%" 
                positive={true} 
                uiConfig={uiConfig} 
              />
            </div>

            {/* 2. Main Analytics Section - Better balance */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Traffic Chart Card */}
              <div className={`lg:col-span-2 p-8 rounded-xl border ${border} ${lightsOn ? 'bg-white' : 'bg-neutral-800/10'}`}>
                <div className="flex items-center justify-between mb-8">
                  <div className="space-y-1">
                    <h3 className={`text-lg font-sans font-semibold ${text}`}>Visitor Traffic Trends</h3>
                    <p className={`text-[10px] font-bold ${subtext} opacity-50 uppercase tracking-widest`}>Historical Audience Data</p>
                  </div>
                  <div className="flex items-center gap-3">
                     <select 
                       value={timeRange}
                       onChange={(e) => setTimeRange(e.target.value as any)}
                       className={`bg-transparent text-[10px] font-bold border ${border} rounded-md px-2 py-1 outline-none ${text}`}
                     >
                        <option value="7D">Past Week</option>
                        <option value="30D">Past Month</option>
                        <option value="90D">Past Quarter</option>
                        <option value="12M">Past Year</option>
                     </select>
                  </div>
                </div>

                {/* Performance Trend Chart - CONSTRAINED WITHIN CONTAINER */}
                <div className="relative h-[320px] w-full flex flex-col group overflow-visible">
                  <div className="flex flex-1 h-[240px] overflow-visible">
                    <div className="flex flex-col justify-between text-[9px] font-bold text-neutral-300 dark:text-neutral-600 pr-4 pb-0 text-right w-10">
                      <span>5.0K</span>
                      <span>3.0K</span>
                      <span>1.0K</span>
                      <span>0</span>
                    </div>

                    <div className="flex-1 relative h-full">
                      <svg 
                        className="w-full h-full overflow-visible" 
                        viewBox="0 0 100 100" 
                        preserveAspectRatio="none"
                      >
                        {/* Grid lines */}
                        {[0, 33, 66, 100].map(y => (
                          <line 
                            key={y} 
                            x1="0" 
                            y1={y} 
                            x2="100" 
                            y2={y} 
                            className="stroke-neutral-100 dark:stroke-neutral-800/30" 
                            strokeWidth="0.5"
                            vectorEffect="non-scaling-stroke"
                          />
                        ))}
                        
                        {/* Performance Line */}
                        <path 
                          d={generateChartPath(false)}
                          fill="none"
                          className="stroke-[#E65D20]" 
                          strokeWidth="2.5" 
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>

                      {/* Tooltip Overlay */}
                      {(() => {
                        const midIdx = Math.floor(trafficData.length / 2);
                        const midPoint = trafficData[midIdx];
                        if (!midPoint) return null;
                        const x = (midIdx / (trafficData.length -1)) * 100;
                        const y = 90 - (midPoint.value * 0.75);
                        
                        return (
                          <>
                            <div 
                              className="absolute w-2 h-2 rounded-full bg-[#E65D20] border-2 border-white dark:border-neutral-900 shadow-sm transition-all duration-300 pointer-events-none"
                              style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
                            />
                            <div 
                              className="absolute pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-300 z-10"
                              style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -120%) scale(0.95)' }}
                            >
                              <div className="bg-white dark:bg-neutral-900/95 backdrop-blur-md rounded-xl border border-neutral-100 dark:border-neutral-800 shadow-xl px-4 py-3 flex flex-col items-center min-w-[160px]">
                                <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-[0.2em] mb-1">{midPoint.label} Performance</span>
                                <div className="flex items-baseline gap-2">
                                  <span className={`text-2xl font-black tracking-tighter ${text}`}>{Math.round(midPoint.value * 100).toLocaleString()}</span>
                                  <div className="flex items-center gap-0.5 text-green-500 font-bold text-xs">
                                    <ArrowUpRight size={12} /> <span>12%</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  
                  {/* X-Axis Labels - Safely inside the flex-col */}
                  <div className="flex justify-between border-t border-neutral-100 dark:border-neutral-800/10 pt-6 px-1 mt-4">
                    {trafficData.map((d, i) => (
                      <span key={i} className={`text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-tighter`}>{d.label}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Interaction Map Card */}
              <div className={`p-8 rounded-xl border ${border} ${lightsOn ? 'bg-white' : 'bg-neutral-800/10'} flex flex-col`}>
                <div className="space-y-1 mb-6">
                  <h3 className={`text-[9px] font-bold uppercase tracking-[0.3em] ${subtext} opacity-50`}>Engagement Heatmap</h3>
                  <p className={`text-xl font-serif ${text}`}>Feature Adoption</p>
                </div>
                
                <div className="flex-1 space-y-4">
                  {[
                    { label: "Artwork Focus / Zoom", val: "84%", icon: <Sparkles size={12} />, color: "bg-orange-500", desc: "Deep engagement with art" },
                    { label: "Zero Gravity Mode", val: "62%", icon: <TrendingUp size={12} />, color: "bg-neutral-400", desc: "Spatial exploration" },
                    { label: "Ranking & Voting", val: "35%", icon: <MousePointer2 size={12} />, color: "bg-amber-400", desc: "Community participation" },
                    { label: "Lighting Controls", val: "12%", icon: <Activity size={12} />, color: "bg-neutral-300", desc: "Atmospheric adjustment" }
                  ].map((item, i) => (
                    <div key={i} className="space-y-2 group/item">
                       <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2">
                           <span className={`${text} opacity-40 group-hover/item:text-orange-500 transition-colors`}>{item.icon}</span>
                           <span className={`text-[10px] font-bold uppercase tracking-wider ${text}`}>{item.label}</span>
                         </div>
                         <span className={`text-[10px] font-bold text-orange-500`}>{item.val}</span>
                       </div>
                       <div className="h-1 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                          <div className={`h-full ${item.color} rounded-full transition-all duration-1000 group-hover/item:opacity-80`} style={{ width: item.val }} />
                       </div>
                       <p className="text-[8px] font-medium text-neutral-400 opacity-0 group-hover/item:opacity-100 transition-opacity">
                         {item.desc}
                       </p>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 pt-6 border-t border-neutral-500/10">
                   <div className="flex items-center justify-between">
                      <p className={`text-[9px] font-bold ${subtext} opacity-50 uppercase tracking-widest`}>Confidence Score</p>
                      <span className="text-[10px] font-bold text-green-500">98.2%</span>
                   </div>
                </div>
              </div>
            </div>

            {/* 3. Artwork Performance Table - Reduced vertical padding */}
            <div className={`p-8 rounded-xl border ${border} ${lightsOn ? 'bg-white' : 'bg-neutral-800/10'}`}>
              <div className="flex items-center justify-between mb-8">
                <div className="space-y-1">
                   <h3 className={`text-[9px] font-bold uppercase tracking-[0.3em] ${subtext} opacity-50`}>Top Performing Assets</h3>
                   <p className={`text-xl font-serif ${text}`}>Artwork Performance Ranking</p>
                </div>
                <button className={`text-[10px] font-bold uppercase tracking-widest px-4 py-2 border ${border} rounded-lg ${text} hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all`}>
                  View All Assets
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className={`border-b ${border}`}>
                      <th className={`pb-4 text-[9px] font-bold uppercase tracking-[0.3em] ${subtext} opacity-40`}>Exhibited Piece</th>
                      <th className={`pb-4 text-[9px] font-bold uppercase tracking-[0.3em] ${subtext} opacity-40 text-right`}>Views</th>
                      <th className={`pb-4 text-[9px] font-bold uppercase tracking-[0.3em] ${subtext} opacity-40 text-right`}>Impact Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50 dark:divide-neutral-800/10">
                    {artworkStats.slice(0, 6).map((art) => (
                      <tr key={art.id} className="group hover:bg-neutral-50/50 dark:hover:bg-white/5 transition-colors">
                        <td className="py-4">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-lg border ${border} flex items-center justify-center text-xs font-serif ${text} bg-neutral-50 dark:bg-neutral-900 shadow-sm group-hover:bg-orange-500 group-hover:text-white transition-all`}>
                              {art.name.charAt(0)}
                            </div>
                            <div className="space-y-0.5">
                               <p className={`text-sm font-bold tracking-tight ${text}`}>{art.name}</p>
                               <p className={`text-[9px] font-medium text-neutral-400 tracking-wider`}>Asset Reference: {art.id.slice(0, 8).toUpperCase()}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 text-right">
                          <span className={`text-base font-serif ${text}`}>{art.views.toLocaleString()}</span>
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <div className="hidden sm:block h-1 w-20 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                              <div className={`h-full bg-orange-500 opacity-60 group-hover:opacity-100 transition-opacity`} style={{ width: art.engagement }} />
                            </div>
                            <span className={`text-[10px] font-bold tracking-tight ${text}`}>{art.engagement}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Exhibition Overview - Integrated layout */}
            <div className={`p-8 rounded-xl border ${border} ${lightsOn ? 'bg-white' : 'bg-neutral-800/10'}`}>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-3 space-y-4">
                  <h3 className={`text-[9px] font-bold uppercase tracking-[0.4em] ${text} opacity-50`}>Curatorial Statement</h3>
                  <p className={`text-base leading-relaxed ${subtext} font-medium opacity-80`}>
                    {exhibition.overview || "This exhibition explores the digital intersection of art and identity. Curated with a focus on immersive experiences, it challenges traditional gallery boundaries through interactive spatial compositions and zero-gravity perspectives."}
                  </p>
                </div>
                
                <div className="space-y-6 lg:pl-8 lg:border-l ${border}">
                   <div className="space-y-1">
                      <p className={`text-[9px] font-bold uppercase tracking-[0.3em] ${subtext} opacity-40`}>Support Entity</p>
                      <p className={`text-sm font-semibold ${text}`}>{exhibition.supportedBy || "Black Dot Lab"}</p>
                   </div>
                   <div className="space-y-1">
                       <p className={`text-[9px] font-bold uppercase tracking-[0.3em] ${subtext} opacity-40`}>Access Rights</p>
                       <p className={`text-sm font-semibold ${text}`}>Permanent Global License</p>
                   </div>
                   <button 
                      onClick={handleShare}
                      className="w-full py-3 bg-neutral-900 dark:bg-white dark:text-neutral-900 text-white rounded-lg flex items-center justify-center gap-2 group hover:bg-neutral-800 transition-all font-bold tracking-[0.2em] uppercase text-[9px]"
                    >
                      <Ticket size={12} />
                      Share Access
                    </button>
                </div>
              </div>
            </div>

            {/* Branding Footer - Compact */}
            <div className="flex items-center gap-4 justify-center pt-8 pb-4 opacity-30">
              <BlackDotLogo treatAsCompact={true} className={`${text} w-5 h-5`} />
              <div className="h-3 w-px bg-neutral-500" />
              <p className={`text-[9px] font-bold uppercase tracking-[0.4em] ${subtext}`}>
                Black Dot Professional Analytics System
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

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

