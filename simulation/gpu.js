// VirtualGPU Simulation Engine

import { createWarpSchedulerState, tickScheduler, stallWarp, resetWarpScheduler, WARP_STATES } from './scheduler';
import { createMemoryState, updateMemoryStats, getL1HitRate, setVramAllocated,
         recordVramAccess, updateRegisters, fmtBandwidth } from './memory';

export { fmtBandwidth }; // re-export so UI components can use it
import { createMatMulState, tickMatMul, resetMatMul } from './matmul';
import { createRasterizerState, tickRasterizer, resetRasterizer } from './rasterizer';

function createCoreStates(count = 128) {
  return Array(count).fill(null).map((_, i) => ({
    id: i, state: 'idle', warpId: -1, instruction: '', cycleCount: 0,
  }));
}
function createPipelineState() {
  return { fetch: 0, decode: 0, issue: 0, execute: 0, writeback: 0, forwarding: false };
}

export function createInitialState() {
  return {
    cycle: 0, running: false, speed: 1,
    workload: 'matmul', matrixSize: 16,
    cores:      createCoreStates(128),
    scheduler:  createWarpSchedulerState(8),
    memory:     createMemoryState(),
    pipeline:   createPipelineState(),
    matmul:     createMatMulState(16),
    rasterizer: createRasterizerState(),
    occupancy: 0, cacheHitRate: 0, bandwidthGB: 0,
    tflops: 0, coreUtilization: 0,
    instructionsIssued: 0, wastedCycles: 0,
    cpi: 0, ipc: 0, pipelineEff: 0,
    forwardingEvents: 0, hazardsDetected: 0,
    focusedCore: -1, lastStatCycle: 0,
    _shouldPause: false, _loadLineIdx: 0,
    _activeAccum: 0,   // sum of active-core counts across samples (for time-averaged occupancy)
    _accumN:      0,   // number of samples taken (reset every stat period)
  };
}

export let state = createInitialState();

let subscribers = [];
let rafId       = null;
let lastTime    = 0;
let accumulator = 0;
let lastNotify  = 0;
let statRealMs  = 0;  // real ms accumulator for bandwidth calculation

const BASE_CPS   = 120;
const NOTIFY_MS  = 66; // ~15fps display

export function subscribe(fn) {
  subscribers.push(fn);
  return () => { subscribers = subscribers.filter(s => s !== fn); };
}
function notify() { subscribers.forEach(fn => fn(state)); }

// ─── Phase-aware memory simulation ─────────────────────────────────────────
function simulateMemoryAccess(s, issuedWarp) {
  if (s.cycle % 2 !== 0) return;
  const mem = s.memory;

  if (issuedWarp >= 0) {
    mem.registers.hits += 2;
    updateRegisters(mem, s.scheduler.warps);
  }

  if (s.workload === 'matmul' && !s.matmul.done) {
    const mat  = s.matmul;
    const tile = mat.tiles[mat.currentTileIdx];
    if (!tile) return;
    const linesPerTile = Math.max(2, Math.ceil(mat.tileSize * mat.size * 8 / 64));
    if (tile.state === 'loading') {
      const lineOffset = s._loadLineIdx % linesPerTile;
      s._loadLineIdx++;
      const tag = tile.id * linesPerTile + lineOffset;
      mem.l1.misses++;
      mem.l2.misses++;
      recordVramAccess(mem, tag);
    } else if (tile.state === 'computing') {
      mem.l1.hits++;
    }
  } else if (s.workload === 'rasterizer') {
    const roll = Math.random();
    if (roll < 0.65) {
      mem.l1.hits++;
    } else if (roll < 0.85) {
      mem.l1.misses++;
      mem.l2.hits++;
      const tag = Math.floor(Math.random() * 2000);
      const l1Slot = tag % 64;
      if (mem.l1.lines[l1Slot].state === 'empty') {
        mem.l1.lines[l1Slot] = { state: 'cached', tag, dirty: false };
        mem.l1.used = Math.min(mem.l1.capacity, mem.l1.used + 64);
      }
    } else {
      mem.l1.misses++;
      mem.l2.misses++;
      recordVramAccess(mem, Math.floor(Math.random() * 2000));
    }
  }
}

function simulateForwarding(s) {
  if (s.pipeline.execute > 0 && s.pipeline.issue > 0) {
    if (Math.random() < 0.30) {
      s.hazardsDetected++;
      if (Math.random() < 0.80) {
        s.forwardingEvents++;
        s.pipeline.forwarding = true;
        return;
      }
    }
  }
  s.pipeline.forwarding = false;
}

