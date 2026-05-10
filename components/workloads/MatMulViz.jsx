'use client';

// Not memoized — updates every tick to show matrix fill-in progress

function MatrixGrid({ label, data, highlighted, hlColor, size }) {
  const hlSet = new Set((highlighted || []).map(h => `${h.row},${h.col}`));
  // Larger cells for smaller matrices so values are readable
  const cell = size <= 8 ? 30 : size <= 16 ? 20 : 11;
  // Font scales with cell size — always show values when cell is big enough
  const fs   = cell >= 28 ? 9 : cell >= 18 ? 7 : 0;

  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <span className="text-xs font-mono font-semibold" style={{ color: 'var(--muted)' }}>{label}</span>
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${size},${cell}px)`, gap:1 }}>
        {data.map((row, ri) => row.map((val, ci) => {
          const hl = hlSet.has(`${ri},${ci}`);
          return (
            <div key={`${ri}-${ci}`} style={{
              width: cell, height: cell,
              backgroundColor: hl ? `${hlColor}30` : 'var(--surface)',
              border: `1px solid ${hl ? hlColor : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              // Use a dark readable color — var(--text) on the beige background
              fontSize: fs, color: hl ? hlColor : 'var(--muted)',
              fontFamily: '"JetBrains Mono", monospace',
              overflow: 'hidden', transition: 'background-color 0.1s',
              borderRadius: 2,
              fontWeight: hl ? '600' : '400',
            }}>
              {fs > 0 && val != null ? val.toFixed(1) : ''}
            </div>
          );
        }))}
      </div>
    </div>
  );
}

function CMatrix({ data, tiles, size, tileSize }) {
  // Build cell → tile state map
  const cellState = {};
  (tiles || []).forEach(tile => {
    for (let dr = 0; dr < tileSize; dr++)
      for (let dc = 0; dc < tileSize; dc++) {
        const r = tile.tileRow * tileSize + dr;
        const c = tile.tileCol * tileSize + dc;
        if (r < size && c < size) cellState[`${r},${c}`] = tile.state;
      }
  });

  const cell = size <= 8 ? 30 : size <= 16 ? 20 : 11;
  const fs   = cell >= 28 ? 9 : cell >= 18 ? 7 : 0;

  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <span className="text-xs font-mono font-semibold" style={{ color: 'var(--muted)' }}>C (Result)</span>
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${size},${cell}px)`, gap:1 }}>
        {(data || []).map((row, ri) => (row || []).map((val, ci) => {
          const ts = cellState[`${ri},${ci}`] || 'pending';
          const isDone      = ts === 'done';
          const isComputing = ts === 'computing';
          const isLoading   = ts === 'loading';
          const bg = isDone ? 'rgba(58,104,72,0.18)' : isComputing ? 'rgba(42,80,128,0.14)' : isLoading ? 'rgba(138,94,24,0.14)' : 'var(--surface)';
          const bd = isDone ? 'var(--green)' : isComputing ? 'var(--blue)' : isLoading ? 'var(--amber)' : 'var(--border)';
          const tc = isDone ? 'var(--green)' : isComputing ? 'var(--blue)' : 'var(--muted)';

          return (
            <div key={`${ri}-${ci}`} style={{
              width: cell, height: cell,
              backgroundColor: bg, border: `1px solid ${bd}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: fs, color: tc, fontFamily: '"JetBrains Mono", monospace',
              overflow: 'hidden', transition: 'background-color 0.15s',
              borderRadius: 2,
            }}>
              {fs > 0 && val != null ? val.toFixed(1) : ''}
            </div>
          );
        }))}
      </div>
    </div>
  );
}

export default function MatMulViz({ matmul }) {
  if (!matmul) return (
    <div className="flex items-center justify-center h-full text-sm font-mono" style={{ color: 'var(--muted)' }}>
      Initializing...
    </div>
  );

  const { A, B, C, tiles, size, tileSize, completedTiles, totalTiles, highlightedA, highlightedB, tflops, done } = matmul;
  const pct = totalTiles > 0 ? Math.round(completedTiles / totalTiles * 100) : 0;
  const activeTile = done ? null :
    (tiles || []).find(t => t.state === 'computing') || (tiles || []).find(t => t.state === 'loading');

  return (
    <div className="flex flex-col gap-2 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          C = A × B &nbsp;<span className="font-mono text-xs font-normal" style={{ color: 'var(--muted)' }}>({size}×{size})</span>
        </span>
        <div className="flex items-center gap-3">
          {done ? (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ color: 'var(--green)', background: 'rgba(58,104,72,0.12)' }}>✓ COMPLETE</span>
          ) : activeTile ? (
            <span className="text-xs" style={{ color: 'var(--amber)' }}>
              {activeTile.state === 'loading' ? '▼ Load' : '⚡ Compute'} tile #{activeTile.id}
            </span>
          ) : null}
          <span className="font-mono text-xs" style={{ color: 'var(--accent)' }}>{completedTiles}/{totalTiles} blocks</span>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
          <div className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, backgroundColor: done ? 'var(--green)' : 'var(--blue)' }} />
        </div>
        <span className="font-mono text-xs" style={{ color: done ? 'var(--green)' : 'var(--dim)' }}>{pct}%</span>
        {tflops > 0 && <span className="font-mono text-xs" style={{ color: 'var(--accent)' }}>{tflops.toFixed(3)}T</span>}
      </div>

      {/* Matrices */}
      <div className="flex flex-wrap gap-3 items-start justify-center overflow-auto">
        <MatrixGrid label={`A (${size}×${size})`} data={A} highlighted={highlightedA} hlColor="var(--blue)" size={size} />
        <div className="self-center text-2xl font-mono" style={{ color: 'var(--dim)' }}>×</div>
        <MatrixGrid label={`B (${size}×${size})`} data={B} highlighted={highlightedB} hlColor="var(--amber)" size={size} />
        <div className="self-center text-2xl font-mono" style={{ color: 'var(--dim)' }}>=</div>
        <CMatrix data={C} tiles={tiles} size={size} tileSize={tileSize} />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-auto pt-1 shrink-0"
        style={{ borderTop: '1px solid var(--border)' }}>
        {[
          ['var(--border)', 'Pending'],
          ['var(--amber)',  'Loading (L2→L1)'],
          ['var(--blue)',   'Computing (FMAD)'],
          ['var(--green)',  'Done'],
        ].map(([c,l]) => (
          <div key={l} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor:c+'40', border:`1px solid ${c}` }} />
            <span className="text-xs" style={{ color: 'var(--muted)' }}>{l}</span>
          </div>
        ))}
        <div className="ml-auto font-mono text-xs hidden md:block" style={{ color: 'var(--dim)' }}>
          CPU: {size**3} ops &nbsp;⚡&nbsp; GPU: {totalTiles} parallel blocks
        </div>
      </div>
    </div>
  );
}
