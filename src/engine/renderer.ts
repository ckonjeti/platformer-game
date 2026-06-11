/** Internal low-res canvas (320x180) blitted to the display canvas with integer scaling. */
export const VIEW_W = 320;
export const VIEW_H = 180;

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private display: HTMLCanvasElement;
  private displayCtx: CanvasRenderingContext2D;
  /** Integer scale factor and letterbox offset of the game view in display pixels. */
  scale = 1;
  offsetX = 0;
  offsetY = 0;

  constructor(display: HTMLCanvasElement) {
    this.display = display;
    this.canvas = document.createElement('canvas');
    this.canvas.width = VIEW_W;
    this.canvas.height = VIEW_H;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.displayCtx = display.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const winW = Math.floor(window.innerWidth * dpr);
    const winH = Math.floor(window.innerHeight * dpr);
    this.display.width = winW;
    this.display.height = winH;
    this.display.style.width = `${window.innerWidth}px`;
    this.display.style.height = `${window.innerHeight}px`;
    this.scale = Math.max(1, Math.floor(Math.min(winW / VIEW_W, winH / VIEW_H)));
    this.offsetX = Math.floor((winW - VIEW_W * this.scale) / 2);
    this.offsetY = Math.floor((winH - VIEW_H * this.scale) / 2);
    this.displayCtx.imageSmoothingEnabled = false;
  }

  /** Blit the internal canvas to the display canvas. */
  present(): void {
    const dc = this.displayCtx;
    dc.fillStyle = '#000';
    dc.fillRect(0, 0, this.display.width, this.display.height);
    dc.imageSmoothingEnabled = false;
    dc.drawImage(
      this.canvas,
      0, 0, VIEW_W, VIEW_H,
      this.offsetX, this.offsetY, VIEW_W * this.scale, VIEW_H * this.scale,
    );
  }

  clear(color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  /** Convert a CSS-pixel client coordinate to game-view coordinates. */
  clientToView(clientX: number, clientY: number): { x: number; y: number } {
    const dpr = window.devicePixelRatio || 1;
    return {
      x: (clientX * dpr - this.offsetX) / this.scale,
      y: (clientY * dpr - this.offsetY) / this.scale,
    };
  }
}
