import React from 'react';

interface ZeroGravityLegendProps {
  className?: string;
  minViews?: number; // smallest views in current scene
  maxViews?: number; // largest views in current scene
  // Optional array of numeric ticks (0..1) to place along the gradient as proportions
  extraTicks?: number[];
  visible?: boolean; // when parent indicates visible (legend will honor a delay)
  delayMs?: number; // delay before showing (ms)
  isSmallScreen?: boolean; // NEW: handle mobile layout
}

const ZeroGravityLegend: React.FC<ZeroGravityLegendProps> = ({ 
  className = '', 
  minViews = 0, 
  maxViews = 100, 
  extraTicks = [], 
  visible = false, 
  delayMs = 1000,
  isSmallScreen = false
}) => {
  // Color stops roughly match the provided attachment (yellow -> green -> teal -> blue -> purple)
  const gradient = isSmallScreen 
    ? 'linear-gradient(to right, #ffd400 0%, #9ad34a 18%, #3fc7a6 37%, #2aa6b3 58%, #3f6aa8 80%, #5b2d7a 100%)'
    : 'linear-gradient(to bottom, #ffd400 0%, #9ad34a 18%, #3fc7a6 37%, #2aa6b3 58%, #3f6aa8 80%, #5b2d7a 100%)';

  const barLength = isSmallScreen ? 160 : 200; 
  const barThickness = 12;

  // Compute ticks: we show 6 ticks by default (matching attachment), then overlay min/max and any extra ticks
  const defaultTickProps = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
  const ticks = Array.from(new Set([...defaultTickProps, ...extraTicks])).sort((a, b) => a - b);

  const valueForProportion = (p: number) => Math.round(minViews + p * (maxViews - minViews));

  // Control internal show state so we can delay appearance when `visible` becomes true
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    let t: number | undefined;
    if (visible) {
      t = window.setTimeout(() => setShow(true), delayMs);
    } else {
      setShow(false);
    }
    return () => { if (t) clearTimeout(t); };
  }, [visible, delayMs]);

  // When not shown, translate far to the right (desktop) or bottom (mobile) and hide opacity
  const outerStyle: React.CSSProperties = {
    transform: isSmallScreen
      ? (show ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(150%)')
      : (show ? 'translateY(-50%) translateX(0)' : 'translateY(-50%) translateX(120%)'),
    transition: 'transform 600ms cubic-bezier(.2,.9,.2,1), opacity 400ms ease',
    opacity: show ? 1 : 0,
    willChange: 'transform, opacity'
  };

  // Prepare ticks: prefer provided extraTicks (from actual view counts) when available,
  // otherwise fall back to default evenly spaced ticks.
  const baseTicks = (extraTicks && extraTicks.length > 0) ? Array.from(new Set(extraTicks)).sort((a,b) => a-b) : defaultTickProps;

  // Map proportions to rounded values and ensure duplicate numeric labels render only once.
  const tickEntries = baseTicks.map(p => ({ p, val: valueForProportion(p) }));
  const valToFirstP = new Map<number, number>();
  for (const e of tickEntries) {
    if (!valToFirstP.has(e.val)) {
      valToFirstP.set(e.val, e.p);
    }
  }
  const renderEntries = Array.from(valToFirstP.entries()).map(([val, p]) => ({ p, val }))
    .sort((a, b) => a.p - b.p);

  if (isSmallScreen) {
    return (
      <div 
        style={outerStyle} 
        className={`fixed left-1/2 bottom-28 z-50 pointer-events-none ${className}`}
      >
        <div className="flex flex-col items-center gap-1 bg-white/10 dark:bg-black/40 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 shadow-xl">
          <div className="text-[9px] font-bold uppercase tracking-widest text-neutral-700 dark:text-neutral-300 opacity-70">
            Views
          </div>
          <div className="relative" style={{ width: barLength, height: 24 }}>
            {/* The Gradient Bar */}
            <div 
              style={{ 
                width: barLength, 
                height: 8, 
                borderRadius: 4, 
                background: gradient,
                position: 'absolute',
                top: 0
              }} 
            />
            {/* Ticks */}
            {renderEntries.map((e) => {
              const left = e.p * barLength;
              return (
                <div 
                  key={e.val} 
                  style={{ 
                    position: 'absolute', 
                    left: `${left}px`, 
                    top: 12,
                    transform: 'translateX(-50%)' 
                  }} 
                  className="text-[9px] font-medium text-neutral-700 dark:text-neutral-200 whitespace-nowrap"
                >
                  {e.val}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={outerStyle} className={`fixed right-5 top-1/2 z-50 pointer-events-none ${className}`}>
      <div className="flex flex-col items-center gap-2">
        <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-200" style={{ marginBottom: 6, transform: 'translateX(-12px)' }}>views</div>
        <div className="flex items-center gap-2">
          <div style={{ height: barLength, width: barThickness, borderRadius: 6, background: gradient, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }} />
          <div style={{ height: barLength, width: 64 }} className="relative">
            {renderEntries.map((e, i) => {
              const padding = 6;
              const effectiveHeight = barLength - padding * 2;
              const top = padding + e.p * effectiveHeight;
              return (
                <div key={e.val} style={{ position: 'absolute', top: `${top}px`, transform: 'translateY(-50%)' }} className="text-xs text-neutral-700 dark:text-neutral-200 whitespace-nowrap">
                  {e.val}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZeroGravityLegend;
