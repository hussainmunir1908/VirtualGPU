'use client';

const BADGE = {
  running:        { color:'var(--green)',  bg:'rgba(58,104,72,0.12)',   label:'RUN'   },
  stalled:        { color:'var(--amber)',  bg:'rgba(138,94,24,0.12)',   label:'STALL' },
  waiting_memory: { color:'var(--purple)', bg:'rgba(88,56,112,0.12)',  label:'MEM'   },
  done:           { color:'var(--dim)',    bg:'rgba(154,136,120,0.12)', label:'DONE'  },
  diverged:       { color:'var(--red)',    bg:'rgba(122,56,48,0.12)',   label:'DIVG'  },
};

export default function WarpTable({ scheduler }) {
  if (!scheduler) return null;
  const { warps, activeWarpIdx } = scheduler;

  return (
    <div className="flex flex-col gap-2 h-full overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
        <span className="text-sm font-semibold" style={{ color:'var(--text)' }}>Warp Scheduler</span>
        <span className="text-xs font-mono" style={{ color:'var(--dim)' }}>Round-Robin · 8 warps</span>
      </div>

      <div className="flex-1 overflow-auto min-h-0 rounded" style={{ border:'1px solid var(--border)' }}>
        <table className="w-full border-collapse" style={{ fontSize:13 }}>
          <thead style={{ position:'sticky', top:0, background:'var(--surface)', zIndex:1 }}>
            <tr style={{ borderBottom:'1px solid var(--border)' }}>
              {['Warp','Threads','State','Progress','Instr','Cycles'].map(h => (
                <th key={h} className="px-2 py-1.5 text-left font-semibold"
                  style={{ color:'var(--muted)', fontSize:12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {warps.map(warp => {
              const isActive = warp.id===activeWarpIdx && warp.state==='running';
              const badge = BADGE[warp.state]||BADGE.stalled;
              return (
                <tr key={warp.id} style={{
                  borderBottom:'1px solid var(--border)',
                  background: isActive ? 'rgba(58,104,72,0.08)' : 'transparent',
                }}>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      {isActive && <span className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background:'var(--green)' }} />}
                      <span className="font-mono font-semibold text-sm"
                        style={{ color:isActive ? 'var(--green)' : 'var(--text)' }}>
                        W{warp.id}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 font-mono text-center" style={{ color:'var(--muted)' }}>
                    {warp.threadCount}
                  </td>
                  <td className="px-2 py-1.5">
                    <span className="px-1.5 py-0.5 rounded text-xs font-semibold"
                      style={{ color:badge.color, background:badge.bg }}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 w-20">
                    <div className="h-1.5 rounded-full overflow-hidden mb-0.5"
                      style={{ background:'var(--border)' }}>
                      <div className="h-full rounded-full transition-all duration-300"
                        style={{ width:`${warp.progress}%`, background:badge.color }} />
                    </div>
                    <span className="font-mono" style={{ color:'var(--dim)', fontSize:11 }}>
                      {warp.progress.toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-2 py-1.5 font-mono font-medium" style={{ color:'var(--accent)' }}>
                    {warp.instruction||'—'}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-right" style={{ color:'var(--muted)' }}>
                    {warp.cycleCount}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
