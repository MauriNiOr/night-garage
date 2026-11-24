import {
  ACHIEVEMENTS, COMPONENT_KEYS, COMPONENTS, CUSTOMIZATIONS, CUSTOMIZATION_KEYS, JOBS,
  LEVELS, MODELS, RACES, TOURNAMENT, TUTORIAL,
  type ComponentKey, type Condition, type CustomizationKey, type RaceMode, type TutorialEvent,
} from './catalog';

export const SAVE_VERSION = 2;
export const GARAGE_SPAWN = { x: 470, y: 379 };

export interface Car {
  id: string;
  model: number;
  km: number;
  color: number;
  fuel: number;
  condition: Condition;
  mods: Record<CustomizationKey, number>;
}

export interface PlayerPosition {
  scene: 'garage' | 'road';
  x: number;
  y: number;
  angle?: number;
}

export interface Settings {
  music: number;
  sfx: number;
  quality: 'low' | 'high';
}

export interface RaceRecord {
  time: number;
  position: number;
  drift: number;
}

export interface Stats {
  races: number;
  wins: number;
  repairs: number;
  jobs: number;
  purchases: number;
  sales: number;
  distance: number;
  earned: number;
  spent: number;
  paints: number;
  records: Partial<Record<RaceMode, RaceRecord>>;
}

export interface GameState {
  version: number;
  money: number;
  rep: number;
  xp: number;
  level: number;
  cars: Car[];
  activeCarId: string;
  parts: Record<ComponentKey, number>;
  tutorial: { step: number; skipped: boolean };
  position: PlayerPosition;
  settings: Settings;
  job: { id: string; ready: boolean } | null;
  stats: Stats;
  achievements: string[];
  collection: number[];
  market: { bought: string[] };
  tournament: { stage: number; points: number } | null;
  pendingRace: { mode: RaceMode; tournament: boolean } | null;
  nextCarId: number;
}

export interface CommandResult {
  ok: boolean;
  message: string;
}

export interface MarketOffer {
  id: string;
  model: number;
  car: Car;
  price: number;
  discount: number;
  special: boolean;
}

export interface DriveReport {
  distance: number;
  damage: number;
}

export interface RaceReport extends DriveReport {
  mode: RaceMode;
  time: number;
  position: number;
  total: number;
  drift: number;
  completed?: boolean;
}

export interface RaceReward extends CommandResult {
  payout: number;
  rep: number;
  completed: boolean;
  won: boolean;
  personalBest: boolean;
  tournamentFinished: boolean;
  sponsorship: number;
  wages: number;
}

const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const success = (message: string): CommandResult => ({ ok: true, message });
const fail = (message: string): CommandResult => ({ ok: false, message });
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const numberOn = (value: number, min: number, max: number) => Number.isFinite(value) ? clamp(value, min, max) : min;

export function moneyText(value: number) {
  return euro.format(value);
}

export function makeCar(modelIndex: number, id: string): Car {
  const model = MODELS[modelIndex] ?? MODELS[0];
  const mods = Object.fromEntries(CUSTOMIZATION_KEYS.map((key) => [key, key === 'color' ? model.color : 0])) as Car['mods'];
  return { id, model: model.index, km: model.km, color: model.color, fuel: 70, condition: { ...model.condition }, mods };
}

export function newGame(): GameState {
  return {
    version: SAVE_VERSION,
    money: 2500,
    rep: 0,
    xp: 0,
    level: 1,
    cars: [makeCar(0, 'car-1')],
    activeCarId: 'car-1',
    parts: Object.fromEntries(COMPONENT_KEYS.map((key) => [key, 0])) as GameState['parts'],
    tutorial: { step: 0, skipped: false },
    position: { scene: 'garage', ...GARAGE_SPAWN },
    settings: { music: 0.55, sfx: 0.75, quality: 'high' },
    job: null,
    stats: { races: 0, wins: 0, repairs: 0, jobs: 0, purchases: 0, sales: 0, distance: 0, earned: 0, spent: 0, paints: 0, records: {} },
    achievements: [],
    collection: [0],
    market: { bought: [] },
    tournament: null,
    pendingRace: null,
    nextCarId: 2,
  };
}

