import { expect, test, type Page } from '@playwright/test';
import { RACES, type RaceMode } from '../src/catalog';
import { newGame, type GameState } from '../src/domain';
import { cityMap } from '../src/geography';
import { exportSave } from '../src/storage';

const controls = ['w', 'a', 's', 'd', 'Space', 'Shift'] as const;
type Control = typeof controls[number];

const angleDifference = (radians: number) => Math.atan2(Math.sin(radians), Math.cos(radians));

async function setControls(page: Page, held: Set<Control>, next: Set<Control>) {
  for (const key of controls) {
    if (next.has(key) && !held.has(key)) { await page.keyboard.down(key); held.add(key); }
    if (!next.has(key) && held.has(key)) { await page.keyboard.up(key); held.delete(key); }
  }
}

async function walkUntil(page: Page, key: 'w' | 'a' | 's' | 'd', axis: 'x' | 'y', limit: number, decreasing: boolean) {
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(({ axis, limit, decreasing }) => {
      const value = Number(document.querySelector<HTMLElement>('#game-ui')?.dataset[axis]);
      return decreasing ? value <= limit : value >= limit;
    }, { axis, limit, decreasing }, { timeout: 8000 });
  } finally {
    await page.keyboard.up(key);
  }
}

function prepareRace(mode: RaceMode, level: number, money: number): GameState {
  const event = cityMap.zones.find(zone => zone.race === mode)!;
  const prepared = newGame();
  prepared.level = level;
  prepared.money = money;
  prepared.cars[0].condition.battery = 100;
  prepared.cars[0].condition.engine = 84;
  prepared.position = { scene: 'road', x: event.x, y: event.y, angle: 0 };
  prepared.settings = { music: 0, sfx: 0, quality: 'low' };
  prepared.tutorial.skipped = true;
  return prepared;
}

async function enterRace(page: Page, mode: RaceMode, prepared: GameState) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Partidas guardadas' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar', exact: true }).first().click();
  await (await chooser).setFiles({
    name: mode + '-fixture.json', mimeType: 'application/json', buffer: Buffer.from(exportSave(prepared)),
  });
  await page.getByRole('button', { name: 'Cargar', exact: true }).click();

  const game = page.locator('#game-ui');
  await expect(game).toHaveAttribute('data-x', String(prepared.position.x), { timeout: 25_000 });
  await expect(game.locator('[data-hud=prompt]')).toContainText(RACES[mode].name);
  await page.keyboard.press('e');
  await expect(page.getByRole('heading', { name: RACES[mode].subtitle })).toBeVisible();
  await page.getByRole('button', { name: 'Inscribirse y correr' }).click();
  await expect(game).toHaveAttribute('data-countdown', /[123]/, { timeout: 20_000 });

  return game;
}