export function tick() {
  const s = state;
  s.cycle++;

  const { issuedWarp } = tickScheduler(s.scheduler);

  if (issuedWarp >= 0) {
    s.instructionsIssued++;
  } else {
    s.wastedCycles++;
  }

  s.pipeline.writeback = s.pipeline.execute;
  s.pipeline.execute   = s.pipeline.issue;
  s.pipeline.issue     = s.pipeline.decode;
  s.pipeline.decode    = s.pipeline.fetch;
  s.pipeline.fetch     = issuedWarp >= 0 ? 1 : 0;

  simulateForwarding(s);

  // Per-warp random stalls (memory latency, branch divergence)
  if (s.cycle % 15 === 0 && issuedWarp >= 0) {
    const roll = Math.random();
    if      (roll < 0.10) stallWarp(s.scheduler, issuedWarp, 'memory',   8 + Math.floor(Math.random()*8));
    else if (roll < 0.15) stallWarp(s.scheduler, issuedWarp, 'diverged', 4 + Math.floor(Math.random()*5));
  }

  // Global memory storm every ~180 cycles: stalls ALL running warps simultaneously.
  // This is the key event that drives CPI above 1.0 — when NO warp can issue,
  // the pipeline sits idle. GPU architects call this "stall-bound" execution.
  if (s.cycle % 180 === 0 && Math.random() < 0.45) {
    const stallLen = 12 + Math.floor(Math.random() * 10);
    s.scheduler.warps.forEach((w, wi) => {
      if (w.state === 'running') stallWarp(s.scheduler, wi, 'memory', stallLen);
    });
  }

  // Update core state display every 8 cycles — reduces flicker while still responsive.
  // Warp scheduling continues every cycle regardless.
  if (s.cycle % 8 === 0) {
    s.scheduler.warps.forEach((warp, wi) => {
      for (let ci = 0; ci < 16; ci++) {
        const idx = wi * 16 + ci;
        if (idx >= 128) break;
        const core = s.cores[idx];
        switch (warp.state) {
          case WARP_STATES.DONE:
            core.state = ci % 5 === 0 ? 'retiring' : 'idle'; break;
          case WARP_STATES.RUNNING:
            if (wi === s.scheduler.activeWarpIdx) {
              core.state = 'active';
              core.warpId = warp.id;
              core.instruction = warp.instruction;
            } else if (core.state === 'active') {
              core.state = 'idle';
            }
            break;
          case WARP_STATES.WAITING_MEMORY: core.state = 'stalled';  break;
          case WARP_STATES.DIVERGED:       core.state = 'diverged'; break;
          case WARP_STATES.STALLED:        core.state = 'stalled';  break;
        }
      }
    });
    // Accumulate for time-averaged occupancy (prevents instantaneous-snapshot jitter)
    const activeNow = s.cores.filter(c => c.state === 'active').length;
    s._activeAccum += activeNow;
    s._accumN++;
  }

  simulateMemoryAccess(s, issuedWarp);

  if (s.workload === 'matmul') {
    if (!s.matmul.startCycle) s.matmul.startCycle = s.cycle;
    if (!s.matmul.done) {
      tickMatMul(s.matmul, s.memory, s.cores, s.cycle,
        (wi, reason, cycles) => stallWarp(s.scheduler, wi, reason, cycles),
        issuedWarp, s.speed);
      s.tflops = s.matmul.tflops;
      if (s.matmul.done) {
        s.cores.forEach(c => { c.state = 'idle'; });
        s._shouldPause = true;
      }
    } else {
      s.cores.forEach(c => { if (c.state === 'active') c.state = 'idle'; });
    }
  } else {
    tickRasterizer(s.rasterizer, s.cores, s.cycle, s.speed);
  }

  if (s.cycle - s.lastStatCycle >= 30) {
    // Bandwidth: use real elapsed ms (gives proportionate KB/MB/GB/s per workload size)
    updateMemoryStats(s.memory, statRealMs > 0 ? statRealMs : 250);
    statRealMs = 0;

    // Time-averaged occupancy: use accumulated samples across the stat window,
    // not a single instantaneous snapshot (which is very noisy at high speeds).
    const avgActive = s._accumN > 0 ? s._activeAccum / s._accumN : 0;
    s._activeAccum = 0;
    s._accumN = 0;
    const rawOccupancy = avgActive / 128 * 100;
    // Heavy EMA (80% old) so the percentage changes slowly and is readable
    s.occupancy = +(s.occupancy * 0.80 + rawOccupancy * 0.20).toFixed(1);

    s.cacheHitRate = +(getL1HitRate(s.memory) * 100).toFixed(1);
    s.bandwidthGB  = +s.memory.vram.bandwidth.toFixed(4); // keep precision; display formats the unit

    // Rasterizer core util also smoothed with heavy EMA
    const rawUtil = s.workload === 'rasterizer'
      ? s.rasterizer.coreUtilization
      : rawOccupancy;
    s.coreUtilization = +(s.coreUtilization * 0.80 + rawUtil * 0.20).toFixed(1);

    s.cpi = s.instructionsIssued > 0
      ? +(s.cycle / s.instructionsIssued).toFixed(2) : 0;
    s.ipc = s.cycle > 0
      ? +(s.instructionsIssued / s.cycle).toFixed(3) : 0;
    s.pipelineEff = s.cycle > 0
      ? +((s.instructionsIssued / s.cycle) * 100).toFixed(1) : 0;
    s.lastStatCycle = s.cycle;
  }
}

