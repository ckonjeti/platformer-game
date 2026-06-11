import type { Input } from './input';
import type { Renderer } from './renderer';

export interface Scene {
  enter?(): void;
  exit?(): void;
  update(input: Input): void;
  draw(r: Renderer): void;
}

/** Scene stack: top scene updates; all scenes draw bottom-up (lets pause overlay gameplay). */
export class SceneManager {
  private stack: Scene[] = [];

  get current(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }

  replace(scene: Scene): void {
    while (this.stack.length > 0) this.pop();
    this.push(scene);
  }

  push(scene: Scene): void {
    this.stack.push(scene);
    scene.enter?.();
  }

  pop(): void {
    const s = this.stack.pop();
    s?.exit?.();
  }

  update(input: Input): void {
    this.current?.update(input);
  }

  draw(r: Renderer): void {
    for (const s of this.stack) s.draw(r);
  }
}
