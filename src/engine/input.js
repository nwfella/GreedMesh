// ─── Input State Manager ───────────────────────────────────────────

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseButtons = [false, false, false]; // left, middle, right
    this.isLocked = false;

    this._onKeyDown = (e) => {
      this.keys[e.code] = true;
      // Prevent space from scrolling
      if (['Space', 'ShiftLeft', 'ShiftRight'].includes(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => {
      this.keys[e.code] = false;
    };
    this._onMouseMove = (e) => {
      if (document.pointerLockElement === this.canvas) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    };
    this._onMouseDown = (e) => {
      if (e.button < 3) this.mouseButtons[e.button] = true;
    };
    this._onMouseUp = (e) => {
      if (e.button < 3) this.mouseButtons[e.button] = false;
    };
    this._onPointerLockChange = () => {
      this.isLocked = document.pointerLockElement === this.canvas;
      if (!this.isLocked) {
        // Reset accumulated delta on unlock
        this.mouseDX = 0;
        this.mouseDY = 0;
      }
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
  }

  /** Consume accumulated mouse delta (call once per frame) */
  consumeMouse() {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }

  isKeyDown(code) {
    return !!this.keys[code];
  }

  isMouseDown(btn = 0) {
    return this.mouseButtons[btn];
  }

  /** Consume a mouse click — returns true once per click */
  consumeClick(btn = 0) {
    if (this.mouseButtons[btn]) {
      this.mouseButtons[btn] = false;
      return true;
    }
    return false;
  }

  /** Request pointer lock — returns true if successful */
  requestLock() {
    if (!this.isLocked) {
      try {
        this.canvas.setAttribute('tabindex', '0');
        this.canvas.focus();
        this.canvas.requestPointerLock();
        return true;
      } catch (e) {
        console.warn('Pointer lock request failed:', e);
        return false;
      }
    }
    return true;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
  }
}
