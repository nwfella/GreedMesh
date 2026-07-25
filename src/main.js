// ─── Main Entry Point ──────────────────────────────────────────────
// Game loop: manages chunks, player physics, rendering, block interaction.

import { Camera } from './engine/camera.js';
import { Input } from './engine/input.js';
import { Renderer } from './engine/renderer.js';
import { Chunk } from './world/chunk.js';
import { greedyMesh } from './meshing/greedy.js';
import {
  CHUNK_SIZE_X as CX,
  CHUNK_SIZE_Y as CY,
  CHUNK_SIZE_Z as CZ,
  VIEW_DISTANCE,
  BLOCK, HOTBAR_BLOCKS,
  PLAYER_HALF_W, PLAYER_HEIGHT,
  PLAYER_SPEED, JUMP_SPEED, GRAVITY,
} from './engine/constants.js';

// ─── Setup (with error isolation) ──────────────────────────────────

// Wrap everything in a try-catch so the user can see what went wrong
try {

const canvas = document.getElementById('canvas');
if (!canvas) throw new Error('Canvas element not found');

const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
if (!gl) {
  // WebGL2 not available — show error on splash screen instead of blank
  document.getElementById('blocker-content').innerHTML = `
    <h1 style="color:#ff6b6b;">⚠️ WebGL2 Not Available</h1>
    <p>Your browser or GPU doesn't support WebGL2.</p>
    <p style="font-size:0.85rem;color:#888;margin-top:16px;">
      Try Chrome, Edge, or Firefox (latest version) with hardware acceleration enabled.
    </p>
  `;
  throw new Error('WebGL2 required');
}

const renderer = new Renderer(gl);
const camera = new Camera();
const input = new Input(canvas);

// ─── UI refs ───────────────────────────────────────────────────────

const blocker = document.getElementById('blocker');
const fpsDisplay = document.getElementById('fps-display');
const triDisplay = document.getElementById('tri-display');
const chunkDisplay = document.getElementById('chunk-display');
const posDisplay = document.getElementById('pos-display');
const blockSlots = document.querySelectorAll('.block-slot');

let selectedBlockIdx = 0;
function updateBlockUI() {
  blockSlots.forEach((el, i) => el.classList.toggle('active', i === selectedBlockIdx));
}

blockSlots.forEach((el, i) => {
  el.addEventListener('click', () => { selectedBlockIdx = i; updateBlockUI(); });
});

// ─── World ─────────────────────────────────────────────────────────

const chunks = new Map(); // key: "cx,cz" → { chunk, mesh }

function chunkKey(cx, cz) { return `${cx},${cz}`; }

function getOrCreateChunk(cx, cz) {
  const key = chunkKey(cx, cz);
  if (chunks.has(key)) return chunks.get(key).chunk;
  const chunk = new Chunk(cx, cz);
  chunk.generate();
  chunks.set(key, { chunk, mesh: null });
  return chunk;
}

function getChunk(cx, cz) {
  const entry = chunks.get(chunkKey(cx, cz));
  return entry ? entry.chunk : null;
}

function getBlockWorld(wx, wy, wz) {
  const cx = Math.floor(wx / CX);
  const cz = Math.floor(wz / CZ);
  const lx = ((wx % CX) + CX) % CX;
  const lz = ((wz % CZ) + CZ) % CZ;
  const chunk = getChunk(cx, cz);
  if (!chunk) return -1;
  return chunk.getBlock(lx, wy, lz);
}

function setBlockWorld(wx, wy, wz, type) {
  const cx = Math.floor(wx / CX);
  const cz = Math.floor(wz / CZ);
  const lx = ((wx % CX) + CX) % CX;
  const lz = ((wz % CZ) + CZ) % CZ;
  const chunk = getChunk(cx, cz);
  if (!chunk) return false;
  const ok = chunk.setBlock(lx, wy, lz, type);
  if (ok) {
    remeshChunk(cx, cz);
    // Also remesh neighboring chunks at the boundary
    if (lx === 0) remeshChunk(cx - 1, cz);
    if (lx === CX - 1) remeshChunk(cx + 1, cz);
    if (lz === 0) remeshChunk(cx, cz - 1);
    if (lz === CZ - 1) remeshChunk(cx, cz + 1);
  }
  return ok;
}

/** Remesh a single chunk */
function remeshChunk(cx, cz) {
  const entry = chunks.get(chunkKey(cx, cz));
  if (!entry) return;
  const chunk = entry.chunk;
  if (entry.mesh) {
    renderer.deleteMesh(entry.mesh);
    entry.mesh = null;
  }
  const data = greedyMesh(chunk.voxels, chunk.wx, 0, chunk.wz);
  if (data.vertexCount > 0) {
    entry.mesh = renderer.createMesh(data.positions, data.colors);
  }
  chunk.needsRemesh = false;
}

/** Load chunks around a camera position */
function loadChunks(cx, cz, distance) {
  const needed = new Set();
  for (let dz = -distance; dz <= distance; dz++) {
    for (let dx = -distance; dx <= distance; dx++) {
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > distance + 0.5) continue;
      needed.add(chunkKey(cx + dx, cz + dz));
      getOrCreateChunk(cx + dx, cz + dz);
    }
  }
  // Remove chunks out of range
  for (const key of chunks.keys()) {
    if (!needed.has(key)) {
      const entry = chunks.get(key);
      if (entry.mesh) renderer.deleteMesh(entry.mesh);
      chunks.delete(key);
    }
  }
  // Remesh any that need it
  for (const [key, entry] of chunks) {
    if (entry.chunk.needsRemesh) {
      if (entry.mesh) renderer.deleteMesh(entry.mesh);
      const data = greedyMesh(entry.chunk.voxels, entry.chunk.wx, 0, entry.chunk.wz);
      entry.mesh = data.vertexCount > 0 ? renderer.createMesh(data.positions, data.colors) : null;
      entry.chunk.needsRemesh = false;
    }
  }
}