export function activeCar(state: GameState): Car {
  return state.cars.find((car) => car.id === state.activeCarId) ?? state.cars[0];
}

export function carTuning(car: Car) {
  const model = MODELS[car.model];
  const { mods, condition } = car;
  const engineHealth = 0.65 + 0.27 * condition.engine / 100 + 0.08 * condition.oil / 100;
  const acceleration = 9.2 / model.acceleration;
  const driveGrip = { FWD: 1.05, RWD: 1, AWD: 1.12 }[model.drive];
  return {
    model: model.index,
    color: car.color,
    power: clamp(acceleration ** 0.67 * engineHealth * (1 + 0.14 * mods.engine + 0.12 * mods.turbo + 0.045 * mods.exhaust + 0.065 * mods.gearbox), 0.62, 2.65),
    grip: driveGrip * (0.76 + 0.14 * condition.tires / 100 + 0.10 * condition.suspension / 100) * (1 + 0.09 * mods.tires + 0.06 * mods.ride + 0.025 * mods.wing + 0.015 * mods.rims),
    brakes: (0.61 + 0.39 * condition.brakes / 100) * (1 + 0.17 * mods.brakes + 0.035 * mods.tires) * (1 + (1100 - model.weight) / 3600),
    maxSpeed: Math.round(model.maxSpeed * (0.73 + 0.22 * condition.engine / 100 + 0.05 * condition.gearbox / 100) * (1 + 0.055 * mods.engine + 0.045 * mods.turbo - 0.015 * mods.gearbox)),
    nitro: 0.87 + 0.13 * condition.turbo / 100 + 0.25 * mods.turbo,
    rims: mods.rims,
    ride: mods.ride,
    wing: mods.wing,
    bumper: mods.bumper,
    vinyl: mods.vinyl,
    neon: mods.neon,
    exhaust: mods.exhaust,
  };
}

export function canDrive(state: GameState): CommandResult {
  const car = activeCar(state);
  if (car.condition.battery < 30) return fail('Necesitas cambiar la batería antes de poder arrancar.');
  if (car.fuel < 1) return fail('El depósito está vacío. Reposta en el aparcamiento.');
  return success('');
}

function debit(state: GameState, amount: number) {
  state.money -= amount;
  state.stats.spent += amount;
}

function credit(state: GameState, amount: number) {
  state.money += amount;
  state.stats.earned += amount;
}

function addProgress(state: GameState, amount: number) {
  state.rep += amount;
  state.xp += amount * 10;
}

function award(state: GameState, id: string) {
  if (state.achievements.includes(id)) return;
  const achievement = ACHIEVEMENTS.find((item) => item.id === id);
  if (!achievement) return;
  state.achievements.push(id);
  credit(state, achievement.reward);
}

function checkEconomy(state: GameState) {
  if (state.money >= 10000) award(state, 'economy');
}

export function advanceTutorial(state: GameState, event: TutorialEvent): boolean {
  if (state.tutorial.skipped || TUTORIAL[state.tutorial.step]?.event !== event) return false;
  state.tutorial.step += 1;
  const car = activeCar(state);
  while (true) {
    const next = TUTORIAL[state.tutorial.step]?.event;
    const alreadyDone = (
      (next === 'buy' && (state.parts.battery > 0 || car.condition.battery >= 30))
      || (next === 'repair' && car.condition.battery >= 30)
      || (next === 'customize' && state.stats.paints > 0)
      || (next === 'race' && state.stats.races > 0)
      || (next === 'upgrade' && state.level > 1)
    );
    if (!alreadyDone) break;
    state.tutorial.step += 1;
  }
  return true;
}

export function skipTutorial(state: GameState): CommandResult {
  state.tutorial.skipped = true;
  return success('Guía oculta. Puedes recuperarla desde el menú de pausa.');
}

export function resumeTutorial(state: GameState): CommandResult {
  state.tutorial.skipped = false;
  return success('Guía activada.');
}

