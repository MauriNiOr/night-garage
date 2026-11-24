import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMPONENTS, LEVELS, MODELS, RACES, TOURNAMENT, TUTORIAL } from '../src/catalog';
import {
  acceptJob, activeCar, advanceTutorial, buyCar, buyPart, canDrive, carTuning, carValue, claimJob,
  customizeCar, marketOffers, newGame, raceEntry, refuel, repairCar, sellCar, settleRace, startTournament,
  tournamentRace, upgradeWorkshop,
} from '../src/domain';
import { exportSave, importSave, listSlots, loadSlot, saveSlot } from '../src/storage';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the first night', () => {
  it('turns a dead battery and a last-place finish into the first workshop upgrade', () => {
    const state = newGame();
    expect(state.money).toBe(2500);
    expect(canDrive(state).ok).toBe(false);
    for (const event of ['move', 'interact', 'inspect', 'diagnose'] as const) {
      expect(advanceTutorial(state, event)).toBe(true);
    }
    expect(TUTORIAL[state.tutorial.step].event).toBe('buy');
    expect(buyPart(state, 'battery').ok).toBe(true);
    expect(repairCar(state, 'battery', 0.3).ok).toBe(false);
    expect(state.parts.battery).toBe(1);
    expect(repairCar(state, 'battery', 0.8).ok).toBe(true);
    expect(activeCar(state).condition.battery).toBe(94);
    expect(canDrive(state).ok).toBe(true);
    expect(customizeCar(state, 'color', 0x4db3ad).ok).toBe(true);
    expect(advanceTutorial(state, 'drive')).toBe(true);
    expect(raceEntry(state, 'sprint').ok).toBe(true);
    const paidEntry = state.money;
    expect(raceEntry(state, 'sprint').ok).toBe(true);
    expect(state.money).toBe(paidEntry);
    const race = { mode: 'sprint', time: 67, position: 3, total: 3, damage: 4, drift: 37, distance: 5600 } as const;
    const reward = settleRace(state, race);
    expect(reward).toMatchObject({ ok: true, won: false, payout: 450, rep: 12 });
    expect(settleRace(state, race).ok).toBe(false);
    expect(state.money).toBeGreaterThanOrEqual(LEVELS[1].cost);
    expect(advanceTutorial(state, 'manage')).toBe(true);
    expect(upgradeWorkshop(state).ok).toBe(true);
    expect(state.level).toBe(2);
    expect(state.tutorial.step).toBe(TUTORIAL.length);
    expect(state.achievements).toEqual(['first-repair', 'first-race']);
  });

  it('records wear but preserves the tutorial after timing out', () => {
    const state = newGame();
    state.tutorial.step = TUTORIAL.findIndex((step) => step.event === 'race');
    buyPart(state, 'battery');
    repairCar(state, 'battery');
    raceEntry(state, 'sprint');
    const before = state.money;
    const result = settleRace(state, {
      mode: 'sprint', time: 99, position: 4, total: 4, damage: 8, drift: 15, distance: 350, completed: false,
    });
    expect(result).toMatchObject({ ok: true, completed: false, payout: 0, rep: 0 });
    expect(state.money).toBe(before);
    expect(state.pendingRace).toBeNull();
    expect(state.stats.races).toBe(0);
    expect(state.stats.distance).toBeGreaterThan(0);
    expect(TUTORIAL[state.tutorial.step].event).toBe('race');
  });

  it('keeps a completed customer job distinct from the owned car', () => {
    const state = newGame();
    const before = activeCar(state).condition.oil;
    expect(acceptJob(state, 'mara-oil').ok).toBe(true);
    expect(claimJob(state).ok).toBe(false);
    expect(buyPart(state, 'oil').ok).toBe(true);
    expect(repairCar(state, 'oil').ok).toBe(true);
    expect(activeCar(state).condition.oil).toBe(before);
    expect(state.job?.ready).toBe(true);
    expect(claimJob(state).ok).toBe(true);
    expect(claimJob(state).ok).toBe(false);
    expect(state.stats.jobs).toBe(1);
    expect(state.rep).toBe(5);
  });
});

