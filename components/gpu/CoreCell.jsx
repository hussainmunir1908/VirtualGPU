'use client';
import { useState, useCallback, memo } from 'react';
import { useGPUStore } from '@/store/gpuStore';
import * as gpu from '@/simulation/gpu';

const ST = {
  idle:     { bg: 'var(--bg)',    bd: 'var(--border)',  gl: 'none' },
  active:   { bg: '#C8E8C8',     bd: 'var(--green)',   gl: '0 0 5px rgba(58,104,72,0.4)' },
  stalled:  { bg: '#F0DCA0',     bd: 'var(--amber)',   gl: '0 0 5px rgba(138,94,24,0.4)' },
  retiring: { bg: '#B8CCE8',     bd: 'var(--blue)',    gl: '0 0 5px rgba(42,80,128,0.4)' },
  diverged: { bg: '#E8B8B8',     bd: 'var(--red)',     gl: '0 0 5px rgba(122,56,48,0.4)' },
};

const CoreCell = memo(function CoreCell({ coreId, coreState, warpId, instruction, cycleCount, focused }) {
  const [hovered, setHovered] = useState(false);
  const setFocusedCore = useGPUStore(s => s.setFocusedCore);

  const handleClick = useCallback(() => {
    const id = focused ? -1 : coreId;
    setFocusedCore(id); gpu.setFocusedCore(id);
  }, [coreId, focused, setFocusedCore]);

  const s = ST[coreState] || ST.idle;

  return (
    <div className="relative cursor-pointer" style={{ width:22, height:22 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}>
      <div
        className={`w-full h-full rounded-sm ${coreState==='active' ? 'animate-pulse-core' : ''}`}
        style={{
          background: s.bg,
          border: `1.5px solid ${focused ? 'var(--accent)' : s.bd}`,
          boxShadow: focused ? '0 0 0 1.5px var(--accent)' : s.gl,
          transition: 'border-color 0.1s',
        }}
      />
      {hovered && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 pointer-events-none"
          style={{ minWidth:130 }}>
          <div className="rounded p-2 text-sm"
            style={{ background:'var(--surface)', border:'1px solid var(--border)',
                     boxShadow:'0 4px 12px rgba(0,0,0,0.15)' }}>
            <div className="font-semibold mb-1" style={{ color:'var(--accent)' }}>Core #{coreId}</div>
            <div style={{ color:'var(--muted)' }}>State: <span style={{ color:'var(--text)' }}>{coreState}</span></div>
            {warpId>=0 && <div style={{ color:'var(--muted)' }}>Warp: <span style={{ color:'var(--text)' }}>W{warpId}</span></div>}
            {instruction && <div style={{ color:'var(--muted)' }}>Instr: <span className="font-mono" style={{ color:'var(--accent)' }}>{instruction}</span></div>}
            <div style={{ color:'var(--muted)' }}>Cycles: <span className="font-mono">{cycleCount}</span></div>
          </div>
        </div>
      )}
    </div>
  );
});

export default CoreCell;
