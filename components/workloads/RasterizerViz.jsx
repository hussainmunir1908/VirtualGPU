'use client';

import { useEffect, useRef } from 'react';
import { FB_WIDTH, FB_HEIGHT } from '@/simulation/rasterizer';

const TRIANGLE_LABELS = [
  'Front+0','Front+1','Back+0','Back+1',
  'Left+0', 'Left+1', 'Right+0','Right+1',
  'Top+0',  'Top+1',  'Bot+0', 'Bot+1',
];

// Canvas redraws every render tick — no key-guard (batchIdx resets between
// triangles, a guard would block most updates).
export default function RasterizerViz({ rasterizer }) {
  const fbRef    = useRef(null);
  const depthRef = useRef(null);

  useEffect(() => {
    // Framebuffer — always reads frameBuffer (complete frame via double buffering)
    if (fbRef.current && rasterizer?.frameBuffer) {
      const ctx = fbRef.current.getContext('2d');
      const img = ctx.createImageData(FB_WIDTH, FB_HEIGHT);
      img.data.set(rasterizer.frameBuffer);
      ctx.putImageData(img, 0, 0);
    }
    // Depth buffer (grayscale heatmap)
    if (depthRef.current && rasterizer?.depthBuffer) {
      const ctx  = depthRef.current.getContext('2d');
      const img  = ctx.createImageData(FB_WIDTH, FB_HEIGHT);
      const db   = rasterizer.depthBuffer;
      let minZ = Infinity, maxZ = -Infinity;
      for (let i = 0; i < db.length; i++) {
        if (db[i] < Infinity) { minZ = Math.min(minZ, db[i]); maxZ = Math.max(maxZ, db[i]); }
      }
      const range = maxZ - minZ || 1;
      for (let i = 0; i < db.length; i++) {
        const b = i * 4;
        const v = db[i] === Infinity ? 230 : Math.round(40 + ((db[i] - minZ) / range) * 180);
        img.data[b] = img.data[b+1] = img.data[b+2] = v;
        img.data[b+3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }
  }); // no deps array — run after every render

  if (!rasterizer) return (
    <div className="flex items-center justify-center h-full text-sm font-mono" style={{ color: 'var(--muted)' }}>
      Initializing…
    </div>
  );

  const {
    triangleQueue, frameCount, fragmentsThisFrame,
    fragmentInvocations, depthPassCount, depthFailCount, coreUtilization,
  } = rasterizer;

  const depthTotal = depthPassCount + depthFailCount;
  const passRate   = depthTotal > 0 ? ((depthPassCount / depthTotal) * 100).toFixed(0) : '—';

  return (
    <div className="flex flex-col gap-2 h-full overflow-auto">

      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          Triangle Rasterization
          <span className="text-xs font-normal ml-2" style={{ color: 'var(--muted)' }}>Rotating 3D Cube</span>
        </span>
        <span className="font-mono text-xs" style={{ color: 'var(--accent)' }}>Frame #{frameCount}</span>
      </div>

      {/* Main panels row */}
      <div className="flex flex-wrap gap-3">

        {/* ── Framebuffer ── */}
        <div className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: 'var(--muted)' }}>Framebuffer ({FB_WIDTH}×{FB_HEIGHT})</span>
          <div className="relative rounded overflow-hidden"
            style={{ width: 320, height: 240,
                     border: '1px solid var(--border)' }}>
            <canvas ref={fbRef} width={FB_WIDTH} height={FB_HEIGHT}
              style={{ width:'100%', height:'100%', imageRendering:'pixelated', display:'block' }} />
            {frameCount === 0 && (
              <div className="absolute inset-0 flex items-center justify-center
                text-sm font-mono pointer-events-none"
                style={{ background: 'rgba(242,237,228,0.7)', color: 'var(--muted)' }}>
                Press RUN to render
              </div>
            )}
          </div>
        </div>

        {/* ── Depth buffer ── */}
        <div className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: 'var(--muted)' }}>Z-Buffer</span>
          <div className="rounded overflow-hidden"
            style={{ width: 160, height: 120, border: '1px solid var(--border)' }}>
            <canvas ref={depthRef} width={FB_WIDTH} height={FB_HEIGHT}
              style={{ width:'100%', height:'100%', imageRendering:'pixelated', display:'block' }} />
          </div>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            Depth pass: <span className="font-mono" style={{ color: 'var(--accent)' }}>{passRate}%</span>
          </span>
        </div>

        {/* ── Triangle queue ── */}
        <div className="flex flex-col gap-1 flex-1 min-w-28">
          <span className="text-xs" style={{ color: 'var(--muted)' }}>Triangle Queue (12)</span>
          <div className="flex flex-col gap-0.5 overflow-y-auto rounded"
            style={{ maxHeight: 130, background: 'var(--bg)',
                     border: '1px solid var(--border)', padding: '6px' }}>
            {(triangleQueue || []).map((tri, i) => {
              const col = tri.state === 'done'      ? 'var(--green)'
                        : tri.state === 'in-flight' ? 'var(--blue)'
                        :                              'var(--dim)';
              return (
                <div key={tri.id}
                  className="flex items-center justify-between px-1.5 py-0.5 rounded"
                  style={{ border: `1px solid ${col}44`, backgroundColor: col+'18' }}>
                  <span className="font-mono text-xs" style={{ color: col }}>
                    ▲ {TRIANGLE_LABELS[i] ?? `#${tri.id}`}
                  </span>
                  {tri.fragments > 0 && (
                    <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>{tri.fragments}f</span>
                  )}
                  <span className="font-mono font-bold" style={{ color: col, fontSize: 9 }}>
                    {tri.state.replace('_','-').toUpperCase()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-1 mt-1">
            {[
              ['Frags/frame',  (fragmentsThisFrame || 0).toLocaleString(), 'var(--green)'],
              ['Invocations',  (fragmentInvocations|| 0).toLocaleString(), 'var(--blue)'],
              ['Core util',    `${(coreUtilization||0).toFixed(0)}%`,      'var(--amber)'],
              ['Frames',       frameCount,                                  'var(--purple)'],
            ].map(([l, v, c]) => (
              <div key={l} className="rounded p-1 text-center"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <div className="text-xs" style={{ color: 'var(--dim)', fontSize: 10 }}>{l}</div>
                <div className="text-sm font-mono font-bold" style={{ color: c }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pipeline stage labels */}
      <div className="flex flex-wrap gap-1.5 shrink-0">
        {[
          ['Vertex Shader',   'Model→Clip space',   'var(--blue)'],
          ['Rasterize',       'Edge / barycentric',  'var(--amber)'],
          ['Fragment Shader', 'Diffuse lighting',    'var(--green)'],
          ['Depth Test',      'Z-buffer write',      'var(--purple)'],
          ['FB Write',        'Pixel output',        'var(--red)'],
        ].map(([l, d, c]) => (
          <div key={l}
            className="flex items-center gap-1 rounded px-2 py-0.5"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: c }} />
            <div>
              <div className="text-xs font-semibold leading-none" style={{ color: c }}>{l}</div>
              <div className="text-xs leading-none" style={{ color: 'var(--muted)' }}>{d}</div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
