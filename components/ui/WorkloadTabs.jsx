'use client';
import { useCallback } from 'react';
import { useGPUStore } from '@/store/gpuStore';
import * as gpu from '@/simulation/gpu';

const TABS = [
  { key:'matmul',     label:'Matrix Multiply', icon:'⊞' },
  { key:'rasterizer', label:'Rasterizer',       icon:'◈' },
];

export default function WorkloadTabs() {
  const { workload, setWorkload, setRunning } = useGPUStore();
  const switchTo = useCallback((w) => {
    if (w===workload) return;
    gpu.pauseSimulation(); setRunning(false);
    setWorkload(w); gpu.setWorkload(w);
  }, [workload, setWorkload, setRunning]);

  return (
    <div className="flex gap-1">
      {TABS.map(({ key, label, icon }) => {
        const active = workload===key;
        return (
          <button key={key} onClick={()=>switchTo(key)}
            className="px-3 py-1.5 rounded text-sm font-medium transition-all"
            style={{
              background: active ? 'var(--raised)' : 'transparent',
              color:      active ? 'var(--accent)' : 'var(--dim)',
              border:     `1px solid ${active ? 'var(--accent)' : 'transparent'}`,
            }}>
            <span className="mr-1">{icon}</span>{label}
          </button>
        );
      })}
    </div>
  );
}
