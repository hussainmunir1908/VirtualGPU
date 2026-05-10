'use client';
import CoreCell from './CoreCell';

const LEGEND = [
  { state: 'idle',     label: 'Idle',     color: 'var(--border)' },
  { state: 'active',   label: 'Active',   color: 'var(--green)'  },
  { state: 'stalled',  label: 'Stalled',  color: 'var(--amber)'  },
  { state: 'retiring', label: 'Retiring', color: 'var(--blue)'   },
  { state: 'diverged', label: 'Diverged', color: 'var(--red)'    },
];

export default function CoreGrid({ cores, focusedCore }) {
  if (!cores?.length) return null;
  const counts = {};
  cores.forEach(c => { counts[c.state] = (counts[c.state]||0)+1; });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Shader Cores</span>
        <span className="font-mono text-sm" style={{ color: 'var(--muted)' }}>
          16 × 8 = 128 &nbsp;·&nbsp;
          <span style={{ color: 'var(--green)' }}>{counts.active||0} active</span>
          &nbsp;·&nbsp;
          <span style={{ color: 'var(--amber)' }}>{counts.stalled||0} stalled</span>
        </span>
      </div>

      {/* 22px cells — all 128 always visible, fills space better */}
      <div className="neu-inset p-3">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(16, 22px)',
          gridTemplateRows:    'repeat(8,  22px)',
          gap: '3px',
        }}>
          {cores.map(core => (
            <CoreCell key={core.id}
              coreId={core.id} coreState={core.state}
              warpId={core.warpId} instruction={core.instruction}
              cycleCount={core.cycleCount} focused={focusedCore===core.id}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {LEGEND.map(({ state, label, color }) => (
          <div key={state} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm"
              style={{ background: color+'40', border: `1.5px solid ${color}` }} />
            <span className="text-sm" style={{ color: 'var(--muted)' }}>
              {label} <span className="font-mono font-medium" style={{ color: 'var(--text)' }}>
                {counts[state]||0}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
