// ─── Block Types & World Configuration ──────────────────────────────

export const CHUNK_SIZE_X = 16;
export const CHUNK_SIZE_Y = 128;
export const CHUNK_SIZE_Z = 16;
export const VIEW_DISTANCE = 4; // chunks in each direction

export const BLOCK = Object.freeze({
  AIR:    0,
  GRASS:  1,
  DIRT:   2,
  STONE:  3,
  WATER:  4,
  SAND:   5,
  SNOW:   6,
  WOOD:   7,
  LEAVES: 8,
  PLANKS: 9,
});

// Face-dependent shading — darken sides/bottom for depth
export const FACE_SHADE = Object.freeze({
  top:    [1.0, 1.0, 1.0],
  bottom: [0.5, 0.5, 0.55],
  front:  [0.8, 0.8, 0.85],
  back:   [0.8, 0.8, 0.85],
  left:   [0.7, 0.7, 0.75],
  right:  [0.7, 0.7, 0.75],
});

export const BLOCK_COLORS = Object.freeze({
  [BLOCK.AIR]:    [0, 0, 0],
  [BLOCK.GRASS]:  [0.31, 0.62, 0.18], // green top
  [BLOCK.DIRT]:   [0.58, 0.38, 0.20],
  [BLOCK.STONE]:  [0.50, 0.50, 0.50],
  [BLOCK.WATER]:  [0.10, 0.35, 0.60],
  [BLOCK.SAND]:   [0.82, 0.76, 0.52],
  [BLOCK.SNOW]:   [0.95, 0.93, 0.96],
  [BLOCK.WOOD]:   [0.42, 0.28, 0.13],
  [BLOCK.LEAVES]: [0.18, 0.48, 0.12],
  [BLOCK.PLANKS]: [0.67, 0.53, 0.32],
});

// Block selector order (hotbar)
export const HOTBAR_BLOCKS = [
  BLOCK.GRASS,
  BLOCK.DIRT,
  BLOCK.STONE,
  BLOCK.SAND,
  BLOCK.PLANKS,
  BLOCK.WOOD,
];

// Physics / player
export const GRAVITY      = -24;
export const PLAYER_HALF_W = 0.3;
export const PLAYER_HEIGHT = 1.7;
export const PLAYER_SPEED  = 4.5;
export const JUMP_SPEED    = 8.5;
export const MOUSE_SENS    = 0.002;

// How many mip levels of greedy merging? (1 = no merge, 2 = 2x2x2, etc.)
export const MERGE_LEVEL = 1;
