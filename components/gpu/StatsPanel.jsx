'use client';
import { fmtBandwidth } from '@/simulation/gpu';

function Metric({ label, value, unit, color, sub }) {
  return (
    <div className="rounded p-2.5" style={{ background:'var(--bg)', border:'1px solid var(--border)' }}>
      <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color:'var(--dim)' }}>{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="font-mono font-bold text-lg" style={{ color }}>{value}</span>
        {unit && <span className="text-sm" style={{ color:'var(--dim)' }}>{unit}</span>}
      </div>
      {sub && <div className="text-xs mt-0.5" style={{ color:'var(--dim)' }}>{sub}</div>}
    </div>
  );
}

export default function StatsPanel({ state }) {
  if (!state) return null;
  const { workload, occupancy, cacheHitRate, bandwidthGB,
          tflops, cpi, ipc, pipelineEff, forwardingEvents, hazardsDetected,
          matmul, rasterizer } = state;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold" style={{ color:'var(--text)' }}>Performance</span>
      <div className="grid grid-cols-3 gap-2">
        <Metric label="IPC"       value={ipc>0?ipc.toFixed(3):'—'}       color="var(--accent)" sub="Instr/cycle (ideal=1)" />
        <Metric label="CPI"       value={cpi>0?cpi.toFixed(2):'—'}       color="var(--purple)" sub="Cycles/instruction" />
        <Metric label="Pipeline"  value={pipelineEff>0?pipelineEff+'%':'—'} color="var(--green)"  sub="Stage efficiency" />
        <Metric label="Occupancy" value={occupancy.toFixed(0)} unit="%"   color="var(--green)" />
        <Metric label="L1 Hit"    value={cacheHitRate.toFixed(0)} unit="%" color="var(--blue)" />
        <Metric label="Bandwidth" value={fmtBandwidth(bandwidthGB)} color="var(--amber)" />
        <Metric label="Hazards"   value={hazardsDetected}                  color="var(--amber)" sub="RAW detected" />
        <Metric label="Forwarded" value={forwardingEvents}                  color="var(--blue)"  sub="Stalls avoided" />
        {workload==='matmul' && <>
          <Metric label="TFLOPS"
            value={tflops>0?tflops.toFixed(3):'—'}
            color="var(--green)" sub="FLOPs/sec" />
          <Metric label="Tiles"
            value={`${matmul?.completedTiles??0}/${matmul?.totalTiles??0}`}
            color="var(--purple)" sub="Thread blocks" />
        </>}
        {workload==='rasterizer' && <>
          <Metric label="Frags/frame"
            value={(rasterizer?.fragmentsThisFrame??0).toLocaleString()}
            color="var(--green)" sub="Pixels shaded" />
          <Metric label="Frames"
            value={rasterizer?.frameCount??0}
            color="var(--purple)" sub="Rendered" />
          <Metric label="Depth Pass"
            value={(() => {
              const p = rasterizer?.depthPassCount??0;
              const f = rasterizer?.depthFailCount??0;
              return p+f > 0 ? Math.round(p/(p+f)*100)+'%' : '—';
            })()}
            color="var(--blue)" sub="Z-test pass rate" />
          <Metric label="Core Util"
            value={(state.coreUtilization??0).toFixed(0)}
            unit="%" color="var(--amber)" sub="Shader utilization" />
        </>}
      </div>
    </div>
  );
}
