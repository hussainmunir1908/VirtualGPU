'use client';
import { useCallback } from 'react';
import { useGPUStore } from '@/store/gpuStore';
import * as gpu from '@/simulation/gpu';

export default function Controls() {
  const { running, speed, workload, matrixSize, setRunning, setSpeed, setMatrixSize } = useGPUStore();

  const handlePlayPause = useCallback(() => {
    if (running) { gpu.pauseSimulation(); setRunning(false); }
    else          { gpu.startSimulation(); setRunning(true);  }
  }, [running, setRunning]);

  const handleStep  = useCallback(() => { if (!running) gpu.stepSimulation(); }, [running]);
  const handleReset = useCallback(() => {
    gpu.fullReset();   // preserves current workload + matrixSize
    setRunning(false);
    setSpeed(1);
  }, [setRunning, setSpeed]);
  const handleSpeed = useCallback((e) => {
    const v = parseFloat(e.target.value); setSpeed(v); gpu.setSpeed(v);
  }, [setSpeed]);
  const handleSize  = useCallback((e) => {
    const s = parseInt(e.target.value); setMatrixSize(s); gpu.setMatrixSize(s);
  }, [setMatrixSize]);

  return (
    <div className="flex items-center gap-2">
      <button onClick={handlePlayPause} className="neu-btn px-3 py-1.5 text-sm font-semibold"
        style={{ color: running?'var(--amber)':'var(--green)',
                 borderColor: running?'var(--amber)':'var(--green)' }}>
        {running ? '⏸ Pause' : '▶ Run'}
      </button>
      <button onClick={handleStep} disabled={running}
        className="neu-btn px-3 py-1.5 text-sm disabled:opacity-30 disabled:cursor-not-allowed">
        Step
      </button>
      <button onClick={handleReset} className="neu-btn px-3 py-1.5 text-sm"
        style={{ color:'var(--red)', borderColor:'var(--border)' }}>
        Reset
      </button>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded text-sm"
        style={{ border:'1px solid var(--border)', background:'var(--raised)' }}>
        <span style={{ color:'var(--dim)' }}>Speed</span>
        <input type="range" min="0.25" max="4" step="0.25" value={speed} onChange={handleSpeed}
          className="w-20 cursor-pointer" style={{ accentColor:'var(--accent)' }} />
        <span className="font-mono w-7 font-medium" style={{ color:'var(--accent)' }}>{speed}×</span>
      </div>
      {workload==='matmul' && (
        <select value={matrixSize} onChange={handleSize}
          className="neu-btn text-sm px-2 py-1.5"
          style={{ color:'var(--text)', outline:'none' }}>
          <option value={8}>8×8</option>
          <option value={16}>16×16</option>
          <option value={32}>32×32</option>
        </select>
      )}
    </div>
  );
}
