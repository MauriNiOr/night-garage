import {
  ACHIEVEMENTS, COMPONENT_KEYS, CUSTOMIZATIONS, CUSTOMIZATION_KEYS, JOBS, MODELS, RACES, TOURNAMENT, TUTORIAL,
  type RaceMode,
} from './catalog';
import { makeCar, newGame, SAVE_VERSION, type Car, type GameState, type RaceRecord } from './domain';

export const SAVE_SLOTS = [1, 2, 3] as const;
export type SaveSlot = (typeof SAVE_SLOTS)[number];

interface SaveEnvelope {
  format: 'night-garage';
  version: number;
  state: GameState;
}

interface SlotRecord {
  slot: SaveSlot;
  updatedAt: number;
  save: SaveEnvelope;
}

export interface SlotSummary {
  slot: SaveSlot;
  updatedAt: number;
  money: number;
  rep: number;
  level: number;
  cars: number;
  activeModel: number;
  tutorialStep: number;
}

const DB_NAME = 'night-garage';
const STORE = 'saves';
const DB_VERSION = 1;
const MAX_IMPORT_SIZE = 2 * 1024 * 1024;
const LOCAL_PREFIX = 'night-garage:';
let connection: Promise<IDBDatabase> | null = null;

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function bounded(value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function integer(value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  return Math.trunc(bounded(value, fallback, min, max));
}

function isMode(value: unknown): value is RaceMode {
  return typeof value === 'string' && Object.hasOwn(RACES, value);
}

function normalizeCar(source: unknown, version: number): Car {
  const value = object(source);
  if (!value || typeof value.id !== 'string' || value.id.length > 80 || !value.id.trim()) {
    throw new Error('La partida contiene un vehículo sin identificador.');
  }

  const rawIndex = version === 1 && typeof value.model === 'string'
    ? MODELS.find((model) => model.name === value.model)?.index ?? Number(value.model)
    : value.model;
  const modelIndex = typeof rawIndex === 'number' && Number.isInteger(rawIndex) ? rawIndex : -1;
  if (!MODELS[modelIndex]) throw new Error('La partida contiene un modelo desconocido.');

  const car = makeCar(modelIndex, value.id);
  car.km = bounded(value.km, car.km, 0, 10000000);
  car.fuel = bounded(value.fuel, car.fuel, 0, 100);
  car.color = integer(value.color, car.color, 0, 0xffffff);
  const condition = object(value.condition ?? value.wear);
  const mods = object(value.mods);
  for (const key of COMPONENT_KEYS) car.condition[key] = bounded(condition?.[key], car.condition[key], 0, 100);
  for (const key of CUSTOMIZATION_KEYS) {
    if (key === 'color') {
      car.mods.color = car.color;
    } else {
      const option = CUSTOMIZATIONS[key].options.find((item) => item.value === mods?.[key]);
      car.mods[key] = option?.value ?? 0;
    }
  }
  return car;
}

function normalizeRecords(source: unknown): GameState['stats']['records'] {
  const records: GameState['stats']['records'] = {};
  const data = object(source);
  if (!data) return records;
  for (const mode of Object.keys(RACES) as RaceMode[]) {
    const record = object(data[mode]);
    if (!record) continue;
    const time = bounded(record.time, 0, 0, 36000);
    if (time <= 0) continue;
    const clean: RaceRecord = { time, position: integer(record.position, 1, 1, 50), drift: bounded(record.drift, 0, 0, 1000000) };
    records[mode] = clean;
  }
  return records;
}

function normalizeSave(raw: unknown): GameState {
  const root = object(raw);
  if (!root) throw new Error('El archivo no contiene una partida de NIGHT GARAGE.');
  if (Object.hasOwn(root, 'format') && root.format !== 'night-garage') {
    throw new Error('El archivo pertenece a otro juego.');
  }
  const payload = root.format === 'night-garage' ? object(root.state) : root;
  if (!payload || !Array.isArray(payload.cars) || payload.cars.length < 1 || payload.cars.length > 12 || typeof payload.money !== 'number' || !Number.isFinite(payload.money)) {
    throw new Error('El archivo no contiene el saldo y los vehículos de una partida válida.');
  }
  const version = root.version ?? payload.version ?? 1;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version > SAVE_VERSION) {
    throw new Error('La versión de esta partida no es compatible.');
  }
  const state = newGame();
  state.money = integer(payload.money, state.money);
  state.rep = integer(payload.rep ?? payload.reputation, state.rep);
  state.xp = integer(payload.xp, state.rep * 10);
  state.level = integer(payload.level ?? payload.workshopLevel, state.level, 1, 5);
  state.cars = payload.cars.map((car) => normalizeCar(car, version));
  if (new Set(state.cars.map((car) => car.id)).size !== state.cars.length) {
    throw new Error('La partida contiene identificadores de vehículo duplicados.');
  }
  const defaultCarId = state.cars[0].id;
  state.activeCarId = state.cars.some((car) => car.id === payload.activeCarId) ? payload.activeCarId as string : defaultCarId;
  const generatedIds = state.cars.map((car) => /^car-(\d+)$/.exec(car.id)?.[1]).filter(Boolean);
  const largestGeneratedId = Math.max(1, ...generatedIds.map((value) => integer(Number(value), 1, 0, 1000000000)));
  state.nextCarId = Math.max(largestGeneratedId + 1, integer(payload.nextCarId, 2, 2, 1000000000));

  const parts = object(payload.parts ?? payload.inventory);
  for (const key of COMPONENT_KEYS) state.parts[key] = integer(parts?.[key], 0, 0, 99);

  const tutorial = object(payload.tutorial);
  state.tutorial = {
    step: integer(tutorial?.step ?? payload.tutorialStep, payload.tutorialCompleted === true ? TUTORIAL.length : 0, 0, TUTORIAL.length),
    skipped: tutorial?.skipped === true || payload.tutorialSkipped === true,
  };

  const position = object(payload.position);
  if (position) {
    const road = position.scene === 'road';
    state.position = {
      scene: road ? 'road' : 'garage',
      x: bounded(position.x, state.position.x, 0, road ? 50000 : 960),
      y: bounded(position.y, state.position.y, 0, road ? 50000 : 540),
      angle: road ? bounded(position.angle, 0, -360, 360) : undefined,
    };
  }

  const settings = object(payload.settings);
  if (settings) {
    state.settings = {
      music: bounded(settings.music ?? settings.musicVolume, state.settings.music, 0, 1),
      sfx: bounded(settings.sfx ?? settings.effectsVolume, state.settings.sfx, 0, 1),
      quality: settings.quality === 'low' ? 'low' : 'high',
    };
  }

  const work = object(payload.job);
  const job = JOBS.find((item) => item.id === work?.id);
  if (job) state.job = { id: job.id, ready: work?.ready === true };

  const stats = object(payload.stats);
  if (stats) {
    for (const key of ['races', 'wins', 'repairs', 'jobs', 'purchases', 'sales', 'earned', 'spent', 'paints'] as const) {
      state.stats[key] = integer(stats[key], 0);
    }
    state.stats.distance = bounded(stats.distance, 0);
    state.stats.records = normalizeRecords(stats.records);
  }

  const suppliedAchievements = Array.isArray(payload.achievements) ? payload.achievements : [];
  state.achievements = ACHIEVEMENTS.filter((achievement) => suppliedAchievements.includes(achievement.id)).map(({ id }) => id);
  const ownedModels = state.cars.map((car) => car.model);
  const suppliedCollection = Array.isArray(payload.collection) ? payload.collection : [];
  state.collection = MODELS.map((model) => model.index).filter((model) => suppliedCollection.includes(model) || ownedModels.includes(model));

  const market = object(payload.market);
  if (Array.isArray(market?.bought)) {
    state.market.bought = market.bought.filter((entry): entry is string => typeof entry === 'string' && /^lot-\d+-\d+$/.test(entry)).slice(-36);
  }

  const tournament = object(payload.tournament);
  if (tournament && state.level >= TOURNAMENT.minLevel) {
    state.tournament = { stage: integer(tournament.stage, 0, 0, TOURNAMENT.modes.length - 1), points: integer(tournament.points, 0, 0, 15) };
  }

  const pending = object(payload.pendingRace);
  if (pending && isMode(pending.mode) && state.level >= RACES[pending.mode].minLevel) {
    state.pendingRace = { mode: pending.mode, tournament: pending.tournament === true && state.tournament !== null };
  }
  return state;
}

