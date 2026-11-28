// Procedural PBR detail maps for the house materials. Generated once per visit in plain typed
// arrays (no downloads, no canvas), all seamlessly tileable, so they stay crisp at any instance
// scale and can never fail to load.
//
// Each surface yields two RGBA textures (both linear data):
// - `alb`: albedo multiplier, stored as value / 2 (128 = ×1), so variation sits around the
//   material's base colour instead of replacing it.
// - `dat`: R,G = tangent-space normal x,y (128 = flat) · B = roughness multiplier / 2 · A = cavity
//   (255 = fully open; darker in joints and crevices, applied to indirect light).
//
// The shader (materials.ts) projects them in metres, so `tile` below is the real-world size of one
// repeat. Variation is deliberately restrained: this is a new, well-kept house.

import * as THREE from "three";

export type SurfaceName =
  | "plaster" | "concrete" | "block" | "ashlar" | "wood" | "bark" | "grass" | "gravel" | "soil"
  | "paving" | "foliage" | "metal" | "pool";

type Field = Float32Array;
type Surface = { size: number; height: Field; strength: number; r: Field; g: Field; b: Field; rough: Field; cavity: Field };

// ── Noise primitives ─────────────────────────────────────────────────────────
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tileable value noise with cu × cv lattice cells over the texture, in [0, 1]. */
function noise(n: number, cu: number, cv: number, seed: number): Field {
  const rand = rng(seed);
  const lat = new Float32Array(cu * cv).map(() => rand());
  const out = new Float32Array(n * n);
  const s = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < n; y++) {
    const fy = (y / n) * cv;
    const y0 = Math.floor(fy);
    const ty = s(fy - y0);
    const r0 = (y0 % cv) * cu;
    const r1 = ((y0 + 1) % cv) * cu;
    for (let x = 0; x < n; x++) {
      const fx = (x / n) * cu;
      const x0 = Math.floor(fx);
      const tx = s(fx - x0);
      const c0 = x0 % cu;
      const c1 = (x0 + 1) % cu;
      const a = lat[r0 + c0] + (lat[r0 + c1] - lat[r0 + c0]) * tx;
      const b = lat[r1 + c0] + (lat[r1 + c1] - lat[r1 + c0]) * tx;
      out[y * n + x] = a + (b - a) * ty;
    }
  }
  return out;
}

/** Fractal sum of tileable noise, normalised to [0, 1]. */
function fbm(n: number, cu: number, cv: number, octaves: number, seed: number, gain = 0.5): Field {
  const out = new Float32Array(n * n);
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const layer = noise(n, cu << o, cv << o, seed + o * 101);
    for (let i = 0; i < out.length; i++) out[i] += layer[i] * amp;
    total += amp;
    amp *= gain;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

const filled = (n: number, v: number) => new Float32Array(n * n).fill(v);
const wrap = (i: number, n: number) => ((i % n) + n) % n;

/** Draws a soft-edged disc into a field with a combine function (tileable: wraps at the edges). */
function stamp(f: Field, n: number, cx: number, cy: number, rx: number, ry: number, fn: (cur: number, k: number) => number) {
  const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx);
  const y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      const d = dx * dx + dy * dy;
      if (d >= 1) continue;
      const i = wrap(y, n) * n + wrap(x, n);
      f[i] = fn(f[i], Math.sqrt(1 - d));
    }
  }
}

// ── Surfaces ──────────────────────────────────────────────────────────────────
// Each returns a height field (in pixels of relief × strength) plus albedo/roughness/cavity fields.

function plaster(): Surface {
  const n = 256;
  const fine = fbm(n, 64, 64, 3, 11);
  const mid = fbm(n, 12, 12, 3, 12);
  const cloud = fbm(n, 3, 3, 4, 13);
  const h = fine.map((v, i) => v * 0.65 + mid[i] * 0.35);
  const tone = cloud.map((v, i) => 1 + (v - 0.5) * 0.07 + (fine[i] - 0.5) * 0.04);
  return { size: n, height: h, strength: 2.2, r: tone, g: tone, b: tone, rough: mid.map((v) => 1 + (v - 0.5) * 0.25), cavity: fine.map((v) => 0.9 + v * 0.1) };
}

