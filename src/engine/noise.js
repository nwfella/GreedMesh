// ─── 3D Simplex-like Noise (Perlin) ────────────────────────────────
// Classic permutation-table based Perlin noise, 3D.

const PERM_SIZE = 256;
const p = new Uint8Array(PERM_SIZE * 2);

// Initialize permutation table from a seed
function initPerm(seed = 42) {
  const arr = new Uint8Array(PERM_SIZE);
  for (let i = 0; i < PERM_SIZE; i++) arr[i] = i;
  // Fisher-Yates shuffle seeded
  let s = seed;
  for (let i = PERM_SIZE - 1; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647;  // LCG
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  for (let i = 0; i < PERM_SIZE * 2; i++) {
    p[i] = arr[i % PERM_SIZE];
  }
}

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a, b, t) { return a + t * (b - a); }
function grad(hash, x, y, z) {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

export function noise3D(x, y, z) {
  const X = Math.floor(x) & (PERM_SIZE - 1);
  const Y = Math.floor(y) & (PERM_SIZE - 1);
  const Z = Math.floor(z) & (PERM_SIZE - 1);
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const zf = z - Math.floor(z);
  const u = fade(xf);
  const v = fade(yf);
  const w = fade(zf);

  const a  = p[X] + Y;
  const aa = p[a] + Z;
  const ab = p[a + 1] + Z;
  const b  = p[X + 1] + Y;
  const ba = p[b] + Z;
  const bb = p[b + 1] + Z;

  return lerp(
    lerp(
      lerp(grad(p[aa], xf, yf, zf), grad(p[ba], xf - 1, yf, zf), u),
      lerp(grad(p[ab], xf, yf - 1, zf), grad(p[bb], xf - 1, yf - 1, zf), u),
      v
    ),
    lerp(
      lerp(grad(p[aa + 1], xf, yf, zf - 1), grad(p[ba + 1], xf - 1, yf, zf - 1), u),
      lerp(grad(p[ab + 1], xf, yf - 1, zf - 1), grad(p[bb + 1], xf - 1, yf - 1, zf - 1), u),
      v
    ),
    w
  );
}

// Fractal Brownian Motion — layered noise for terrain
export function fbm(x, y, z, octaves = 4, lacunarity = 2.0, gain = 0.5) {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxVal = 0;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise3D(x * frequency, y * frequency, z * frequency);
    maxVal += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return value / maxVal;
}

// Initialize once
initPerm(137);

export { initPerm };