export function exportSave(state: GameState): string {
  const envelope: SaveEnvelope = { format: 'night-garage', version: SAVE_VERSION, state };
  return JSON.stringify(envelope, null, 2);
}

export function importSave(text: string): GameState {
  if (text.length > MAX_IMPORT_SIZE) throw new Error('El archivo supera los 2 MB.');
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('El archivo no contiene JSON válido.');
  }
  return normalizeSave(value);
}

function validSlot(slot: number): SaveSlot {
  if (slot === 1 || slot === 2 || slot === 3) return slot;
  throw new Error('Selecciona una ranura de guardado válida.');
}

function openDatabase(): Promise<IDBDatabase> {
  if (connection) return connection;
  connection = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no está disponible.'));
      return;
    }
    const open = indexedDB.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE, { keyPath: 'slot' });
    };
    open.onsuccess = () => {
      const database = open.result;
      database.onversionchange = () => {
        database.close();
        connection = null;
      };
      resolve(database);
    };
    open.onerror = () => reject(open.error ?? new Error('No se pudo abrir la base de partidas.'));
    open.onblocked = () => reject(new Error('Otra pestaña bloquea la base de partidas.'));
  }).catch((error: unknown) => {
    connection = null;
    throw error;
  });
  return connection;
}

function fromRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('No se pudo acceder a la partida.'));
  });
}