function concrete(): Surface {
  const n = 256;
  const fine = fbm(n, 48, 48, 3, 21);
  const cloud = fbm(n, 3, 3, 4, 22);
  const h = fine.slice();
  const cav = filled(n, 1);
  const rand = rng(23);
  // Air pores: small, sparse pits.
  for (let k = 0; k < 260; k++) {
    const x = rand() * n, y = rand() * n, r = 0.8 + rand() * 1.4;
    stamp(h, n, x, y, r, r, (c, t) => c - t * 0.9);
    stamp(cav, n, x, y, r, r, (c, t) => Math.min(c, 1 - t * 0.7));
  }
  const tone = cloud.map((v, i) => (1 + (v - 0.5) * 0.12) * (0.94 + fine[i] * 0.12) * (0.85 + cav[i] * 0.15));
  return { size: n, height: h, strength: 1.6, r: tone, g: tone, b: tone, rough: cloud.map((v) => 1 + (0.5 - v) * 0.2), cavity: cav };
}

/** Concrete masonry units, 400 × 200 mm, running bond, 10 mm recessed joints. One tile = 1.6 m. */
function block(): Surface {
  const n = 256;
  const bw = 64, bh = 32, joint = 2;
  const speck = fbm(n, 96, 96, 2, 31);
  const rand = rng(32);
  const tones = Array.from({ length: 64 }, () => 0.94 + rand() * 0.12);
  const h = new Float32Array(n * n), tone = new Float32Array(n * n), cav = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    const row = Math.floor(y / bh);
    const yy = y % bh;
    const off = row % 2 ? bw / 2 : 0;
    for (let x = 0; x < n; x++) {
      const xs = wrap(x + off, n);
      const col = Math.floor(xs / bw);
      const xx = xs % bw;
      const i = y * n + x;
      const inJoint = yy < joint || xx < joint;
      const edge = Math.min(yy - joint, xx - joint, bh - 1 - yy, bw - 1 - xx);
      h[i] = inJoint ? 0 : Math.min(1, 0.6 + edge * 0.2) + (speck[i] - 0.5) * 0.25;
      tone[i] = inJoint ? 1.06 : tones[(row * 4 + col) % 64] * (0.92 + speck[i] * 0.16);
      cav[i] = inJoint ? 0.55 : 1;
    }
  }
  return { size: n, height: h, strength: 1.4, r: tone, g: tone, b: tone.map((v) => v * 0.99), rough: speck.map((v) => 1 + (v - 0.5) * 0.2), cavity: cav };
}

/** Random-coursed natural stone slips with fine joints and a slightly pillowed face. One tile = 1.2 m. */
function ashlar(): Surface {
  const n = 256;
  const joint = 2;
  const rand = rng(41);
  const grain = fbm(n, 24, 24, 3, 42);
  const h = new Float32Array(n * n), r = new Float32Array(n * n), g = new Float32Array(n * n), b = new Float32Array(n * n), cav = new Float32Array(n * n);
  // Course heights summing exactly to the tile, so it repeats seamlessly.
  const courses: number[] = [];
  let used = 0;
  while (used < n) {
    let c = 20 + Math.floor(rand() * 26);
    if (n - used - c < 20) c = n - used;
    courses.push(c);
    used += c;
  }
  let y0 = 0;
  courses.forEach((ch) => {
    // Stone lengths around a ring of width n.
    const cuts: number[] = [];
    let x = Math.floor(rand() * n);
    const start = x;
    while (x < start + n - 40) {
      cuts.push(x % n);
      x += 40 + Math.floor(rand() * 70);
    }
    cuts.push(start % n);
    for (let k = 0; k < cuts.length - 1; k++) {
      const a = cuts[k];
      const len = wrap(cuts[k + 1] - a, n) || n;
      const t = 0.8 + rand() * 0.34;
      const warm = (rand() - 0.5) * 0.08;
      for (let yy = 0; yy < ch; yy++) {
        for (let xx = 0; xx < len; xx++) {
          const i = (y0 + yy) * n + wrap(a + xx, n);
          const inJoint = yy < joint || xx < joint;
          const edge = Math.min(yy - joint, xx - joint, ch - 1 - yy, len - 1 - xx);
          const pillow = Math.min(1, 0.45 + edge * 0.08);
          h[i] = inJoint ? 0 : pillow + (grain[i] - 0.5) * 0.6;
          const v = inJoint ? 0.82 : t * (0.9 + grain[i] * 0.2);
          r[i] = v * (1 + warm);
          g[i] = v;
          b[i] = v * (1 - warm * 1.4);
          cav[i] = inJoint ? 0.5 : 1;
        }
      }
    }
    y0 += ch;
  });
  return { size: n, height: h, strength: 2.4, r, g, b, rough: grain.map((v) => 1 + (v - 0.5) * 0.3), cavity: cav };
}