export function buyPart(state: GameState, key: ComponentKey): CommandResult {
  if (!Object.hasOwn(COMPONENTS, key)) return fail('Recambio desconocido.');
  const part = COMPONENTS[key];
  if (state.level < part.minLevel) return fail('El recambio todavía no está disponible.');
  if (state.parts[key] >= 99) return fail('El almacén ya está lleno de este recambio.');
  if (state.money < part.price) return fail('No hay saldo suficiente.');
  debit(state, part.price);
  state.parts[key] += 1;
  if (key === 'battery') advanceTutorial(state, 'buy');
  return success(`Comprado: ${part.part}.`);
}

export function repairCar(state: GameState, key: ComponentKey, quality = 1): CommandResult {
  if (!Object.hasOwn(COMPONENTS, key)) return fail('Recambio desconocido.');
  const part = COMPONENTS[key];
  if (state.level < part.minLevel) return fail('Te falta acceso a este recambio.');
  if (state.parts[key] <= 0) return fail(`Necesitas comprar: ${part.part}.`);
  const car = activeCar(state);
  const customerRepair = (
    state.job !== null && !state.job.ready
    && JOBS.some((job) => job.id === state.job?.id && job.component === key)
  );
  if (!customerRepair && car.condition[key] >= 100) return fail('La pieza ya está en perfecto estado.');
  const precision = numberOn(quality, 0, 1);
  if (precision < 0.45) return fail('El montaje quedó incompleto. Puedes repetirlo.');
  state.parts[key] -= 1;
  if (customerRepair && state.job) {
    state.job.ready = true;
  } else {
    car.condition[key] = Math.max(car.condition[key], Math.round(70 + 30 * precision));
  }
  state.stats.repairs += 1;
  state.xp += 16 + Math.round(24 * precision);
  award(state, 'first-repair');
  if (key === 'battery' && !customerRepair) advanceTutorial(state, 'repair');
  return success(customerRepair ? 'Reparación lista. Entrega el coche en el ordenador.' : `${part.name} al ${car.condition[key]} %.`);
}

export function customizeCar(state: GameState, key: CustomizationKey, value: number): CommandResult {
  if (!Object.hasOwn(CUSTOMIZATIONS, key)) return fail('Modificación desconocida.');
  const customization = CUSTOMIZATIONS[key];
  const option = customization.options.find((item) => item.value === value);
  if (!option || option.minLevel > state.level) return fail('La modificación aún no está desbloqueada.');
  const car = activeCar(state);
  if (car.mods[key] === value) return fail('Ya está instalada.');
  if (state.money < option.price) return fail('No hay saldo suficiente.');
  debit(state, option.price);
  car.mods[key] = value;
  if (key === 'color') {
    car.color = value;
    car.condition.paint = 100;
    state.stats.paints += 1;
    advanceTutorial(state, 'customize');
  }
  state.xp += 12;
  return success(`${customization.name}: ${option.label}.`);
}

export function carValue(car: Car): number {
  const model = MODELS[car.model];
  const conditionWeights: Record<ComponentKey, number> = {
    engine: 0.22, body: 0.17, tires: 0.12, brakes: 0.10, suspension: 0.08,
    oil: 0.07, battery: 0.07, paint: 0.07, gearbox: 0.06, turbo: 0.04,
  };
  const condition = COMPONENT_KEYS.reduce((sum, key) => sum + car.condition[key] * conditionWeights[key] / 100, 0);
  const majorDefect =
    0.34 * Math.max(0, 30 - car.condition.battery) / 30
    + 0.29 * Math.max(0, 58 - car.condition.body) / 58
    + 0.27 * Math.max(0, 55 - car.condition.brakes) / 55
    + 0.18 * Math.max(0, 52 - car.condition.oil) / 52
    + 0.25 * Math.max(0, 58 - car.condition.engine) / 58;
  const mileage = clamp((model.km - car.km) / 1000000, -0.12, 0.09);
  const modifications = CUSTOMIZATION_KEYS.reduce((sum, key) => {
    if (key === 'color') return sum;
    return sum + (CUSTOMIZATIONS[key].options.find((option) => option.value === car.mods[key])?.price ?? 0) * 0.28;
  }, 0);
  return Math.round((model.price * Math.max(0.21, 0.45 + condition * 0.49 + mileage - majorDefect) + modifications) / 5) * 5;
}