function readFallback(slot: SaveSlot): SlotRecord | null {
  try {
    const raw = localStorage.getItem(`${LOCAL_PREFIX}${slot}`);
    if (!raw) return null;
    return JSON.parse(raw) as SlotRecord;
  } catch {
    return null;
  }
}

async function readRecords(): Promise<SlotRecord[]> {
  const fallback = SAVE_SLOTS.map((slot) => readFallback(slot)).filter((record): record is SlotRecord => record !== null);
  try {
    const database = await openDatabase();
    const stored = await fromRequest<SlotRecord[]>(database.transaction(STORE).objectStore(STORE).getAll());
    return [...stored, ...fallback];
  } catch {
    return fallback;
  }
}

function summarize(slot: SaveSlot, updatedAt: number, state: GameState): SlotSummary {
  const car = state.cars.find((item) => item.id === state.activeCarId) ?? state.cars[0];
  return { slot, updatedAt, money: state.money, rep: state.rep, level: state.level, cars: state.cars.length, activeModel: car.model, tutorialStep: state.tutorial.step };
}

function decode(record: SlotRecord): GameState {
  return normalizeSave(record.save);
}

export async function listSlots(): Promise<(SlotSummary | null)[]> {
  const records = await readRecords();
  return SAVE_SLOTS.map((slot) => {
    const matches = records.filter((record) => record.slot === slot).sort((first, second) => second.updatedAt - first.updatedAt);
    for (const record of matches) {
      try {
        return summarize(slot, record.updatedAt, decode(record));
      } catch {
        // Leave a corrupted backup intact in case it can be recovered later.
      }
    }
    return null;
  });
}

export async function loadSlot(value: number): Promise<GameState | null> {
  const slot = validSlot(value);
  const records = (await readRecords()).filter((record) => record.slot === slot).sort((first, second) => second.updatedAt - first.updatedAt);
  let failure: unknown;
  for (const record of records) {
    try {
      return decode(record);
    } catch (error: unknown) {
      failure = error;
    }
  }
  if (failure) throw failure;
  return null;
}

const writeQueues = new Map<SaveSlot, Promise<SlotSummary>>();

export function saveSlot(value: number, state: GameState): Promise<SlotSummary> {
  const slot = validSlot(value);
  const snapshot = normalizeSave(JSON.parse(exportSave(state)) as unknown);
  const updatedAt = Date.now();
  const save: SaveEnvelope = { format: 'night-garage', version: SAVE_VERSION, state: snapshot };
  const record: SlotRecord = { slot, updatedAt, save };
  const previous = writeQueues.get(slot);
  const write = (async () => {
    if (previous) await previous.catch(() => undefined);
    try {
      const database = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE, 'readwrite');
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('No se pudo guardar la partida.'));
        transaction.onabort = () => reject(transaction.error ?? new Error('Se interrumpió el guardado.'));
        transaction.objectStore(STORE).put(record);
      });
      try {
        localStorage.removeItem(`${LOCAL_PREFIX}${slot}`);
      } catch {
        // IndexedDB already contains the complete save.
      }
    } catch {
      try {
        localStorage.setItem(`${LOCAL_PREFIX}${slot}`, JSON.stringify(record));
      } catch {
        throw new Error('El navegador no permite guardar aquí. Exporta la partida como JSON.');
      }
    }
    return summarize(slot, updatedAt, snapshot);
  })();
  writeQueues.set(slot, write);
  const clear = () => {
    if (writeQueues.get(slot) === write) writeQueues.delete(slot);
  };
  void write.then(clear, clear);
  return write;
}
