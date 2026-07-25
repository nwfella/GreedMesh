// ─── WebGL2 Renderer ───────────────────────────────────────────────
// Compiles shaders, manages VAOs for each chunk mesh, handles draw.

const VS_SRC = `#version 300 es
precision highp float;

layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aColor;

uniform mat4 uVP;

out vec3 vColor;

void main() {
  vColor = aColor;
  gl_Position = uVP * vec4(aPosition, 1.0);
}
`;

const FS_SRC = `#version 300 es
precision highp float;

in vec3 vColor;
out vec4 fragColor;

void main() {
  fragColor = vec4(vColor, 1.0);
}
`;

export class Renderer {
  constructor(gl) {
    this.gl = gl;
    this.program = this._createProgram(VS_SRC, FS_SRC);
    this.uVPLoc = gl.getUniformLocation(this.program, 'uVP');

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
  }

  /** Build a VAO from position and color buffers */
  createMesh(positions, colors) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // Position buffer
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    // Color buffer
    const colBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);

    return { vao, vertexCount: positions.length / 3, posBuf, colBuf };
  }

  /** Delete a mesh VAO and its buffers */
  deleteMesh(mesh) {
    if (!mesh) return;
    const gl = this.gl;
    if (mesh.vao) gl.deleteVertexArray(mesh.vao);
    if (mesh.posBuf) gl.deleteBuffer(mesh.posBuf);
    if (mesh.colBuf) gl.deleteBuffer(mesh.colBuf);
  }

  /** Render all chunk meshes */
  render(meshes, vpMatrix) {
    const gl = this.gl;

    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.uVPLoc, false, vpMatrix);

    for (const mesh of meshes) {
      if (!mesh || mesh.vertexCount === 0) continue;
      gl.bindVertexArray(mesh.vao);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.vertexCount);
    }

    gl.bindVertexArray(null);
  }

  /** Clear the screen */
  clear(r = 0.45, g = 0.55, b = 0.75) {
    const gl = this.gl;
    gl.clearColor(r, g, b, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  /** Resize viewport */
  resize(w, h) {
    this.gl.viewport(0, 0, w, h);
  }

  // ─── Internal helpers ────────────────────────────────────────────

  _createProgram(vsSrc, fsSrc) {
    const gl = this.gl;
    const vs = this._compileShader(gl.VERTEX_SHADER, vsSrc);
    const fs = this._compileShader(gl.FRAGMENT_SHADER, fsSrc);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error('Program link failed: ' + gl.getProgramInfoLog(prog));
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return prog;
  }

  _compileShader(type, src) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const label = type === gl.VERTEX_SHADER ? 'VS' : 'FS';
      throw new Error(`${label} compile error:\n${gl.getShaderInfoLog(shader)}\n---\n${src}`);
    }
    return shader;
  }
}
