'use client';

import { create } from 'zustand';

// Lightweight store — only holds UI control state.
// The GPU snapshot is NOT stored here; it's read directly from the simulation
// module in VirtualGPU's render via the tick counter pattern.
export const useGPUStore = create((set) => ({
  tick: 0,          // increments each animation frame to trigger re-renders
  workload: 'matmul',
  running: false,
  speed: 1,
  matrixSize: 16,
  focusedCore: -1,

  bumpTick:       ()         => set(s => ({ tick: s.tick + 1 })),
  setWorkload:    (workload)  => set({ workload }),
  setRunning:     (running)   => set({ running }),
  setSpeed:       (speed)     => set({ speed }),
  setMatrixSize:  (size)      => set({ matrixSize: size }),
  setFocusedCore: (id)        => set({ focusedCore: id }),
}));