export function marketOffers(state: GameState, now = Date.now()): MarketOffer[] {
  const cycle = Math.floor(now / 86400000) + state.stats.races + state.stats.jobs + state.stats.sales;
  return MODELS.map((model) => {
    const id = `lot-${cycle}-${model.index}`;
    const car = makeCar(model.index, id);
    const flavor = (cycle * 67 + model.index * 97) % 41;
    const special = (model.index + cycle) % 4 === 0;
    const ordinary = flavor / 1000 - 0.02;
    const plannedDiscount = special ? 19 + flavor % 10 : 2 + flavor % 8;
    if (special) {
      const defect: ComponentKey = (['body', 'oil', 'brakes', 'battery'] as const)[flavor % 4];
      const severeWear = defect === 'battery' ? 12 + flavor % 12 : 29 + flavor % 18;
      car.condition[defect] = Math.min(car.condition[defect], severeWear);
    }
    car.km += Math.round((flavor - 17) * 127);
    const reference = model.price * (0.95 + ordinary);
    const dealerMinimum = carValue(car) * (special ? 1.025 : 1.08);
    const price = Math.ceil(Math.max(dealerMinimum, reference * (1 - plannedDiscount / 100)) / 10) * 10;
    const discount = Math.max(0, Math.round((1 - price / reference) * 100));
    return { id, model: model.index, car, price, discount, special };
  }).filter((offer) => !state.market.bought.includes(offer.id));
}

export function buyCar(state: GameState, offerId: string): CommandResult {
  const offer = marketOffers(state).find((option) => option.id === offerId);
  if (!offer || state.level < MODELS[offer.model].minLevel) return fail('Esta oferta todavía no está disponible.');
  if (state.money < offer.price) return fail('No hay saldo suficiente.');
  if (state.cars.length >= Math.min(12, 2 + state.level * 2)) return fail('No hay plazas libres en el aparcamiento.');
  const car = { ...offer.car, id: `car-${state.nextCarId}` };
  state.nextCarId += 1;
  debit(state, offer.price);
  state.cars.push(car);
  state.stats.purchases += 1;
  state.market.bought = [...state.market.bought.slice(-35), offerId];
  if (!state.collection.includes(car.model)) state.collection.push(car.model);
  if (state.collection.length >= 3) award(state, 'three-models');
  return success(`Comprado: ${MODELS[car.model].name}.`);
}

export function sellCar(state: GameState, carId: string): CommandResult {
  const car = state.cars.find((option) => option.id === carId);
  if (!car) return fail('Ese coche no está en el aparcamiento.');
  if (state.cars.length === 1) return fail('Necesitas conservar al menos un coche.');
  if (car.id === 'car-1' && !state.tutorial.skipped && state.tutorial.step < 7) {
    return fail('Termina de preparar el Kairo antes de venderlo.');
  }
  state.cars = state.cars.filter((option) => option.id !== carId);
  if (state.activeCarId === carId) state.activeCarId = state.cars[0].id;
  const price = carValue(car);
  credit(state, price);
  state.stats.sales += 1;
  state.xp += 40;
  award(state, 'first-sale');
  checkEconomy(state);
  return success(`Vendido por ${moneyText(price)}.`);
}

export function selectCar(state: GameState, carId: string): CommandResult {
  const car = state.cars.find((option) => option.id === carId);
  if (!car) return fail('Ese coche no está en el aparcamiento.');
  state.activeCarId = carId;
  return success(`${MODELS[car.model].name} listo en el elevador.`);
}

