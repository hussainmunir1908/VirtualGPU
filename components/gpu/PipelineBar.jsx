'use client';

const STAGES = [
  { key:'fetch',     label:'IF', full:'Instruction Fetch'  },
  { key:'decode',    label:'ID', full:'Instruction Decode' },
  { key:'issue',     label:'IS', full:'Issue / Dispatch'   },
  { key:'execute',   label:'EX', full:'Execute (ALU/FPU)'  },
  { key:'writeback', label:'WB', full:'Write Back'         },
];

export default function PipelineBar({ pipeline, pipelineEff=0, forwardingEvents=0, hazardsDetected=0 }) {
  if (!pipeline) return null;
  const values = STAGES.map(s => pipeline[s.key]||0);
  const fwd = pipeline.forwarding;

  return (
    <div className="flex flex-col gap-2 h-full overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
        <span className="text-sm font-semibold" style={{ color:'var(--text)' }}>Pipeline</span>
        <div className="flex items-center gap-2">
          {fwd && <span className="text-xs font-mono animate-pulse" style={{ color:'var(--blue)' }}>⟲ Forwarding</span>}
          <span className="font-mono text-sm" style={{ color:'var(--dim)' }}>
            Eff: <span style={{ color: pipelineEff>=95?'var(--green)':pipelineEff>=80?'var(--amber)':'var(--red)' }}>
              {pipelineEff>0 ? pipelineEff+'%' : '—'}
            </span>
          </span>
        </div>
      </div>

      <div className="flex items-end gap-2 flex-1">
        {STAGES.map((stage, i) => {
          const active = values[i] > 0;
          const isFwd  = fwd && (i===2||i===3);
          const color  = !active ? 'var(--border)' : isFwd ? 'var(--blue)' : 'var(--green)';
          return (
            <div key={stage.key} className="flex-1 flex flex-col items-center gap-1 h-full" title={stage.full}>
              <div className="w-full flex-1 rounded-sm flex items-end overflow-hidden"
                style={{ background:'var(--bg)', border:'1px solid var(--border)' }}>
                <div className="w-full rounded-sm transition-all duration-200"
                  style={{ height: active?'100%':'15%', background:color, opacity:active?1:0.4 }} />
              </div>
              <span className="font-mono text-sm font-semibold"
                style={{ color: active ? color : 'var(--dim)' }}>{stage.label}</span>
            </div>
          );
        })}
      </div>

      {fwd && (
        <div className="text-xs font-mono text-center shrink-0" style={{ color:'var(--blue)' }}>
          EX ──▶ IS &nbsp;<span style={{ color:'var(--dim)' }}>(RAW data forwarding)</span>
        </div>
      )}

      <div className="flex gap-3 shrink-0" style={{ fontSize:12 }}>
        <span style={{ color:'var(--dim)' }}>Hazards: <span className="font-mono" style={{ color:'var(--amber)' }}>{hazardsDetected}</span></span>
        <span style={{ color:'var(--dim)' }}>Fwd: <span className="font-mono" style={{ color:'var(--blue)' }}>{forwardingEvents}</span></span>
        <span className="ml-auto font-mono" style={{ color:'var(--dim)' }}>IF→ID→IS→EX→WB</span>
      </div>
    </div>
  );
}
