// Warp Round-Robin Scheduler
// Implements GPU warp scheduling: 8 warps of 32 threads each

export const WARP_STATES = {
  RUNNING: 'running',
  STALLED: 'stalled',
  WAITING_MEMORY: 'waiting_memory',
  DONE: 'done',
  DIVERGED: 'diverged',
};

export const INSTRUCTIONS = ['FMAD', 'FADD', 'FMUL', 'LD', 'ST', 'SYNC', 'BRANCH', 'MOV', 'ISETP', 'RET'];

// Instructions per warp wave before recycling — large enough to span the whole workload
const WAVE_LENGTH = 200;

export function createWarpSchedulerState(numWarps = 8) {
  return {
    warps: Array(numWarps).fill(null).map((_, i) => ({
      id: i,
      threadCount: 32,
      state: WARP_STATES.RUNNING,
      progress: 0,
      instruction: INSTRUCTIONS[i % INSTRUCTIONS.length],
      cycleCount: 0,
      memoryWaitCycles: 0,
      stallCycles: 0,
      pc: 0,
    })),
    activeWarpIdx: 0,
    roundRobinCounter: 0,
    totalScheduled: 0,
  };
}

export function tickScheduler(schedulerState) {
  const { warps } = schedulerState;

  // Decrement stall/memory wait cycles
  warps.forEach(w => {
    if (w.state === WARP_STATES.WAITING_MEMORY) {
      w.memoryWaitCycles = Math.max(0, w.memoryWaitCycles - 1);
      if (w.memoryWaitCycles === 0) w.state = WARP_STATES.RUNNING;
    } else if (w.state === WARP_STATES.STALLED) {
      w.stallCycles = Math.max(0, w.stallCycles - 1);
      if (w.stallCycles === 0) w.state = WARP_STATES.RUNNING;
    } else if (w.state === WARP_STATES.DIVERGED) {
      w.stallCycles = Math.max(0, w.stallCycles - 1);
      if (w.stallCycles === 0) w.state = WARP_STATES.RUNNING;
    }
    // Warps that finish a wave restart — this keeps them running throughout the workload
    if (w.state === WARP_STATES.DONE) {
      w.state = WARP_STATES.RUNNING;
      w.progress = 0;
    }
  });

  // Round-robin: find next runnable warp
  const startIdx = schedulerState.roundRobinCounter;
  let selected = -1;
  for (let i = 0; i < warps.length; i++) {
    const idx = (startIdx + i) % warps.length;
    if (warps[idx].state === WARP_STATES.RUNNING) {
      selected = idx;
      break;
    }
  }

  if (selected === -1) {
    return { issuedWarp: -1, issued: false };
  }

  schedulerState.activeWarpIdx = selected;
  schedulerState.roundRobinCounter = (selected + 1) % warps.length;
  schedulerState.totalScheduled++;

  const warp = warps[selected];
  warp.cycleCount++;
  warp.pc = (warp.pc + 1) % INSTRUCTIONS.length;
  warp.instruction = INSTRUCTIONS[warp.pc];
  warp.progress = Math.min(100, warp.progress + (100 / WAVE_LENGTH));

  if (warp.progress >= 100) {
    warp.state = WARP_STATES.DONE; // will be recycled next tick
  }

  return { issuedWarp: selected, issued: true };
}

export function stallWarp(schedulerState, warpIdx, reason, cycles) {
  const warp = schedulerState.warps[warpIdx];
  if (!warp) return;
  if (reason === 'memory') {
    warp.state = WARP_STATES.WAITING_MEMORY;
    warp.memoryWaitCycles = cycles;
  } else if (reason === 'stall') {
    warp.state = WARP_STATES.STALLED;
    warp.stallCycles = cycles;
  } else if (reason === 'diverged') {
    warp.state = WARP_STATES.DIVERGED;
    warp.stallCycles = cycles;
  }
}

export function resetWarpScheduler(schedulerState, numWarps = 8) {
  const fresh = createWarpSchedulerState(numWarps);
  schedulerState.warps = fresh.warps;
  schedulerState.activeWarpIdx = 0;
  schedulerState.roundRobinCounter = 0;
  schedulerState.totalScheduled = 0;
}
