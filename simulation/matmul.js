// Matrix Multiplication Simulation Logic
// Simulates C = A × B on GPU using tiled thread blocks

export function createMatMulState(size = 16) {
  const A = Array(size).fill(null).map(() =>
    Array(size).fill(null).map(() => +(Math.random() * 2 - 1).toFixed(2))
  );
  const B = Array(size).fill(null).map(() =>
    Array(size).fill(null).map(() => +(Math.random() * 2 - 1).toFixed(2))
  );
  const C = Array(size).fill(null).map(() => Array(size).fill(null));

  const tileSize = 4;
  const tilesPerRow = Math.ceil(size / tileSize);
  const totalTiles = tilesPerRow * tilesPerRow;

  const tiles = [];
  for (let ty = 0; ty < tilesPerRow; ty++) {
    for (let tx = 0; tx < tilesPerRow; tx++) {
      tiles.push({
        id: ty * tilesPerRow + tx,
        tileRow: ty,
        tileCol: tx,
        state: 'pending',  // pending | loading | computing | done
        progress: 0,
        assignedCores: [],
        cellsDoneLastTick: 0,
      });
    }
  }

  return {
    size, tileSize, A, B, C,
    tiles, totalTiles,
    completedTiles: 0,
    currentTileIdx: 0,
    highlightedA: [],
    highlightedB: [],
    highlightedC: [],
    phaseTimer: 0,
    phase: 'loading',
    tflops: 0,
    startCycle: 0,
    totalFLOPs: 0,
    done: false,  // set true when all tiles complete — stops tick processing
  };
}

// Phase durations in simulation ticks (at BASE_CPS=120, 1x speed ≈ 120 ticks/sec)
const LOAD_TICKS = 15;    // 0.125s per tile loading phase
const COMPUTE_TICKS = 25; // 0.21s per tile compute phase — total ~3.4s for 16 tiles

