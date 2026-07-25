// ─── Voxel Chunk ───────────────────────────────────────────────────
// Stores a 3D grid of block IDs and generates terrain via FBM noise.

import {
  CHUNK_SIZE_X as CX,
  CHUNK_SIZE_Y as CY,
  CHUNK_SIZE_Z as CZ,
  BLOCK,
} from '../engine/constants.js';
import { fbm } from '../engine/noise.js';

function idx(x, y, z) {
  return (y * CZ + z) * CX + x;
}

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;  // chunk coordinate X
    this.cz = cz;  // chunk coordinate Z
    this.voxels = new Uint8Array(CX * CY * CZ);
    this.mesh = null;        // { vao, vertexCount }
    this.needsRemesh = true;
  }

  /** World-space X position of this chunk's origin */
  get wx() { return this.cx * CX; }
  /** World-space Z position of this chunk's origin */
  get wz() { return this.cz * CZ; }

  /** Get block at local coordinates */
  getBlock(x, y, z) {
    if (x < 0 || x >= CX || y < 0 || y >= CY || z < 0 || z >= CZ) return -1; // out of bounds
    return this.voxels[idx(x, y, z)];
  }

  /** Set block at local coordinates */
  setBlock(x, y, z, blockType) {
    if (x < 0 || x >= CX || y < 0 || y >= CY || z < 0 || z >= CZ) return false;
    this.voxels[idx(x, y, z)] = blockType;
    this.needsRemesh = true;
    return true;
  }

  /** Generate terrain using FBM noise */
  generate() {
    const seaLevel = 32;
    const rockDepth = 4;

    for (let x = 0; x < CX; x++) {
      for (let z = 0; z < CZ; z++) {
        const wx = this.wx + x;
        const wz = this.wz + z;

        // Height from 2D noise
        const heightRaw = fbm(wx * 0.02, wz * 0.02, 0, 4, 1.8, 0.55);
        const height = Math.floor((heightRaw + 1) * 20 + 28);

        // 3D cave noise
        const caveThreshold = 0.05; // lower = more caves

        for (let y = 0; y < CY && y <= height; y++) {
          let blockType = BLOCK.STONE;

          if (y < height - rockDepth) {
            // Stone layer — add caves
            const caveNoise = fbm(wx * 0.06, y * 0.06, wz * 0.06, 3, 2.0, 0.5);
            if (caveNoise < caveThreshold) {
              blockType = BLOCK.AIR; // carve cave
            } else {
              blockType = BLOCK.STONE;
            }
          } else if (y < height - 2) {
            // Near-surface: dirt/stone mix
            blockType = (fbm(wx * 0.1, y * 0.1, wz * 0.1, 2) > 0.1) ? BLOCK.DIRT : BLOCK.STONE;
          } else if (y < height - 1) {
            blockType = BLOCK.DIRT;
          } else if (y === height) {
            // Surface layer — depends on height and climate
            if (height > 52) {
              blockType = BLOCK.SNOW;
            } else if (height < 30) {
              blockType = BLOCK.SAND;
            } else {
              blockType = BLOCK.GRASS;
            }
          }

          // Water fill below sea level
          if (blockType === BLOCK.AIR && y < seaLevel && height < seaLevel) {
            blockType = BLOCK.WATER;
          }

          this.voxels[idx(x, y, z)] = blockType;
        }

        // Fill below height with air for non-generated areas
        for (let y = height + 1; y < CY; y++) {
          this.voxels[idx(x, y, z)] = BLOCK.AIR;
        }
      }
    }

    this.needsRemesh = true;
  }

  /** Clear chunk to all air */
  clear() {
    this.voxels.fill(BLOCK.AIR);
    this.needsRemesh = true;
  }
}