async function driveRace(page: Page, mode: RaceMode) {
  const game = page.locator('#game-ui');
  const held = new Set<Control>();
  const gates = new Set<number>();
  const finish = page.locator('[data-action="result-garage"]');
  let lastState: Record<string, string | undefined> = {};
  const driveUntil = Date.now() + (mode === 'circuit' ? 96_000 : 80_000);
  try {
    while (Date.now() < driveUntil && !await finish.isVisible()) {
      lastState = await game.evaluate(element => ({ ...element.dataset }));
      const { x, y, speed, angle, targetX, targetY, nextX, nextY, checkpoint, countdown } = lastState;
      if (!targetX || !targetY || Number(countdown) > 0) {
        await page.waitForTimeout(45);
        continue;
      }
      gates.add(Number(checkpoint));
      const dx = Number(targetX) - Number(x);
      const dy = Number(targetY) - Number(y);
      const approach = Math.atan2(dy, dx);
      const turn = nextX && nextY
        && Math.abs(angleDifference(Math.atan2(Number(nextY) - Number(targetY), Number(nextX) - Number(targetX)) - approach)) > .78;
      const alignment = angleDifference(approach - Number(angle) * Math.PI / 180);
      const distance = Math.hypot(dx, dy);
      const velocity = Number(speed);
      const speedLimit = Math.abs(alignment) > 1 ? 41 : Math.abs(alignment) > .46 ? 62 : turn && distance < 136 ? 72 : 165;
      const next = new Set<Control>();
      if (alignment < -.035) next.add('a');
      if (alignment > .035) next.add('d');
      if (velocity < speedLimit) next.add('w');
      if (velocity > speedLimit + 10) next.add('s');
      if (Math.abs(alignment) > (mode === 'drift' ? .44 : 1) && velocity > 66) next.add('Space');
      if (distance > 250 && Math.abs(alignment) < .13 && velocity < 154) next.add('Shift');
      await setControls(page, held, next);
      await page.waitForTimeout(38);
    }
  } finally {
    await setControls(page, held, new Set());
  }

  await expect(finish, JSON.stringify(lastState)).toBeVisible({ timeout: 3000 });
  const checkpoints = Number((await game.locator('[data-hud=cp]').textContent())?.split('/')[1]);
  expect(checkpoints).toBeGreaterThan(0);
  expect([...gates]).toEqual(expect.arrayContaining(Array.from({ length: checkpoints }, (_, index) => index)));
  await expect(game.locator('[data-hud=cp]')).toHaveText(checkpoints + '/' + checkpoints);
  await expect(page.getByRole('heading', { name: /Victoria|Meta cruzada/ })).toBeVisible();
  return finish;
}

test('completes the first Sprint with keyboard controls and upgrades the workshop with the prize', async ({ page }, testInfo) => {
  test.setTimeout(125_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const game = await enterRace(page, 'sprint', prepareRace('sprint', 1, 1050));
  const finish = await driveRace(page, 'sprint');
  const prize = page.locator('#modal-root .stat').filter({ hasText: 'Premio' }).locator('strong');
  expect(Number((await prize.textContent())?.replace(/\D/g, ''))).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('sprint-result.png') });
  await finish.click();
  await expect(game).toHaveAttribute('data-x', '470');

  await walkUntil(page, 's', 'y', 401, false);
  await walkUntil(page, 'a', 'x', 91, true);
  await walkUntil(page, 'w', 'y', 184, true);
  await walkUntil(page, 'd', 'x', 119, false);
  await expect(game).toHaveAttribute('data-near', 'pc');
  await page.keyboard.press('e');
  await expect(page.getByRole('heading', { name: 'Gestión del taller' })).toBeVisible();
  await page.getByRole('button', { name: /Ampliar taller/ }).click();
  await expect(page.locator('#modal-root .stat').filter({ hasText: 'Nivel' }).locator('strong')).toHaveText('2 / 5');

  await page.keyboard.press('Escape');
  await expect(game).toContainText('Taller de barrio');
  await page.screenshot({ path: testInfo.outputPath('upgraded-workshop.png') });
  expect(errors).toEqual([]);
});

for (const mode of ['drag', 'circuit', 'time', 'drift'] as const) {
  test('finishes ' + RACES[mode].name + ' from its city start with keyboard controls', async ({ page }, testInfo) => {
    test.setTimeout(135_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const game = await enterRace(page, mode, prepareRace(mode, 3, 5000));
    await driveRace(page, mode);
    if (mode === 'circuit') await expect(game.locator('[data-hud=extra]')).toHaveText('2/2');
    if (mode === 'drift') expect(Number(await game.locator('[data-hud=extra]').textContent())).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath(mode + '-result.png') });
    expect(errors).toEqual([]);
  });
}

test('completes a repeat Sprint on the eastern route', async ({ page }) => {
  test.setTimeout(130_000);
  const prepared = prepareRace('sprint', 1, 2000);
  prepared.nextRaceVariants.sprint = 1;
  const game = await enterRace(page, 'sprint', prepared);
  await expect(game.locator('[data-hud=detail]')).toHaveText('Muelle Carmesí');
  await expect.poll(async () => Number(await game.getAttribute('data-target-x'))).toBeGreaterThan(3376);
  await driveRace(page, 'sprint');
});
