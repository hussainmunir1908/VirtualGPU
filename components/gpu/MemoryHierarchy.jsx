'use client';
import { fmtBandwidth } from '@/simulation/gpu';

const L1_LINES = 64;
const L2_LINES = 128;

const LEVELS = [
  { key:'registers', name:'Register File', latency:'0 cyc',   color:'var(--purple)', sizeLabel:'256 KB', isReg:true  },
  { key:'l1',        name:'L1 / Shared',   latency:'4 cyc',   color:'var(--blue)',   sizeLabel:'48 KB',  totalLines:L1_LINES },
  { key:'l2',        name:'L2 Cache',      latency:'12 cyc',  color:'var(--amber)',  sizeLabel:'4 MB',   totalLines:L2_LINES },
  { key:'vram',      name:'VRAM Global',   latency:'200 cyc', color:'var(--red)',    sizeLabel:'8 GB',   isVram:true },
];

function fmt(n) {
  if (!n) return '0 B';
  if (n>=1e9) return (n/1e9).toFixed(1)+' GB';
  if (n>=1e6) return (n/1e6).toFixed(0)+' MB';
  if (n>=1e3) return (n/1e3).toFixed(0)+' KB';
  return n+' B';
}

export default function MemoryHierarchy({ memory }) {
  if (!memory) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold" style={{ color:'var(--text)' }}>Memory Hierarchy</span>

      {LEVELS.map(({ key, name, latency, color, sizeLabel, isReg, isVram, totalLines }) => {
        const lvl   = memory[key]||{};
        const hits  = lvl.hits||0;
        const miss  = lvl.misses||0;
        const total = hits+miss;
        const rate  = total>0 ? ((hits/total)*100).toFixed(1) : null;
        const lines = (lvl.lines||[]).slice(0,32);

        let pct=0, barLabel='';
        if (isReg) {
          pct = lvl.capacity>0 ? Math.round((lvl.used||0)/lvl.capacity*100) : 0;
          barLabel = `${fmt(lvl.used||0)} / ${sizeLabel}`;
        } else if (isVram) {
          pct = Math.min(100, Math.round(((lvl.bandwidth||0)/500)*100));
          barLabel = fmtBandwidth(lvl.bandwidth||0);
        } else {
          const filled = lines.filter(l=>l.state!=='empty').length;
          pct = Math.round((filled/totalLines)*100);
          barLabel = `${filled}/${totalLines} lines`;
        }

        return (
          <div key={key} className="rounded p-2.5"
            style={{ background:'var(--bg)', border:'1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background:color }} />
                <span className="text-sm font-medium" style={{ color:'var(--text)' }}>{name}</span>
                <span className="font-mono text-xs" style={{ color:'var(--dim)' }}>lat: {latency}</span>
              </div>
              <span className="font-mono text-xs" style={{ color:'var(--dim)' }}>{sizeLabel}</span>
            </div>

            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex-1 h-2 rounded-full overflow-hidden"
                style={{ background:'var(--border)' }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width:`${pct}%`, background:color }} />
              </div>
              <span className="font-mono text-xs shrink-0 w-32 text-right"
                style={{ color:'var(--dim)' }}>{barLabel}</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-sm" style={{ color:'var(--green)' }}>H: {hits.toLocaleString()}</span>
              <span className="font-mono text-sm" style={{ color:'var(--red)' }}>M: {miss.toLocaleString()}</span>
              {rate!==null && (
                <span className="text-sm" style={{ color:'var(--muted)' }}>
                  Hit: <span className="font-mono font-semibold" style={{ color }}>{rate}%</span>
                </span>
              )}
              {isVram && (lvl.used||0)>0 && (
                <span className="font-mono text-xs ml-auto" style={{ color:'var(--dim)' }}>
                  Alloc: <span style={{ color:'var(--blue)' }}>{fmt(lvl.used)}</span>
                </span>
              )}
            </div>

            {lines.length>0 && (
              <div className="flex flex-wrap gap-0.5 mt-1.5">
                {lines.map((line,li) => {
                  const lc = line.state==='cached' ? color
                           : line.state==='dirty'  ? 'var(--amber)'
                           : 'var(--border)';
                  return (
                    <div key={li} style={{ width:9, height:9, borderRadius:2,
                      background:lc, border:`1px solid ${lc}` }} />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div className="flex gap-3" style={{ fontSize:12 }}>
        {[['var(--blue)','Cached'], ['var(--border)','Empty'], ['var(--amber)','Dirty']].map(([c,l])=>(
          <div key={l} className="flex items-center gap-1">
            <div style={{ width:9,height:9,borderRadius:2,background:c,border:`1px solid ${c}` }} />
            <span style={{ color:'var(--dim)' }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