/** Wood grain: long streaks along u (the shader aligns u with each board's long axis). */
function wood(): Surface {
  const n = 256;
  const grain = fbm(n, 3, 40, 4, 51, 0.55);
  const fine = fbm(n, 6, 160, 2, 52);
  const figure = fbm(n, 2, 6, 3, 53);
  const tone = grain.map((v, i) => 0.84 + v * 0.26 + (fine[i] - 0.5) * 0.08 + (figure[i] - 0.5) * 0.1);
  return { size: n, height: fine.map((v, i) => v * 0.6 + grain[i] * 0.4), strength: 1.2, r: tone, g: tone.map((v) => v * 0.99), b: tone.map((v) => v * 0.97), rough: grain.map((v) => 1 + (v - 0.5) * 0.25), cavity: fine.map((v) => 0.92 + v * 0.08) };
}

/** Bark: vertical fissures (v runs up the trunk). */
function bark(): Surface {
  const n = 256;
  const ridges = fbm(n, 18, 3, 4, 61, 0.55);
  const fine = fbm(n, 64, 32, 2, 62);
  const h = ridges.map((v, i) => Math.pow(v, 1.6) + fine[i] * 0.2);
  const tone = h.map((v) => 0.7 + v * 0.5);
  return { size: n, height: h, strength: 5, r: tone, g: tone, b: tone.map((v) => v * 0.96), rough: filled(n, 1), cavity: h.map((v) => 0.55 + Math.min(v, 1) * 0.45) };
}

/** Lawn: fine blade texture over soft patches of slightly different colour. One tile = 5 m. */
function grass(): Surface {
  const n = 512;
  const blades = noise(n, 256, 256, 71);
  const tufts = fbm(n, 64, 64, 2, 72);
  const patch = fbm(n, 5, 5, 4, 73);
  const h = blades.map((v, i) => v * 0.6 + tufts[i] * 0.4);
  const r = new Float32Array(n * n), g = new Float32Array(n * n), b = new Float32Array(n * n);
  for (let i = 0; i < h.length; i++) {
    const p = Math.min(1, Math.max(0, (patch[i] - 0.35) * 2.2)); // 0 lush … 1 drier
    const k = 0.8 + h[i] * 0.36;
    r[i] = (0.94 + p * 0.16) * k;
    g[i] = (1.0 + p * 0.04) * k;
    b[i] = (0.96 - p * 0.12) * k;
  }
  return { size: n, height: h, strength: 3, r, g, b, rough: filled(n, 1), cavity: h.map((v) => 0.75 + v * 0.25) };
}