export function acceptJob(state: GameState, jobId: string): CommandResult {
  if (state.job) return fail('Entrega el encargo activo antes de aceptar otro.');
  const job = JOBS.find((option) => option.id === jobId && state.level >= option.minLevel);
  if (!job) return fail('Este encargo todavía no está disponible.');
  state.job = { id: job.id, ready: false };
  return success(`${job.client} ha dejado el coche. Busca el recambio y completa el montaje.`);
}

export function claimJob(state: GameState): CommandResult {
  const job = JOBS.find((option) => option.id === state.job?.id);
  if (!job || !state.job?.ready) return fail('Todavía queda trabajo por hacer.');
  credit(state, job.pay);
  addProgress(state, job.rep);
  state.stats.jobs += 1;
  state.job = null;
  if (state.stats.jobs >= 3) award(state, 'three-jobs');
  checkEconomy(state);
  return success(`Encargo entregado. +${moneyText(job.pay)} · +${job.rep} REP.`);
}

export function upgradeWorkshop(state: GameState): CommandResult {
  const next = LEVELS[state.level];
  if (!next) return fail('Has completado todas las ampliaciones.');
  if (state.rep < next.rep) return fail(`Necesitas ${next.rep} puntos de reputación.`);
  if (state.money < next.cost) return fail(`La ampliación cuesta ${moneyText(next.cost)}.`);
  debit(state, next.cost);
  state.level = next.level;
  state.xp += next.level * 100;
  advanceTutorial(state, 'upgrade');
  if (state.level === 5) award(state, 'maximum-level');
  return success(`Nivel ${next.level} · ${next.name}.`);
}

export function fuelPrice(state: GameState): number {
  return Math.ceil((100 - activeCar(state).fuel) * 1.35);
}

export function refuel(state: GameState): CommandResult {
  const car = activeCar(state);
  const cost = Math.min(fuelPrice(state), state.money);
  if (car.fuel >= 100) return fail('El depósito ya está lleno.');
  if (cost <= 0) return fail('No hay saldo suficiente.');
  debit(state, cost);
  car.fuel = Math.min(100, car.fuel + cost / 1.35);
  return success(`Depósito al ${Math.round(car.fuel)} % · ${moneyText(cost)}.`);
}

export function applyDrive(state: GameState, report: DriveReport): void {
  const car = activeCar(state);
  const meters = numberOn(report.distance, 0, 250000) * 0.17;
  const impact = numberOn(report.damage, 0, 100);
  car.fuel = Math.max(0, car.fuel - meters * 0.0046);
  car.km += meters / 1000;
  car.condition.body = Math.max(0, car.condition.body - impact * 0.44);
  car.condition.paint = Math.max(0, car.condition.paint - impact * 0.2);
  car.condition.brakes = Math.max(10, car.condition.brakes - meters / 1550);
  car.condition.tires = Math.max(10, car.condition.tires - meters / 1180);
  car.condition.oil = Math.max(8, car.condition.oil - meters / 1720);
  car.condition.engine = Math.max(10, car.condition.engine - impact * 0.08 - meters / 2600);
  state.stats.distance += meters;
}

export function tournamentRace(state: GameState): RaceMode | undefined {
  return state.tournament ? TOURNAMENT.modes[state.tournament.stage] : undefined;
}

export function startTournament(state: GameState): CommandResult {
  if (state.level < TOURNAMENT.minLevel) return fail('La Copa se desbloquea en el nivel 4.');
  if (state.tournament) return fail('La Copa ya está en marcha.');
  if (state.money < TOURNAMENT.fee) return fail('No hay saldo suficiente para la inscripción.');
  const drivable = canDrive(state);
  if (!drivable.ok) return drivable;
  debit(state, TOURNAMENT.fee);
  state.tournament = { stage: 0, points: 0 };
  return success('Inscripción confirmada. Primera prueba: sprint.');
}

