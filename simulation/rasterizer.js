// GPU Software Rasterizer — rotating 3D cube with depth buffer and diffuse lighting
// Full pipeline: vertex shader → rasterize (barycentric) → fragment shader → depth test → framebuffer

export const FB_WIDTH  = 400;
export const FB_HEIGHT = 300;

// ─── 3D Math ─────────────────────────────────────────────────────────────────

function dot(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
function cross(a, b) {
  return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}
function sub3(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function normalize(v) {
  const l = Math.sqrt(dot(v,v)) || 1;
  return [v[0]/l, v[1]/l, v[2]/l];
}
function mulMat4Vec(m, x, y, z) {
  return {
    x: m[0]*x + m[4]*y + m[8]*z  + m[12],
    y: m[1]*x + m[5]*y + m[9]*z  + m[13],
    z: m[2]*x + m[6]*y + m[10]*z + m[14],
    w: m[3]*x + m[7]*y + m[11]*z + m[15],
  };
}
function matMul(a, b) {
  const r = new Array(16).fill(0);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++)
      for (let k = 0; k < 4; k++)
        r[i + j*4] += a[i + k*4] * b[k + j*4];
  return r;
}
function rotY(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [c,0,s,0, 0,1,0,0, -s,0,c,0, 0,0,0,1];
}
function rotX(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [1,0,0,0, 0,c,-s,0, 0,s,c,0, 0,0,0,1];
}

// ─── Cube Geometry ────────────────────────────────────────────────────────────

const VERTS = [
  [-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],
  [-1,-1, 1],[1,-1, 1],[1,1, 1],[-1,1, 1],
];

// 12 triangles (2 per face), each entry: [v0,v1,v2, faceColorIndex]
const TRIS = [
  [4,5,6,0],[4,6,7,0],   // front  (+Z)
  [1,0,3,1],[1,3,2,1],   // back   (-Z)
  [0,4,7,2],[0,7,3,2],   // left   (-X)
  [5,1,2,3],[5,2,6,3],   // right  (+X)
  [7,6,2,4],[7,2,3,4],   // top    (+Y)
  [0,1,5,5],[0,5,4,5],   // bottom (-Y)
];

const FACE_COLORS = [
  [29,158,117],  // teal
  [24, 95,165],  // blue
  [186,117,23],  // amber
  [163,45, 45],  // red
  [124,58,237],  // purple
  [46,134,171],  // cyan
];

const LIGHT = normalize([0.5, 1.0, 0.8]);

// ─── Projection ───────────────────────────────────────────────────────────────

function projectVertex(v, rot) {
  const r = mulMat4Vec(rot, v[0], v[1], v[2]);
  const z = r.z + 4.0;
  if (z < 0.01) return null;
  const fov = 1.5;
  const asp = FB_WIDTH / FB_HEIGHT;
  return {
    x: ( r.x * fov / (asp * z)) * (FB_WIDTH  / 2) + FB_WIDTH  / 2,
    y: (-r.y * fov / z)         * (FB_HEIGHT / 2) + FB_HEIGHT / 2,
    z,
  };
}

function edgeFunction(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

// Rasterize one triangle. Returns array of {x,y,z,r,g,b} fragments.
export function rasterizeTriangle(triIdx, angle) {
  const [vi0, vi1, vi2, fi] = TRIS[triIdx];
  const rot = matMul(rotX(angle * 0.4), rotY(angle));

  const p0 = projectVertex(VERTS[vi0], rot);
  const p1 = projectVertex(VERTS[vi1], rot);
  const p2 = projectVertex(VERTS[vi2], rot);
  if (!p0 || !p1 || !p2) return [];

  // Back-face cull
  const area = edgeFunction(p0, p1, p2);
  if (area >= 0) return [];

  // Face normal + diffuse lighting
  const v0 = VERTS[vi0], v1 = VERTS[vi1], v2 = VERTS[vi2];
  const n  = normalize(cross(sub3(v1, v0), sub3(v2, v0)));
  const diffuse = Math.max(dot(n, LIGHT), 0.08);
  const [fr, fg, fb] = FACE_COLORS[fi];
  const r = Math.min(255, Math.round(fr * diffuse));
  const g = Math.min(255, Math.round(fg * diffuse));
  const b = Math.min(255, Math.round(fb * diffuse));

  // Bounding box
  const minX = Math.max(0,          Math.floor(Math.min(p0.x, p1.x, p2.x)));
  const maxX = Math.min(FB_WIDTH-1, Math.ceil( Math.max(p0.x, p1.x, p2.x)));
  const minY = Math.max(0,          Math.floor(Math.min(p0.y, p1.y, p2.y)));
  const maxY = Math.min(FB_HEIGHT-1,Math.ceil( Math.max(p0.y, p1.y, p2.y)));

  const frags = [];
  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      const p = {x: px+0.5, y: py+0.5};
      const w0 = edgeFunction(p1, p2, p);
      const w1 = edgeFunction(p2, p0, p);
      const w2 = edgeFunction(p0, p1, p);
      if (w0 <= 0 && w1 <= 0 && w2 <= 0) {
        // Interpolate z
        const bary0 = w0/area, bary1 = w1/area, bary2 = w2/area;
        const z = bary0*p0.z + bary1*p1.z + bary2*p2.z;
        frags.push({x: px, y: py, z, r, g, b});
      }
    }
  }
  return frags;
}

