// GPU Memory Hierarchy — Registers / L1 / L2 / VRAM

export const L1_LINES = 64;
export const L2_LINES = 128;
export const REG_LINES = 32; // 4 lines per warp × 8 warps

export function createMemoryState() {
  return {
    registers: {
      // 256KB register file. Lines represent per-warp register banks.
      used: 0, capacity: 262144, hits: 0, misses: 0,
      lines: Array(REG_LINES).fill(null).map(() => ({ state: 'empty' })),
    },
    l1: {
      used: 0, capacity: 49152, hits: 0, misses: 0,
      lines: Array(L1_LINES).fill(null).map(() => ({ state: 'empty', tag: -1, dirty: false })),
    },
    l2: {
      used: 0, capacity: 4194304, hits: 0, misses: 0,
      lines: Array(L2_LINES).fill(null).map(() => ({ state: 'empty', tag: -1, dirty: false })),
    },
    vram: {
      used: 0, capacity: 8589934592, hits: 0, misses: 0,
      bandwidth: 0, peakBandwidth: 500,
    },
    totalBandwidthBytes: 0,
  };
}

// Recompute cache used-bytes from actual non-empty lines
function recalcUsed(cache) {
  cache.used = cache.lines.filter(l => l.state !== 'empty').length * 64;
}

// Fill L1+L2 with a fetched line and update VRAM stats
export function recordVramAccess(mem, tag) {
  const l1Slot = tag % L1_LINES;
  const l2Slot = tag % L2_LINES;
  mem.l1.lines[l1Slot] = { state: 'cached', tag, dirty: false };
  mem.l2.lines[l2Slot] = { state: 'cached', tag, dirty: false };
  recalcUsed(mem.l1);
  recalcUsed(mem.l2);
  mem.vram.hits++;
  mem.totalBandwidthBytes += 64;
}

// Update register file visualization based on active warp states
export function updateRegisters(mem, warps) {
  const LINES_PER_WARP = 4; // 4 register-file banks per warp
  warps.forEach((warp, wi) => {
    const base  = wi * LINES_PER_WARP;
    const state = warp.state === 'done'           ? 'empty'
                : warp.state === 'waiting_memory'  ? 'dirty'
                : warp.state === 'stalled'          ? 'dirty'
                : warp.state === 'diverged'         ? 'dirty'
                : 'cached'; // running
    for (let li = 0; li < LINES_PER_WARP; li++) {
      if (base + li < REG_LINES) {
        mem.registers.lines[base + li] = { state };
      }
    }
  });
  const activeWarps = warps.filter(w => w.state !== 'done').length;
  // Each warp uses 32 threads × 32 regs × 4 bytes = 4096 bytes
  mem.registers.used = Math.min(mem.registers.capacity, activeWarps * 4096);
}

// realElapsedMs: actual wall-clock milliseconds since last update.
// Each recorded access represents a coalesced warp fetch (32 threads × 64 bytes),
// so we scale by 32 to get the true parallel data rate. Result stored in GB/s
// but callers should use fmtBandwidth() to display the right unit (KB/MB/GB/s).
export function updateMemoryStats(mem, realElapsedMs) {
  const seconds = Math.max(realElapsedMs, 1) / 1000;
  if (mem.totalBandwidthBytes > 0) {
    // Scale by 32 threads (coalesced warp access — one fetch serves 32 threads)
    const parallelBytes = mem.totalBandwidthBytes * 32;
    const rawGBs = (parallelBytes / seconds) / 1e9;
    mem.vram.bandwidth = mem.vram.bandwidth * 0.45 + rawGBs * 0.55;
  } else {
    mem.vram.bandwidth *= 0.70; // decay when no VRAM traffic
  }
  mem.totalBandwidthBytes = 0;
}

// Adaptive bandwidth formatter — picks the correct unit for the value.
export function fmtBandwidth(gbps) {
  const bps = gbps * 1e9;
  if (bps >= 1e9) return `${gbps.toFixed(2)} GB/s`;
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} MB/s`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(0)} KB/s`;
  return `${bps.toFixed(0)} B/s`;
}

export function setVramAllocated(mem, bytes) {
  mem.vram.used = bytes;
}

export function getL1HitRate(mem) {
  const t = mem.l1.hits + mem.l1.misses;
  return t === 0 ? 0 : mem.l1.hits / t;
}