export function raceEntry(state: GameState, mode: RaceMode): CommandResult {
  if (!Object.hasOwn(RACES, mode)) return fail('Prueba desconocida.');
  const race = RACES[mode];
  if (state.level < race.minLevel) return fail('La prueba aún no está desbloqueada.');
  if (state.pendingRace) {
    return state.pendingRace.mode === mode ? success('Inscripción recuperada.') : fail('Termina o abandona la prueba inscrita primero.');
  }
  const drivable = canDrive(state);
  if (!drivable.ok) return drivable;
  const tournament = tournamentRace(state) === mode;
  if (!tournament && state.money < race.fee) return fail('No hay saldo suficiente para la inscripción.');
  const car = activeCar(state);
  if (car.fuel < 4) return fail('Necesitas al menos un 4 % de combustible para inscribirte.');
  if (!tournament) debit(state, race.fee);
  car.fuel -= 3;
  state.pendingRace = { mode, tournament };
  return success(`Inscripción confirmada: ${race.subtitle}.`);
}

export function abandonRace(state: GameState, report?: DriveReport): CommandResult {
  if (report) applyDrive(state, report);
  state.pendingRace = null;
  return success('Has abandonado la prueba.');
}

export function settleRace(state: GameState, report: RaceReport): RaceReward {
  const reward: RaceReward = {
    ok: false, message: 'No hay una inscripción activa para este resultado.',
    payout: 0, rep: 0, completed: false, won: false, personalBest: false, tournamentFinished: false, sponsorship: 0, wages: 0,
  };
  const entry = state.pendingRace;
  const race = RACES[report.mode];
  if (!entry || !race || entry.mode !== report.mode || !Number.isFinite(report.time) || report.time <= 0) return reward;
  state.pendingRace = null;
  applyDrive(state, report);
  if (report.completed === false) {
    reward.ok = true;
    reward.message = 'Tiempo agotado. Quedaron puntos de control por cruzar.';
    return reward;
  }
  reward.completed = true;
  const total = Math.round(numberOn(report.total, 1, 50));
  const position = Math.round(numberOn(report.position, 1, total));
  const drift = numberOn(report.drift, 0, 1000000);
  const firstRace = state.stats.races === 0;
  const won = report.mode === 'time' ? report.time <= (race.target ?? 0)
    : report.mode === 'drift' ? drift >= (race.target ?? 0) : position === 1;
  const fraction = won ? 1 : total > 1 && position === 2 ? 0.67 : 0.44;
  reward.payout = Math.round(race.prize * fraction);
  reward.rep = firstRace ? race.rep : Math.max(3, Math.round(race.rep * fraction));
  reward.won = won;
  reward.ok = true;
  reward.message = won ? 'Victoria registrada.' : 'Resultado registrado.';
  if (firstRace) reward.payout = Math.max(450, reward.payout);
  if (state.level >= 4) {
    reward.sponsorship = won ? 500 : 180;
    reward.wages = state.level === 5 ? 140 : 85;
    credit(state, reward.sponsorship);
    debit(state, reward.wages);
  }
  credit(state, reward.payout);
  addProgress(state, reward.rep);
  state.stats.races += 1;
  if (won) state.stats.wins += 1;
  const record = state.stats.records[report.mode];
  reward.personalBest = !record || (report.mode === 'drift' ? drift > record.drift : report.time < record.time);
  if (reward.personalBest) state.stats.records[report.mode] = { time: report.time, position, drift };
  if (firstRace) award(state, 'first-race');
  if (won) award(state, 'first-win');
  if (entry.tournament && state.tournament && tournamentRace(state) === report.mode) {
    state.tournament.points += won ? 5 : position === 2 && total > 1 ? 3 : 1;
    state.tournament.stage += 1;
    if (state.tournament.stage === TOURNAMENT.modes.length) {
      const tournamentPrize = state.tournament.points >= 11 ? TOURNAMENT.prize : Math.round(TOURNAMENT.prize * 0.45);
      reward.tournamentFinished = true;
      reward.payout += tournamentPrize;
      reward.rep += TOURNAMENT.rep;
      credit(state, tournamentPrize);
      addProgress(state, TOURNAMENT.rep);
      award(state, 'tournament');
      state.tournament = null;
    }
  }
  checkEconomy(state);
  advanceTutorial(state, 'race');
  return reward;
}
