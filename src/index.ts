import * as xb from 'xrblocks';
import { NeonViceGame } from './game/NeonViceGame';

document.addEventListener('DOMContentLoaded', async () => {
  const options = new xb.Options();
  options.setAppTitle('Neon Vice: Open-World Crime Action');
  options.setAppDescription(
    'Explore 1986 Neon Vice City, drive exotic cars and speedboats, tune into synthwave radio, and build your empire.',
  );

  const game = new NeonViceGame();
  xb.add(game);
  await xb.init(options);
});