export function tickMatMul(matmulState, memState, coreStates, cycle, stallWarpFn, activeWarpIdx, speedFactor = 1) {
  const { tiles, size, tileSize, A, B, C } = matmulState;

  // Always increment by 1 — speed is handled by how many ticks run per real second
  // (speedFactor in the phase timer was causing double-scaling: 0.25x gave 16× slower)
  matmulState.phaseTimer += 1;

  const activeTileIdx = matmulState.currentTileIdx;
  if (activeTileIdx >= tiles.length) {
    // All tiles finished — mark done once and halt
    if (!matmulState.done) {
      matmulState.done = true;
      matmulState.highlightedA = [];
      matmulState.highlightedB = [];
      matmulState.highlightedC = [];
    }
    return false;
  }

  const tile = tiles[activeTileIdx];

  // Transition pending → loading
  if (tile.state === 'pending') {
    tile.state = 'loading';
    tile.assignedCores = [];
    for (let i = 0; i < 16; i++) {
      tile.assignedCores.push((activeTileIdx * 16 + i) % 128);
    }
    matmulState.phase = 'loading';
    matmulState.phaseTimer = 0;
    tile.cellsDoneLastTick = 0;
  }

  const tr = tile.tileRow;
  const tc = tile.tileCol;

  if (tile.state === 'loading') {
    const loadDuration = LOAD_TICKS; // fixed ticks; real-time duration scales with speed slider
    tile.progress = Math.min(50, (matmulState.phaseTimer / loadDuration) * 50);

    // Show one tileSize×tileSize block at a time — animate the k-step (inner accumulation)
    // so the highlighted block walks left-to-right across A and top-to-bottom down B.
    const tilesPerRow = Math.ceil(size / tileSize);
    const kStep = Math.min(
      Math.floor((matmulState.phaseTimer / LOAD_TICKS) * tilesPerRow),
      tilesPerRow - 1
    );
    matmulState.highlightedA = [];
    matmulState.highlightedB = [];
    for (let i = 0; i < tileSize; i++) {
      for (let j = 0; j < tileSize; j++) {
        // A block: output-tile rows, k-step columns
        const aRow = tr * tileSize + i;
        const aCol = kStep * tileSize + j;
        if (aRow < size && aCol < size) matmulState.highlightedA.push({ row: aRow, col: aCol });
        // B block: k-step rows, output-tile columns
        const bRow = kStep * tileSize + i;
        const bCol = tc * tileSize + j;
        if (bRow < size && bCol < size) matmulState.highlightedB.push({ row: bRow, col: bCol });
      }
    }

    // Mark assigned cores as active (loading from L2/VRAM)
    tile.assignedCores.forEach(ci => {
      if (coreStates[ci]) coreStates[ci].state = 'active';
    });

    if (matmulState.phaseTimer >= loadDuration) {
      tile.state = 'computing';
      matmulState.phase = 'computing';
      matmulState.phaseTimer = 0;
      tile.cellsDoneLastTick = 0;
    }

  } else if (tile.state === 'computing') {
    const computeDuration = COMPUTE_TICKS; // fixed ticks; real-time duration scales with speed slider
    tile.progress = 50 + Math.min(50, (matmulState.phaseTimer / computeDuration) * 50);

    // During computing, animate the same k-step block through A and B
    // to show which partial products are being accumulated from L1 shared memory.
    const tilesPerRowC = Math.ceil(size / tileSize);
    const kStepC = Math.min(
      Math.floor((matmulState.phaseTimer / COMPUTE_TICKS) * tilesPerRowC),
      tilesPerRowC - 1
    );
    matmulState.highlightedA = [];
    matmulState.highlightedB = [];
    for (let i = 0; i < tileSize; i++) {
      for (let j = 0; j < tileSize; j++) {
        const aRow = tr * tileSize + i;
        const aCol = kStepC * tileSize + j;
        if (aRow < size && aCol < size) matmulState.highlightedA.push({ row: aRow, col: aCol });
        const bRow = kStepC * tileSize + i;
        const bCol = tc * tileSize + j;
        if (bRow < size && bCol < size) matmulState.highlightedB.push({ row: bRow, col: bCol });
      }
    }

    // Progressive dot product — compute newly completed cells this tick
    const fractionDone = Math.min(1, matmulState.phaseTimer / computeDuration);
    const totalCells = tileSize * tileSize;
    const cellsDoneNow = Math.floor(fractionDone * totalCells);
    const prevCellsDone = tile.cellsDoneLastTick;

    matmulState.highlightedC = [];

    for (let ci = 0; ci < cellsDoneNow; ci++) {
      const r = tr * tileSize + Math.floor(ci / tileSize);
      const c = tc * tileSize + (ci % tileSize);
      if (r < size && c < size) {
        // Only compute newly completed cells
        if (ci >= prevCellsDone) {
          let sum = 0;
          for (let k = 0; k < size; k++) sum += A[r][k] * B[k][c];
          C[r][c] = +sum.toFixed(3);
          matmulState.totalFLOPs += 2 * size;
        }
        matmulState.highlightedC.push({ row: r, col: c });
      }
    }
    tile.cellsDoneLastTick = cellsDoneNow;

    // Mark cores as active (computing FMAD operations from shared memory)
    tile.assignedCores.forEach(ci => {
      if (coreStates[ci]) coreStates[ci].state = 'active';
    });

    if (matmulState.phaseTimer >= computeDuration) {
      tile.state = 'done';
      tile.progress = 100;
      matmulState.completedTiles++;
      matmulState.currentTileIdx++;
      matmulState.highlightedA = [];
      matmulState.highlightedB = [];
      tile.assignedCores.forEach(ci => {
        if (coreStates[ci]) coreStates[ci].state = 'retiring';
      });
    }
  }

  // TFLOPS = FLOPs / elapsed_real_seconds (using 847MHz simulated clock)
  const simElapsed = (cycle - matmulState.startCycle) / 847_000_000;
  if (simElapsed > 0) {
    matmulState.tflops = matmulState.totalFLOPs / simElapsed / 1e12;
  }

  return true;
}

export function resetMatMul(state, size = 16) {
  const fresh = createMatMulState(size);
  Object.assign(state, fresh);
}
