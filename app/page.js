'use client';

import { useEffect } from 'react';
import { useGPUStore } from '@/store/gpuStore';
import * as gpu from '@/simulation/gpu';
import { fmtBandwidth } from '@/simulation/gpu';

import Controls from '@/components/ui/Controls';
import WorkloadTabs from '@/components/ui/WorkloadTabs';
import CoreGrid from '@/components/gpu/CoreGrid';
import WarpTable from '@/components/gpu/WarpTable';
import PipelineBar from '@/components/gpu/PipelineBar';
import MemoryHierarchy from '@/components/gpu/MemoryHierarchy';
import StatsPanel from '@/components/gpu/StatsPanel';
import MatMulViz from '@/components/workloads/MatMulViz';
import RasterizerViz from '@/components/workloads/RasterizerViz';

export default function VirtualGPU() {
  const { workload, running, bumpTick, setRunning } = useGPUStore();

  useEffect(() => {
    const unsub = gpu.subscribe(() => {
      bumpTick();
      if (!gpu.state.running && running) setRunning(false);
    });
    return unsub;
  }, [bumpTick, setRunning, running]);

  const s = gpu.state;

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* ── Header ── */}
      <header className="shrink-0 mx-3 mt-2.5 px-4 py-2 neu-card flex items-center gap-3 flex-wrap">
        <WorkloadTabs />
        <div className="w-px h-5" style={{ background: 'var(--border)' }} />
        <Controls />
        <div className="w-px h-5" style={{ background: 'var(--border)' }} />
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full"
            style={{ background: running ? 'var(--green)' : 'var(--dim)' }} />
          <span className="text-sm font-medium"
            style={{ color: running ? 'var(--green)' : 'var(--dim)' }}>
            {running ? 'RUNNING' : 'PAUSED'}
          </span>
        </div>
        <div className="flex-1" />
        <span className="font-mono text-sm" style={{ color: 'var(--dim)' }}>847 MHz</span>
      </header>

      {/* ── Stats bar ── */}
      <div className="shrink-0 mx-3 mt-1.5 px-4 py-2 neu-card flex items-center gap-0 overflow-x-auto">
        {[
          { label: 'CYCLE',    value: s.cycle.toLocaleString(),                    color: 'var(--purple)' },
          { label: 'IPC',      value: s.ipc > 0 ? s.ipc.toFixed(3) : '—',         color: 'var(--accent)' },
          { label: 'CPI',      value: s.cpi > 0 ? s.cpi.toFixed(2) : '—',         color: 'var(--blue)'   },
          { label: 'PIPELINE', value: s.pipelineEff > 0 ? s.pipelineEff+'%' : '—', color: 'var(--green)'  },
          { label: 'OCCUPANCY',value: s.occupancy.toFixed(0)+'%',                  color: 'var(--green)'  },
          { label: 'L1 HIT',   value: s.cacheHitRate.toFixed(0)+'%',              color: 'var(--blue)'   },
          { label: 'BANDWIDTH',value: fmtBandwidth(s.bandwidthGB),                 color: 'var(--amber)'  },
          { label: workload==='matmul' ? 'TFLOPS' : 'FRAMES',
            value: workload==='matmul'
              ? (s.tflops>0 ? s.tflops.toFixed(3) : '—')
              : (s.rasterizer?.frameCount??0),
            color: 'var(--accent)' },
          { label: 'FWD',      value: s.forwardingEvents.toLocaleString(),         color: 'var(--blue)'   },
          { label: 'HAZARDS',  value: s.hazardsDetected.toLocaleString(),          color: 'var(--amber)'  },
        ].map(({ label, value, color }, i, arr) => (
          <div key={label} className="flex items-center">
            <div className="flex items-center gap-2 px-3">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--dim)' }}>
                {label}
              </span>
              <span className="font-mono text-base font-semibold" style={{ color }}>{value}</span>
            </div>
            {i < arr.length-1 && <div className="w-px h-4" style={{ background: 'var(--border)' }} />}
          </div>
        ))}
      </div>

      {/* ── Main grid ── */}
      <div className="flex-1 overflow-hidden flex gap-2 p-3 pt-2 min-h-0">

        {/* LEFT column */}
        <div className="flex flex-col gap-2 min-w-0" style={{ flex: '1.2' }}>
          {/* Core grid — shrink-0 so it stays its natural height */}
          <div className="neu-card p-4 shrink-0">
            <CoreGrid cores={s.cores} focusedCore={s.focusedCore} />
          </div>
          {/* Workload viz takes remaining space */}
          <div className="neu-card p-4 flex-1 overflow-hidden min-h-0">
            {workload === 'matmul'
              ? <MatMulViz matmul={s.matmul} />
              : <RasterizerViz rasterizer={s.rasterizer} />
            }
          </div>
        </div>

        {/* RIGHT column — FIXED heights on every panel to prevent layout shift */}
        <div className="flex flex-col gap-2 min-w-0" style={{ flex: '0.8' }}>
          {/* Warp scheduler — fixed 220px */}
          <div className="neu-card p-3.5" style={{ height: 220, overflow: 'hidden' }}>
            <WarpTable scheduler={s.scheduler} />
          </div>
          {/* Pipeline — fixed 150px */}
          <div className="neu-card p-3.5" style={{ height: 150, overflow: 'hidden' }}>
            <PipelineBar
              pipeline={s.pipeline}
              pipelineEff={s.pipelineEff}
              forwardingEvents={s.forwardingEvents}
              hazardsDetected={s.hazardsDetected}
            />
          </div>
          {/* Memory hierarchy — fixed 220px with scroll */}
          <div className="neu-card p-3.5" style={{ height: 220, overflowY: 'auto' }}>
            <MemoryHierarchy memory={s.memory} />
          </div>
          {/* Stats — takes remaining space */}
          <div className="neu-card p-3.5 flex-1 overflow-y-auto min-h-0">
            <StatsPanel state={s} />
          </div>
        </div>
      </div>
    </div>
  );
}
