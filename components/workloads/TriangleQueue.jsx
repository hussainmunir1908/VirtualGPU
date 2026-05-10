'use client';

import { memo } from 'react';

const STATE_STYLES = {
  pending:   { color: '#6e7681', label: 'PENDING' },
  'in-flight': { color: '#185FA5', label: 'IN-FLIGHT' },
  done:      { color: '#1D9E75', label: 'DONE' },
};

const TriangleQueue = memo(function TriangleQueue({ triangleQueue, rasterizer }) {
  if (!triangleQueue) return null;

  const fps = rasterizer?.frameCount ?? 0;
  const frags = rasterizer?.fragmentsThisFrame ?? 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-gpu-muted uppercase tracking-widest">Triangle Queue</span>
        <span className="text-xs font-mono text-gpu-muted">
          Frame #{rasterizer?.frameCount ?? 0}
        </span>
      </div>

      <div className="flex flex-col gap-1 overflow-y-auto max-h-48">
        {triangleQueue.map((tri) => {
          const style = STATE_STYLES[tri.state] || STATE_STYLES.pending;
          return (
            <div
              key={tri.id}
              className="flex items-center justify-between px-2 py-1 rounded bg-gpu-bg border border-gpu-border/50"
            >
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: style.color }} />
                <span className="text-xs font-mono text-gpu-text">▲ Tri #{tri.id}</span>
              </div>
              <div className="flex items-center gap-3">
                {tri.fragments > 0 && (
                  <span className="text-xs font-mono text-gpu-muted">{tri.fragments} frags</span>
                )}
                <span className="text-xs font-mono font-semibold" style={{ color: style.color }}>
                  {style.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 mt-1">
        <div className="flex-1 bg-gpu-bg border border-gpu-border rounded p-1.5 text-center">
          <div className="text-xs font-mono text-gpu-muted">Fragments</div>
          <div className="text-sm font-mono text-gpu-active">{frags.toLocaleString()}</div>
        </div>
        <div className="flex-1 bg-gpu-bg border border-gpu-border rounded p-1.5 text-center">
          <div className="text-xs font-mono text-gpu-muted">Invocations</div>
          <div className="text-sm font-mono text-gpu-accent">
            {(rasterizer?.fragmentInvocations ?? 0).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
});

export default TriangleQueue;
