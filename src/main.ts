import { initAudio, resumeAudio, suspendAudio } from './audio/synth';
import { Input } from './engine/input';
import { Loop } from './engine/loop';
import { Renderer } from './engine/renderer';
import { loadSave } from './engine/save';
import { SceneManager } from './engine/scene';
import { TouchControls } from './engine/touch';
import { makeGame } from './game/context';
import { TitleScene } from './game/scenes/title';

// Expose safe-area insets to JS via CSS custom properties
const style = document.createElement('style');
style.textContent = `:root {
  --sa-top: env(safe-area-inset-top, 0px);
  --sa-right: env(safe-area-inset-right, 0px);
  --sa-bottom: env(safe-area-inset-bottom, 0px);
  --sa-left: env(safe-area-inset-left, 0px);
}`;
document.head.appendChild(style);

const displayCanvas = document.getElementById('game') as HTMLCanvasElement;
const overlayCanvas = document.getElementById('touch-layer') as HTMLCanvasElement;

const renderer = new Renderer(displayCanvas);
const input = new Input();
input.attach();
input.onFirstInteraction = () => initAudio();
const touch = new TouchControls(input, overlayCanvas);

const sm = new SceneManager();
const game = makeGame(sm, input, loadSave());
sm.replace(new TitleScene(game));

const loop = new Loop(
  () => {
    input.update();
    sm.update(input);
  },
  () => {
    sm.draw(renderer);
    renderer.present();
    touch.draw();
  },
);
loop.start();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) suspendAudio();
  else resumeAudio();
});