// ─── Raycasting (AABB voxel traversal, DDA) ────────────────────────

const MAX_RAY_DIST = 8;

function raycastVoxels(origin, direction) {
  // DDA algorithm for voxel traversal
  let x = Math.floor(origin[0]);
  let y = Math.floor(origin[1]);
  let z = Math.floor(origin[2]);

  const stepX = direction[0] >= 0 ? 1 : -1;
  const stepY = direction[1] >= 0 ? 1 : -1;
  const stepZ = direction[2] >= 0 ? 1 : -1;

  const tDeltaX = Math.abs(1 / direction[0]);
  const tDeltaY = Math.abs(1 / direction[1]);
  const tDeltaZ = Math.abs(1 / direction[2]);

  let tMaxX = direction[0] !== 0
    ? ((direction[0] > 0 ? (x + 1 - origin[0]) : (origin[0] - x)) / Math.abs(direction[0]))
    : Infinity;
  let tMaxY = direction[1] !== 0
    ? ((direction[1] > 0 ? (y + 1 - origin[1]) : (origin[1] - y)) / Math.abs(direction[1]))
    : Infinity;
  let tMaxZ = direction[2] !== 0
    ? ((direction[2] > 0 ? (z + 1 - origin[2]) : (origin[2] - z)) / Math.abs(direction[2]))
    : Infinity;

  let lastX = x, lastY = y, lastZ = z;
  let axis = -1;

  for (let i = 0; i < MAX_RAY_DIST * 3; i++) {
    const block = getBlockWorld(x, y, z);
    if (block > 0 && block !== BLOCK.WATER) {
      // Hit! Return hit block and the previous (empty) block
      return {
        hitX: x, hitY: y, hitZ: z,
        placeX: lastX, placeY: lastY, placeZ: lastZ,
        axis,
      };
    }
    lastX = x; lastY = y; lastZ = z;

    // Advance to next voxel
    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) { x += stepX; tMaxX += tDeltaX; axis = 0; }
      else                { z += stepZ; tMaxZ += tDeltaZ; axis = 2; }
    } else {
      if (tMaxY < tMaxZ) { y += stepY; tMaxY += tDeltaY; axis = 1; }
      else                { z += stepZ; tMaxZ += tDeltaZ; axis = 2; }
    }

    // Safety check — if we're out of reasonable bounds
    if (y < 0 || y >= CY) return null;
    const dist = Math.sqrt(
      (x - origin[0]) ** 2 + (y - origin[1]) ** 2 + (z - origin[2]) ** 2
    );
    if (dist > MAX_RAY_DIST) return null;
  }
  return null;
}

// ─── Player Physics ────────────────────────────────────────────────

let velocity = [0, 0, 0];
let onGround = false;

function isSolid(x, y, z) {
  const b = getBlockWorld(Math.floor(x), Math.floor(y), Math.floor(z));
  return b > 0 && b !== BLOCK.WATER;
}

function collides(px, py, pz) {
  // AABB collision check (player is PLAYER_HALF_W wide, PLAYER_HEIGHT tall)
  const hw = PLAYER_HALF_W;
  const minX = Math.floor(px - hw);
  const maxX = Math.floor(px + hw);
  const minY = Math.floor(py);
  const maxY = Math.floor(py + PLAYER_HEIGHT);
  const minZ = Math.floor(pz - hw);
  const maxZ = Math.floor(pz + hw);

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        if (isSolid(x, y, z)) return true;
      }
    }
  }
  return false;
}