function loop(timestamp) {
  if (!state.running) return;
  const dt = Math.min(timestamp - lastTime, 100);
  lastTime = timestamp;
  statRealMs += dt;  // accumulate real ms for bandwidth
  accumulator += (dt / 1000) * BASE_CPS * state.speed;
  const cycles = Math.floor(accumulator);
  accumulator -= cycles;
  for (let i = 0; i < cycles; i++) tick();

  if (state._shouldPause) {
    state._shouldPause = false;
    state.running = false;
    notify();
    return;
  }

  if (timestamp - lastNotify >= NOTIFY_MS) {
    lastNotify = timestamp;
    notify();
  }

  rafId = requestAnimationFrame(loop);
}

export function startSimulation() {
  if (state.running) return;
  state.running = true;
  lastTime = performance.now();
  rafId = requestAnimationFrame(loop);
}
export function pauseSimulation() {
  state.running = false;
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}
export function stepSimulation() { tick(); notify(); }
export function setSpeed(speed) { state.speed = speed; }
export function setWorkload(workload) { state.workload = workload; resetAll(); }
export function setFocusedCore(id) { state.focusedCore = id; notify(); }

function initVram() {
  const s = state;
  setVramAllocated(s.memory,
    s.workload === 'matmul'
      ? 3 * s.matrixSize * s.matrixSize * 4
      : 400 * 300 * 4 * 2 + 4096);
}

export function resetAll() {
  const s = state;
  const wasRunning = s.running;
  if (wasRunning) pauseSimulation();

  s.cycle = 0; s.lastStatCycle = 0;
  s.occupancy = 0; s.cacheHitRate = 0; s.bandwidthGB = 0;
  s.tflops = 0; s.coreUtilization = 0;
  s.instructionsIssued = 0; s.wastedCycles = 0;
  s.cpi = 0; s.ipc = 0; s.pipelineEff = 0;
  s.forwardingEvents = 0; s.hazardsDetected = 0;
  s._shouldPause = false; s._loadLineIdx = 0;
  s._activeAccum = 0; s._accumN = 0;
  statRealMs = 0;

  s.cores = createCoreStates(128);
  resetWarpScheduler(s.scheduler, 8);
  s.pipeline = createPipelineState();
  s.memory = createMemoryState();

  if (s.workload === 'matmul') {
    resetMatMul(s.matmul, s.matrixSize);
    s.matmul.startCycle = 0;
  } else {
    resetRasterizer(s.rasterizer);
  }
  initVram();
  notify();
  if (wasRunning) startSimulation();
}

export function setMatrixSize(size) {
  state.matrixSize = size;
  resetMatMul(state.matmul, size);
  state.matmul.startCycle = 0;
  state._loadLineIdx = 0;
  setVramAllocated(state.memory, 3 * size * size * 4);
  notify();
}

export function fullReset() {
  // Preserve the user's current workload and matrix size selections
  const currentWorkload   = state.workload;
  const currentMatrixSize = state.matrixSize;

  pauseSimulation();
  accumulator = 0;
  statRealMs  = 0;

  state = createInitialState();
  state.workload   = currentWorkload;
  state.matrixSize = currentMatrixSize;

  // Reinitialize workload state with preserved settings
  if (currentWorkload === 'matmul') {
    resetMatMul(state.matmul, currentMatrixSize);
    state.matmul.startCycle = 0;
  } else {
    resetRasterizer(state.rasterizer);
  }
  initVram();
  notify();
}