/** Washed river gravel, 8–20 mm. One tile = 0.7 m. */
function gravel(): Surface {
  const n = 256;
  const rand = rng(81);
  const h = filled(n, 0), r = filled(n, 0.6), g = filled(n, 0.6), b = filled(n, 0.6), cav = filled(n, 0.45);
  for (let k = 0; k < 1500; k++) {
    const x = rand() * n, y = rand() * n;
    const rx = 2.6 + rand() * 4, ry = rx * (0.65 + rand() * 0.35);
    const t = 0.78 + rand() * 0.42;
    const warm = (rand() - 0.5) * 0.12;
    // The pebble on top (highest dome) owns the pixel's colour.
    for (let yy = Math.floor(y - ry); yy <= Math.ceil(y + ry); yy++)
      for (let xx = Math.floor(x - rx); xx <= Math.ceil(x + rx); xx++) {
        const dx = (xx - x) / rx, dy = (yy - y) / ry;
        const d = dx * dx + dy * dy;
        if (d >= 1) continue;
        const i = wrap(yy, n) * n + wrap(xx, n);
        const s = Math.sqrt(1 - d);
        if (s <= h[i]) continue;
        h[i] = s;
        r[i] = t * (1 + warm);
        g[i] = t;
        b[i] = t * (1 - warm);
        cav[i] = 0.7 + s * 0.3;
      }
  }
  return { size: n, height: h, strength: 4, r, g, b, rough: filled(n, 1), cavity: cav };
}

function soil(): Surface {
  const n = 256;
  const clods = fbm(n, 20, 20, 4, 91, 0.6);
  const damp = fbm(n, 3, 3, 3, 92);
  const tone = clods.map((v, i) => (0.8 + v * 0.36) * (1.08 - damp[i] * 0.16));
  return { size: n, height: clods, strength: 4, r: tone, g: tone, b: tone, rough: damp.map((v) => 1 - v * 0.1), cavity: clods.map((v) => 0.7 + v * 0.3) };
}

/** Large-format porcelain/stone pavers, 600 × 600 mm, 5 mm joints. One tile = 2.4 m. */
function paving(): Surface {
  const n = 256;
  const slab = 64;
  const rand = rng(101);
  const tones = Array.from({ length: 16 }, () => 0.95 + rand() * 0.1);
  const fine = fbm(n, 64, 64, 2, 102);
  const cloud = fbm(n, 8, 8, 3, 103);
  const h = new Float32Array(n * n), tone = new Float32Array(n * n), cav = new Float32Array(n * n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const j = x % slab === 0 || y % slab === 0;
      const k = Math.floor(y / slab) * 4 + Math.floor(x / slab);
      h[i] = j ? 0 : 1 + (fine[i] - 0.5) * 0.15;
      tone[i] = j ? 0.8 : tones[k] * (0.95 + cloud[i] * 0.1);
      cav[i] = j ? 0.6 : 1;
    }
  return { size: n, height: h, strength: 1.2, r: tone, g: tone, b: tone, rough: cloud.map((v) => 1 + (v - 0.5) * 0.2), cavity: cav };
}

/** Leaf clusters for foliage masses and hedges. One tile = 1.1 m. */
function foliage(): Surface {
  const n = 256;
  const rand = rng(111);
  const h = filled(n, 0), r = filled(n, 0.5), g = filled(n, 0.5), b = filled(n, 0.5), cav = filled(n, 0.5);
  for (let k = 0; k < 2600; k++) {
    const x = rand() * n, y = rand() * n;
    const rx = 2 + rand() * 3.5, ry = rx * (0.45 + rand() * 0.35);
    const lift = rand();
    const t = 0.72 + lift * 0.5;
    const hue = (rand() - 0.5) * 0.14;
    for (let yy = Math.floor(y - ry); yy <= Math.ceil(y + ry); yy++)
      for (let xx = Math.floor(x - rx); xx <= Math.ceil(x + rx); xx++) {
        const dx = (xx - x) / rx, dy = (yy - y) / ry;
        const d = dx * dx + dy * dy;
        if (d >= 1) continue;
        const i = wrap(yy, n) * n + wrap(xx, n);
        const v = lift * 0.7 + Math.sqrt(1 - d) * 0.3;
        if (v > h[i]) {
          h[i] = v;
          r[i] = t * (1 + hue);
          g[i] = t;
          b[i] = t * (1 - hue * 0.5);
          cav[i] = 0.55 + v * 0.45;
        }
      }
  }
  return { size: n, height: h, strength: 5, r, g, b, rough: filled(n, 1), cavity: cav };
}

