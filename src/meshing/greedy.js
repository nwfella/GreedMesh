// ─── Greedy Meshing Algorithm ──────────────────────────────────────
// The signature technique: merges adjacent same-type faces into the
// largest possible quads, reducing vertex count 10-20x vs. naive.
//
// For each axis (X,Y,Z) × each direction (±):
//   1. For each 2D slice, build a mask of exposed faces
//   2. Greedy-scan the mask for maximal rectangles
//   3. Emit one quad per rectangle
//
// Output: parallel Float32Arrays of positions (xyz) and colors (rgb).

import {
  CHUNK_SIZE_X as CX,
  CHUNK_SIZE_Y as CY,
  CHUNK_SIZE_Z as CZ,
  BLOCK, BLOCK_COLORS, FACE_SHADE,
} from '../engine/constants.js';

// ─── Helpers ───────────────────────────────────────────────────────

function idx3(x, y, z) {
  return (y * CZ + z) * CX + x;
}

// Check whether a voxel face is exposed (neighbor is air/water or OOB)
function isExposed(voxels, x, y, z, axis, dir) {
  const nx = x + (axis === 0 ? dir : 0);
  const ny = y + (axis === 1 ? dir : 0);
  const nz = z + (axis === 2 ? dir : 0);

  if (nx < 0 || nx >= CX || ny < 0 || ny >= CY || nz < 0 || nz >= CZ) {
    return true; // chunk edge — always exposed
  }
  const n = voxels[idx3(nx, ny, nz)];
  return n === BLOCK.AIR || n === BLOCK.WATER;
}

// ─── Main ──────────────────────────────────────────────────────────

const DIRECTIONS = [
  { axis: 0, dir: -1, shade: FACE_SHADE.left   },
  { axis: 0, dir:  1, shade: FACE_SHADE.right  },
  { axis: 1, dir: -1, shade: FACE_SHADE.bottom },
  { axis: 1, dir:  1, shade: FACE_SHADE.top    },
  { axis: 2, dir: -1, shade: FACE_SHADE.back   },
  { axis: 2, dir:  1, shade: FACE_SHADE.front  },
];

export function greedyMesh(voxels, ox, oy, oz) {
  const positions = [];
  const colors = [];

  // Reusable mask buffer — sized for the largest slice
  const mask = new Uint8Array(Math.max(CX, CY) * Math.max(CY, CZ));

  for (const { axis, dir, shade } of DIRECTIONS) {
    // Dimensions of each 2D slice perpendicular to `axis`
    // axis=0 (X): slice is Y×Z — dimU=CZ, dimV=CY, map: u=Z, v=Y
    // axis=1 (Y): slice is X×Z — dimU=CX, dimV=CZ, map: u=X, v=Z
    // axis=2 (Z): slice is X×Y — dimU=CX, dimV=CY, map: u=X, v=Y
    const dimU = axis === 0 ? CZ : (axis === 1 ? CX : CX);
    const dimV = axis === 0 ? CY : (axis === 1 ? CZ : CY);
    const sliceDim = [CX, CY, CZ][axis];

    // Map (slice, u, v) → (x, y, z)
    function toXYZ(s, u, v) {
      if (axis === 0) return [s, v, u]; // X=s, Y=v, Z=u
      if (axis === 1) return [u, s, v]; // X=u, Y=s, Z=v
      return [u, v, s];                  // X=u, Y=v, Z=s
    }

    for (let slice = 0; slice < sliceDim; slice++) {
      // ── Step 1: build 2D mask ──
      let hasAny = false;
      for (let v = 0; v < dimV; v++) {
        for (let u = 0; u < dimU; u++) {
          const [x, y, z] = toXYZ(slice, u, v);
          const block = voxels[idx3(x, y, z)];
          if (block === BLOCK.AIR || block === BLOCK.WATER) {
            mask[v * dimU + u] = 0;
          } else if (isExposed(voxels, x, y, z, axis, dir)) {
            mask[v * dimU + u] = block;
            hasAny = true;
          } else {
            mask[v * dimU + u] = 0;
          }
        }
      }
      if (!hasAny) continue;

      // ── Step 2: greedy scan for maximal rectangles ──
      for (let v = 0; v < dimV; v++) {
        for (let u = 0; u < dimU; u++) {
          const blockType = mask[v * dimU + u];
          if (blockType === 0) continue;

          // Grow width (along U)
          let w = 1;
          while (u + w < dimU && mask[v * dimU + (u + w)] === blockType) w++;

          // Grow height (along V)
          let h = 1;
          let ok = true;
          while (v + h < dimV && ok) {
            for (let uu = u; uu < u + w; uu++) {
              if (mask[(v + h) * dimU + uu] !== blockType) { ok = false; break; }
            }
            if (ok) h++;
          }

          // Clear used cells
          for (let vv = v; vv < v + h; vv++) {
            for (let uu = u; uu < u + w; uu++) {
              mask[vv * dimU + uu] = 0;
            }
          }

          // ── Step 3: emit quad ──
          const color = BLOCK_COLORS[blockType] || [1, 0, 1];
          const facePos = dir > 0 ? slice + 1 : slice;

          // Quad corners in (u, v) space, then mapped to (x, y, z)
          const A = toXYZ(facePos, u,     v    );
          const B = toXYZ(facePos, u + w, v    );
          const C = toXYZ(facePos, u + w, v + h);
          const D = toXYZ(facePos, u,     v + h);

          // World-space vertices
          const verts = [
            [A[0] + ox, A[1] + oy, A[2] + oz],
            [B[0] + ox, B[1] + oy, B[2] + oz],
            [C[0] + ox, C[1] + oy, C[2] + oz],
            [D[0] + ox, D[1] + oy, D[2] + oz],
          ];

          // Two triangles: A-B-C and A-C-D
          const [cr, cg, cb] = color;
          const idx = [0, 1, 2, 0, 2, 3];
          for (const i of idx) {
            const vv = verts[i];
            positions.push(vv[0], vv[1], vv[2]);
            colors.push(cr * shade[0], cg * shade[1], cb * shade[2]);
          }
        }
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    vertexCount: positions.length / 3,
  };
}