describe('market and competition', () => {
  it('rotates offers and gives a real restoration margin without an immediate resale profit', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-24T00:00:00Z'));
    const state = newGame();
    state.money = 50000;
    state.level = 5;
    const offers = marketOffers(state);
    expect(offers).toHaveLength(12);
    expect(new Set(MODELS.map((model) => model.kind)).size).toBe(12);
    expect(marketOffers(state, Date.now() + 86400000).map(({ price }) => price)).not.toEqual(offers.map(({ price }) => price));
    expect(offers.every((offer) => carValue(offer.car) < offer.price)).toBe(true);
    const turnaround = offers.flatMap((offer) => (['battery', 'body', 'brakes', 'oil'] as const).map((key) => {
      const restored = { ...offer.car, condition: { ...offer.car.condition, [key]: 100 } };
      return { offer, key, profit: carValue(restored) - offer.price - COMPONENTS[key].price };
    })).sort((first, second) => second.profit - first.profit)[0];
    expect(turnaround.profit).toBeGreaterThan(0);
    expect(buyCar(state, turnaround.offer.id).ok).toBe(true);
    expect(buyCar(state, turnaround.offer.id).ok).toBe(false);
    expect(sellCar(state, state.cars[1].id).ok).toBe(true);
    expect(sellCar(state, state.cars[0].id).ok).toBe(false);
  });

  it('changes driving stats through mechanical upgrades and tracks the three tournament stages', () => {
    const state = newGame();
    state.level = 4;
    state.money = 25000;
    buyPart(state, 'battery');
    repairCar(state, 'battery');
    const original = carTuning(activeCar(state));
    expect(customizeCar(state, 'engine', 1).ok).toBe(true);
    expect(customizeCar(state, 'brakes', 1).ok).toBe(true);
    const tuned = carTuning(activeCar(state));
    expect(tuned.power).toBeGreaterThan(original.power);
    expect(tuned.brakes).toBeGreaterThan(original.brakes);

    expect(startTournament(state).ok).toBe(true);
    expect(startTournament(state).ok).toBe(false);
    for (const mode of TOURNAMENT.modes) {
      expect(tournamentRace(state)).toBe(mode);
      const before = state.money;
      expect(raceEntry(state, mode).ok).toBe(true);
      expect(state.money).toBe(before);
      const reward = settleRace(state, {
        mode, time: 47, position: 1, total: 3, damage: 5, drift: 1350, distance: 4500,
      });
      expect(reward.won).toBe(true);
      expect(reward.sponsorship).toBe(500);
      expect(reward.wages).toBe(85);
      if (mode === 'drift') expect(reward.payout).toBe(RACES.drift.prize + TOURNAMENT.prize);
    }
    expect(state.tournament).toBeNull();
    expect(state.achievements).toContain('tournament');
    expect(activeCar(state).fuel).toBeLessThan(70);
    expect(refuel(state).ok).toBe(true);
    expect(activeCar(state).fuel).toBe(100);
  });
});

describe('save portability', () => {
  it('validates exports and migrates an earlier raw save', () => {
    const state = newGame();
    state.position = { scene: 'road', x: 770, y: 1150, angle: 90 };
    state.settings.sfx = 0.4;
    expect(importSave(exportSave(state))).toMatchObject(state);
    const migrated = importSave(JSON.stringify({
      version: 1, money: 1550, reputation: 26, workshopLevel: 2,
      cars: [{ id: 'car-9', model: 'Kairo 86', wear: { battery: 99 } }],
      inventory: { brake: 13, tires: 6 }, tutorialCompleted: true,
    }));
    expect(migrated).toMatchObject({ version: 2, money: 1550, rep: 26, level: 2, nextCarId: 10 });
    expect(migrated.parts.tires).toBe(6);
    expect(migrated.tutorial.step).toBe(TUTORIAL.length);
    expect(activeCar(migrated).condition.battery).toBe(99);
    expect(() => importSave('[]')).toThrow();
    expect(() => importSave(JSON.stringify({ ...state, version: 999 }))).toThrow();
    expect(() => importSave(JSON.stringify({ ...state, cars: [...state.cars, ...state.cars] }))).toThrow();
  });

  it('keeps slot writes isolated and orders overlapping snapshots', async () => {
    const backup = new Map<string, string>();
    vi.stubGlobal('indexedDB', undefined);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => backup.get(key) ?? null,
      setItem: (key: string, value: string) => backup.set(key, value),
      removeItem: (key: string) => backup.delete(key),
    });
    const state = newGame();
    expect(await listSlots()).toEqual([null, null, null]);
    const firstWrite = saveSlot(1, state);
    state.money -= 165;
    const recentWrite = saveSlot(1, state);
    state.money = 9800;
    await Promise.all([firstWrite, recentWrite, saveSlot(3, state)]);
    expect((await loadSlot(1))?.money).toBe(2335);
    expect(await loadSlot(2)).toBeNull();
    expect((await loadSlot(3))?.money).toBe(9800);
    expect(await listSlots()).toMatchObject([{ slot: 1, money: 2335 }, null, { slot: 3, money: 9800 }]);
  });
});