// ─── Buffer helpers ───────────────────────────────────────────────────────────

function makeDarkBuf() {
  const fb = new Uint8ClampedArray(FB_WIDTH * FB_HEIGHT * 4);
  // Opaque warm-off-white background to match light theme
  for (let i = 0; i < fb.length; i += 4) { fb[i]=220; fb[i+1]=212; fb[i+2]=198; fb[i+3]=255; }
  return fb;
}

function clearBuf(buf) {
  for (let i = 0; i < buf.length; i += 4) { buf[i]=220; buf[i+1]=212; buf[i+2]=198; buf[i+3]=255; }
}

// ─── State ────────────────────────────────────────────────────────────────────

export function createRasterizerState() {
  return {
    angle: 0,
    frameBuffer:  makeDarkBuf(),   // display: always a complete frame
    backBuffer:   makeDarkBuf(),   // write target during rasterization
    depthBuffer:  new Float32Array(FB_WIDTH * FB_HEIGHT).fill(Infinity),
    triangleQueue: TRIS.map((_, i) => ({id: i, state: 'pending', fragments: 0})),
    currentTriIdx: 0,
    frameCount: 0,
    fragmentsThisFrame: 0,
    totalFragmentsThisFrame: 0,
    fragmentInvocations: 0,
    depthPassCount: 0,
    depthFailCount: 0,
    coreUtilization: 0,
    activeCores: [],
    fragmentBatch: [],
    batchIdx: 0,
  };
}

// ─── Tick ─────────────────────────────────────────────────────────────────────

const FRAGS_PER_TICK = 384;

export function tickRasterizer(rastState, coreStates, cycle, speedFactor = 1) {
  const batchSize = Math.ceil(FRAGS_PER_TICK * speedFactor);

  // ── A. Drain current fragment batch ──────────────────────────────────────
  if (rastState.fragmentBatch.length > 0) {
    const end = Math.min(rastState.batchIdx + batchSize, rastState.fragmentBatch.length);
    const activeSet = new Set();

    for (let i = rastState.batchIdx; i < end; i++) {
      const frag = rastState.fragmentBatch[i];
      const fbIdx = frag.y * FB_WIDTH + frag.x;
      rastState.fragmentInvocations++;

      if (frag.z < rastState.depthBuffer[fbIdx]) {
        rastState.depthPassCount++;
        rastState.depthBuffer[fbIdx] = frag.z;
        // Write to backBuffer, NOT frameBuffer
        const base = fbIdx * 4;
        rastState.backBuffer[base]   = frag.r;
        rastState.backBuffer[base+1] = frag.g;
        rastState.backBuffer[base+2] = frag.b;
        rastState.backBuffer[base+3] = 255;
      } else {
        rastState.depthFailCount++;
      }
      activeSet.add(Math.floor(i / 32) % 128);
    }

    rastState.batchIdx = end;
    rastState.activeCores = [...activeSet];

    for (let i = 0; i < 128; i++) {
      if (coreStates[i]) {
        coreStates[i].state = activeSet.has(i) ? 'active'
          : coreStates[i].state === 'active' ? 'retiring'
          : coreStates[i].state;
      }
    }
    rastState.coreUtilization = (activeSet.size / 128) * 100;

    if (rastState.batchIdx >= rastState.fragmentBatch.length) {
      rastState.triangleQueue[rastState.currentTriIdx].state = 'done';
      rastState.fragmentBatch = [];
      rastState.batchIdx = 0;
      rastState.currentTriIdx++;
    }
    return;
  }

  // ── B. Frame complete — SWAP buffers ─────────────────────────────────────
  if (rastState.currentTriIdx >= TRIS.length) {
    rastState.angle += 0.025 * speedFactor;

    // Swap: completed back buffer becomes the display frame buffer
    const tmp = rastState.frameBuffer;
    rastState.frameBuffer = rastState.backBuffer;
    rastState.backBuffer  = tmp;
    // Clear the (now old) back buffer for next frame
    clearBuf(rastState.backBuffer);

    rastState.depthBuffer.fill(Infinity);
    rastState.frameCount++;
    rastState.fragmentsThisFrame = rastState.totalFragmentsThisFrame;
    rastState.totalFragmentsThisFrame = 0;
    rastState.currentTriIdx = 0;
    rastState.triangleQueue = TRIS.map((_, i) => ({id: i, state: 'pending', fragments: 0}));
    return;
  }

  // ── C. Next triangle ──────────────────────────────────────────────────────
  rastState.triangleQueue[rastState.currentTriIdx].state = 'in-flight';
  const frags = rasterizeTriangle(rastState.currentTriIdx, rastState.angle);
  rastState.triangleQueue[rastState.currentTriIdx].fragments = frags.length;
  rastState.totalFragmentsThisFrame += frags.length;

  if (frags.length === 0) {
    rastState.triangleQueue[rastState.currentTriIdx].state = 'done';
    rastState.currentTriIdx++;
    return;
  }
  rastState.fragmentBatch = frags;
  rastState.batchIdx = 0;
}

export function resetRasterizer(state) {
  Object.assign(state, createRasterizerState());
}