/** Coil-coated metal: faint rolling streaks along u, mostly in roughness. */
function metal(): Surface {
  const n = 256;
  const streak = fbm(n, 2, 64, 3, 121);
  const cloud = fbm(n, 3, 3, 3, 122);
  const tone = cloud.map((v, i) => 1 + (v - 0.5) * 0.06 + (streak[i] - 0.5) * 0.03);
  return { size: n, height: streak, strength: 0.4, r: tone, g: tone, b: tone, rough: streak.map((v, i) => 1 + (v - 0.5) * 0.3 + (cloud[i] - 0.5) * 0.2), cavity: filled(n, 1) };
}

/** Pool: 250 mm tiles seen through the water, and a gentle ripple. One tile = 3 m. */
function pool(): Surface {
  const n = 256;
  const ripple = fbm(n, 6, 6, 3, 131);
  const cloud = fbm(n, 4, 4, 2, 132);
  const t = n / 12;
  const tone = new Float32Array(n * n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const j = x % t < 1.2 || y % t < 1.2;
      tone[i] = (j ? 1.18 : 0.96) * (0.94 + cloud[i] * 0.12);
    }
  return { size: n, height: ripple, strength: 7, r: tone, g: tone, b: tone, rough: filled(n, 1), cavity: filled(n, 1) };
}

const BUILDERS: Record<SurfaceName, () => Surface> = { plaster, concrete, block, ashlar, wood, bark, grass, gravel, soil, paving, foliage, metal, pool };

// ── Packing ──────────────────────────────────────────────────────────────────
type Packed = { size: number; alb: Uint8Array; dat: Uint8Array };

const byte = (v: number) => (v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255));

function pack(s: Surface): Packed {
  const { size: n, height: h } = s;
  const alb = new Uint8Array(n * n * 4);
  const dat = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const dx = (h[y * n + wrap(x + 1, n)] - h[y * n + wrap(x - 1, n)]) * 0.5 * s.strength;
      const dy = (h[wrap(y + 1, n) * n + x] - h[wrap(y - 1, n) * n + x]) * 0.5 * s.strength;
      const len = Math.hypot(dx, dy, 1);
      const o = i * 4;
      alb[o] = byte(s.r[i] / 2);
      alb[o + 1] = byte(s.g[i] / 2);
      alb[o + 2] = byte(s.b[i] / 2);
      alb[o + 3] = 255;
      dat[o] = byte(0.5 - (dx / len) * 0.5);
      dat[o + 1] = byte(0.5 - (dy / len) * 0.5);
      dat[o + 2] = byte(s.rough[i] / 2);
      dat[o + 3] = byte(s.cavity[i]);
    }
  }
  return { size: n, alb, dat };
}

// CPU data survives remounts (the scene unmounts when the page is hidden), so it is built once per visit.
const cache = new Map<SurfaceName, Packed>();

function texture(data: Uint8Array, size: number, anisotropy: number) {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = anisotropy;
  t.colorSpace = THREE.NoColorSpace; // both maps are linear data, decoded in the shader
  t.needsUpdate = true;
  return t;
}

export type SurfaceMaps = { alb: THREE.DataTexture; dat: THREE.DataTexture };

/** GPU textures for a surface. The caller owns (and disposes) them. */
export function surfaceMaps(name: SurfaceName, anisotropy: number): SurfaceMaps {
  let p = cache.get(name);
  if (!p) {
    p = pack(BUILDERS[name]());
    cache.set(name, p);
  }
  return { alb: texture(p.alb, p.size, anisotropy), dat: texture(p.dat, p.size, anisotropy) };
}

/** 1×1 neutral maps for materials without a surface texture. */
export function neutralMaps(): SurfaceMaps {
  const alb = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
  const dat = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
  for (const t of [alb, dat]) t.needsUpdate = true;
  return { alb, dat };
}
