import React from 'react';

interface ZeroGravityLegendProps {
  className?: string;
  minViews?: number; // smallest views in current scene
  maxViews?: number; // largest views in current scene
  // Optional array of numeric ticks (0..1) to place along the gradient as proportions
  extraTicks?: number[];
  visible?: boolean; // when parent indicates visible (legend will honor a delay)
  delayMs?: number; // delay before showing (ms)
}

const ZeroGravityLegend: React.FC<ZeroGravityLegendProps> = ({ className = '', minViews = 0, maxViews = 100, extraTicks = [], visible = false, delayMs = 1000 }) => {
  // Color stops roughly match the provided attachment (yellow -> green -> teal -> blue -> purple)
  const gradient = 'linear-gradient(to bottom, #ffd400 0%, #9ad34a 18%, #3fc7a6 37%, #2aa6b3 58%, #3f6aa8 80%, #5b2d7a 100%)';

  const containerHeight = 200; // smaller size as requested
  const barWidth = 14;

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

  // When not shown, translate far to the right and hide opacity
  const outerStyle: React.CSSProperties = {
    transform: show ? 'translateY(-50%) translateX(0)' : 'translateY(-50%) translateX(120%)',
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

  return (
    <div style={outerStyle} className={`fixed right-5 top-1/2 z-50 pointer-events-auto ${className}`}>
      <div className="flex flex-col items-center gap-2">
        <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-200" style={{ marginBottom: 6, transform: 'translateX(-12px)' }}>views</div>
        <div className="flex items-center gap-2">
          <div style={{ height: containerHeight, width: barWidth, borderRadius: 6, background: gradient, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }} />
          <div style={{ height: containerHeight, width: 64 }} className="relative">
            {renderEntries.map((e, i) => {
              const padding = 6;
              const effectiveHeight = containerHeight - padding * 2;
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