function updatePlayer(dt) {
  const pos = camera.position;
  const fwd = camera.forward();
  const rt  = camera.right();

  // Input movement
  let moveFwd = 0, moveRt = 0;
  if (input.isKeyDown('KeyW')) moveFwd += 1;
  if (input.isKeyDown('KeyS')) moveFwd -= 1;
  if (input.isKeyDown('KeyA')) moveRt  -= 1;
  if (input.isKeyDown('KeyD')) moveRt  += 1;

  // Normalize diagonal
  const len = Math.sqrt(moveFwd * moveFwd + moveRt * moveRt);
  if (len > 0) { moveFwd /= len; moveRt /= len; }

  // Apply movement
  const speed = PLAYER_SPEED * dt;
  let dx = (fwd[0] * moveFwd + rt[0] * moveRt) * speed;
  let dz = (fwd[2] * moveFwd + rt[2] * moveRt) * speed;

  // Jump
  if (input.isKeyDown('Space') && onGround) {
    velocity[1] = JUMP_SPEED;
    onGround = false;
  }
  // Descend (shift)
  if (input.isKeyDown('ShiftLeft') || input.isKeyDown('ShiftRight')) {
    velocity[1] = -JUMP_SPEED;
  }

  // Gravity
  velocity[1] += GRAVITY * dt;

  // Collision resolution — axis by axis
  // X
  let newX = pos[0] + dx;
  if (!collides(newX, pos[1], pos[2])) {
    pos[0] = newX;
  } else {
    dx = 0;
  }

  // Y
  let newY = pos[1] + velocity[1] * dt;
  if (!collides(pos[0], newY, pos[2])) {
    pos[1] = newY;
    onGround = false;
  } else {
    if (velocity[1] < 0) onGround = true;
    velocity[1] = 0;
  }

  // Z
  let newZ = pos[2] + dz;
  if (!collides(pos[0], pos[1], newZ)) {
    pos[2] = newZ;
  } else {
    dz = 0;
  }

  // Keep within Y bounds
  if (pos[1] < 1) pos[1] = 1;
  if (pos[1] > CY - 2) pos[1] = CY - 2;
}

// ─── Game Loop ────────────────────────────────────────────────────

let lastTime = 0;
let frameCount = 0;
let fpsTimer = 0;
let currentFPS = 0;
let totalTriangles = 0;
let loadedChunks = 0;

function gameLoop(time) {
  const dt = Math.min((time - lastTime) / 1000, 0.05); // cap dt
  lastTime = time;

  // FPS counter
  frameCount++;
  fpsTimer += dt;
  if (fpsTimer >= 1) {
    currentFPS = Math.round(frameCount / fpsTimer);
    frameCount = 0;
    fpsTimer = 0;
  }

  if (input.isLocked) {
    // ── Mouse look ──
    const { dx, dy } = input.consumeMouse();
    camera.rotate(dx, dy);

    // ── Player physics ──
    updatePlayer(dt);

    // ── Chunk loading ──
    const cx = Math.floor(camera.position[0] / CX);
    const cz = Math.floor(camera.position[2] / CZ);
    loadChunks(cx, cz, VIEW_DISTANCE);

    // ── Block interaction ──
    const fwd = camera.forward();
    const origin = [camera.position[0], camera.position[1] + 1.5, camera.position[2]];
    const hit = raycastVoxels(origin, fwd);

    // Remove block (left click)
    if (input.consumeClick(0) && hit) {
      setBlockWorld(hit.hitX, hit.hitY, hit.hitZ, BLOCK.AIR);
    }

    // Place block (right click)
    if (input.consumeClick(2) && hit) {
      const blockType = HOTBAR_BLOCKS[selectedBlockIdx];
      if (blockType !== undefined) {
        setBlockWorld(hit.placeX, hit.placeY, hit.placeZ, blockType);
      }
    }

    // ── Keyboard block selection ──
    for (let i = 0; i < 9; i++) {
      if (input.isKeyDown(`Digit${i + 1}`)) {
        if (i < HOTBAR_BLOCKS.length) {
          selectedBlockIdx = i;
          updateBlockUI();
        }
      }
    }

    // ── Render ──
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      renderer.resize(w, h);
    }

    camera.update(w / h);
    renderer.clear();

    // Gather meshes
    const meshes = [];
    totalTriangles = 0;
    loadedChunks = 0;
    for (const entry of chunks.values()) {
      if (entry.mesh) {
        meshes.push(entry.mesh);
        totalTriangles += entry.mesh.vertexCount / 3;
        loadedChunks++;
      }
    }
    renderer.render(meshes, camera.vpMatrix);

    // ── HUD ──
    fpsDisplay.textContent = `FPS: ${currentFPS}`;
    triDisplay.textContent = `Tri: ${(totalTriangles / 1000).toFixed(1)}K`;
    chunkDisplay.textContent = `Chunks: ${loadedChunks}`;
    posDisplay.textContent = `Pos: ${camera.position[0].toFixed(0)}, ${camera.position[1].toFixed(0)}, ${camera.position[2].toFixed(0)}`;
  }

  requestAnimationFrame(gameLoop);
}

// ─── Start ─────────────────────────────────────────────────────────

// Initial chunk load + block selection visual
updateBlockUI();

// Click blocker to start
blocker.addEventListener('click', () => {
  input.requestLock();
});

// Start loop
requestAnimationFrame(gameLoop);

// ─── End try-catch wrapper ──────────────────────────────────────────
} catch (err) {
  console.error('GreedMesh init error:', err);
  const content = document.getElementById('blocker-content');
  if (content) {
    content.innerHTML = `
      <h1 style="color:#ff6b6b;">⚠️ Error</h1>
      <p>Something went wrong loading GreedMesh.</p>
      <pre style="background:#1a1a1a;color:#ff6b6b;padding:12px;border-radius:8px;font-size:0.8rem;text-align:left;margin-top:16px;overflow:auto;">${err.message}</pre>
    `;
  }
}
