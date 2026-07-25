// ─── First-Person Camera ───────────────────────────────────────────
// Euler angles (yaw/pitch) + position. Produces view-projection matrix.

import { MOUSE_SENS, PLAYER_HALF_W, PLAYER_HEIGHT } from '../engine/constants.js';

export class Camera {
  constructor() {
    this.position = [0, 60, 0];  // spawn above terrain
    this.yaw = 0;
    this.pitch = 0;
    this.fov = Math.PI / 3;       // 60 degrees
    this.near = 0.1;
    this.far = 250.0;
    this.viewMatrix = new Float32Array(16);
    this.projMatrix = new Float32Array(16);
    this.vpMatrix = new Float32Array(16);
    this.dirty = true;
  }

  /** Apply mouse delta to yaw/pitch */
  rotate(dx, dy) {
    this.yaw   -= dx * MOUSE_SENS;
    this.pitch -= dy * MOUSE_SENS;
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
    this.dirty = true;
  }

  /** Get forward vector (normalized) */
  forward() {
    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    return [cy * cp, sp, sy * cp];
  }

  /** Get right vector (normalized) */
  right() {
    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);
    return [cy, 0, sy]; // right is perpendicular to forward on XZ plane
  }

  /** Move relative to camera orientation */
  move(forwardAmount, rightAmount) {
    const fwd = this.forward();
    const rt  = this.right();
    this.position[0] += fwd[0] * forwardAmount + rt[0] * rightAmount;
    this.position[1] += fwd[1] * forwardAmount;
    this.position[2] += fwd[2] * forwardAmount + rt[2] * rightAmount;
    this.dirty = true;
  }

  /** Rebuild matrices */
  update(aspect) {
    this._buildProjection(aspect);
    this._buildView();
    // Multiply: VP = projection * view
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        this.vpMatrix[i * 4 + j] = 0;
        for (let k = 0; k < 4; k++) {
          this.vpMatrix[i * 4 + j] += this.projMatrix[i * 4 + k] * this.viewMatrix[k * 4 + j];
        }
      }
    }
    this.dirty = false;
  }

  _buildProjection(aspect) {
    const f = 1.0 / Math.tan(this.fov / 2);
    const nf = 1 / (this.near - this.far);
    const m = this.projMatrix;
    m[0]  = f / aspect;
    m[1]  = 0; m[2]  = 0; m[3]  = 0;
    m[4]  = 0; m[5]  = f;
    m[6]  = 0; m[7]  = 0;
    m[8]  = 0; m[9]  = 0;
    m[10] = (this.far + this.near) * nf;
    m[11] = -1;
    m[12] = 0; m[13] = 0;
    m[14] = 2 * this.far * this.near * nf;
    m[15] = 0;
  }

  _buildView() {
    const pos = this.position;
    const fwd = this.forward();
    const up  = [0, 1, 0];

    // Look-at target
    const target = [pos[0] + fwd[0], pos[1] + fwd[1], pos[2] + fwd[2]];

    // Compute view matrix manually
    const zAxis = [
      pos[0] - target[0],
      pos[1] - target[1],
      pos[2] - target[2],
    ];
    const zLen = Math.sqrt(zAxis[0]**2 + zAxis[1]**2 + zAxis[2]**2);
    zAxis[0] /= zLen; zAxis[1] /= zLen; zAxis[2] /= zLen;

    const xAxis = [
      up[1] * zAxis[2] - up[2] * zAxis[1],
      up[2] * zAxis[0] - up[0] * zAxis[2],
      up[0] * zAxis[1] - up[1] * zAxis[0],
    ];
    const xLen = Math.sqrt(xAxis[0]**2 + xAxis[1]**2 + xAxis[2]**2);
    xAxis[0] /= xLen; xAxis[1] /= xLen; xAxis[2] /= xLen;

    const yAxis = [
      zAxis[1] * xAxis[2] - zAxis[2] * xAxis[1],
      zAxis[2] * xAxis[0] - zAxis[0] * xAxis[2],
      zAxis[0] * xAxis[1] - zAxis[1] * xAxis[0],
    ];

    const m = this.viewMatrix;
    m[0] = xAxis[0]; m[1] = yAxis[0]; m[2] = zAxis[0]; m[3] = 0;
    m[4] = xAxis[1]; m[5] = yAxis[1]; m[6] = zAxis[1]; m[7] = 0;
    m[8] = xAxis[2]; m[9] = yAxis[2]; m[10]= zAxis[2]; m[11]= 0;
    m[12]= -(xAxis[0]*pos[0] + xAxis[1]*pos[1] + xAxis[2]*pos[2]);
    m[13]= -(yAxis[0]*pos[0] + yAxis[1]*pos[1] + yAxis[2]*pos[2]);
    m[14]= -(zAxis[0]*pos[0] + zAxis[1]*pos[1] + zAxis[2]*pos[2]);
    m[15]= 1;
  }
}
