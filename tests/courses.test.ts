import { describe, expect, it } from 'vitest';
import type { RaceMode } from '../src/catalog';
import { RACE_COURSES } from '../src/courses';
import { abandonRace, newGame, raceEntry, settleRace } from '../src/domain';
import { cityMap } from '../src/geography';
import { exportSave, importSave } from '../src/storage';

const modes = Object.keys(RACE_COURSES) as RaceMode[];

describe('course rotation', () => {
  it.each(modes)('visits every %s course in order and preserves the booked route through a reload', (mode) => {
    let state = newGame();
    state.level = 5;
    state.money = 100000;
    state.cars[0].condition.battery = 100;
    state.cars[0].condition.engine = 100;

    const count = RACE_COURSES[mode].length;
    for (let entry = 0; entry <= count; entry++) {
      const variant = entry % count;
      expect(raceEntry(state, mode).ok).toBe(true);
      expect(state.pendingRace?.variant).toBe(variant);

      state = importSave(exportSave(state));
      expect(raceEntry(state, mode).ok).toBe(true);
      expect(state.pendingRace?.variant).toBe(variant);

      abandonRace(state);
      state = importSave(exportSave(state));
    }
  });

  it('loads a legacy reservation on the original course and advances the next booking', () => {
    const legacy = JSON.parse(exportSave(newGame()));
    delete legacy.state.nextRaceVariants;
    delete legacy.state.stats.routeRecords;
    legacy.state.stats.records.sprint = { time: 35, position: 2, drift: 0 };
    legacy.state.pendingRace = { mode: 'sprint', tournament: false };
    const state = importSave(JSON.stringify(legacy));
    expect(state.pendingRace?.variant).toBe(0);
    expect(state.nextRaceVariants.sprint).toBe(1);
    expect(state.stats.routeRecords.sprint?.[0]).toEqual(state.stats.records.sprint);
  });

  it('compares personal bests on the same route and preserves the overall mode record', () => {
    const state = newGame();
    state.cars[0].condition.battery = 100;
    const report = { mode: 'sprint', time: 35, position: 2, total: 4, damage: 0, drift: 0, distance: 4000 } as const;
    expect(raceEntry(state, report.mode).ok).toBe(true);
    expect(settleRace(state, report).personalBest).toBe(true);
    expect(raceEntry(state, report.mode).ok).toBe(true);
    expect(settleRace(state, { ...report, time: 42 }).personalBest).toBe(true);

    const loaded = importSave(exportSave(state));
    expect(loaded.stats.records.sprint?.time).toBe(35);
    expect(loaded.stats.routeRecords.sprint?.[0]?.time).toBe(35);
    expect(loaded.stats.routeRecords.sprint?.[1]?.time).toBe(42);
  });

  it.each(modes)('keeps all %s gates connected by drivable roads', (mode) => {
    const layouts = RACE_COURSES[mode];
    expect(new Set(layouts.map(layout => JSON.stringify(layout.points))).size).toBe(layouts.length);
    for (const { points } of layouts) {
      if (mode === 'circuit') expect(points.at(-1)).toEqual(points[0]);
      if (mode === 'drag') {
        expect(new Set(points.map(point => point.x)).size === 1 || new Set(points.map(point => point.y)).size === 1).toBe(true);
      }
      for (let index = 1; index < points.length; index++) {
        const from = points[index - 1], to = points[index];
        expect(from).not.toEqual(to);
        expect(cityMap.roads.some(road => [from, to].every(point =>
          point.x >= road.x + 24 && point.x <= road.x + road.width - 24
          && point.y >= road.y + 24 && point.y <= road.y + road.height - 24))).toBe(true);
      }
    }
  });
});
