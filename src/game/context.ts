import type { Input } from '../engine/input';
import type { SceneManager } from '../engine/scene';
import { writeSave, type SaveData } from '../engine/save';

export interface Game {
  sm: SceneManager;
  input: Input;
  save: SaveData;
  persist(): void;
}

export function makeGame(sm: SceneManager, input: Input, save: SaveData): Game {
  return {
    sm,
    input,
    save,
    persist() {
      writeSave(this.save);
    },
  };
}
