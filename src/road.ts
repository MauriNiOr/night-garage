import Phaser from 'phaser';
import { bridge } from './bridge';
import { RACES } from './catalog';
import type { RaceMode } from './catalog';
import { cityMap, HORIZONTALS, VERTICALS } from './geography';
import type { Zone } from './geography';

export type RoadMode = 'free' | RaceMode;
type Point = { x: number; y: number };
type Rect = Point & { width: number; height: number };
type Tuning = {
  power: number; grip: number; brakes: number; maxSpeed: number; nitro: number; color: number; model: number;
  wing?: number; neon?: number; rims?: number; vinyl?: number; ride?: number; exhaust?: number; bumper?: number;
};
type RoadStart = { mode?: RoadMode; tuning?: Tuning; resume?: Point & { angle?: number } };
type Route = { points: Point[]; laps: number; opponents: number };
type Car = { body: Phaser.GameObjects.Container; x: number; y: number; velocityX: number; velocityY: number; angle: number };
type Driver = { car: Car; progress: number; pace: number; lane: number; phase: number; course?: Waypoint[] };
type KeyMap = Record<'w' | 'a' | 's' | 'd' | 'up' | 'down' | 'left' | 'right' | 'space' | 'shift' | 'e', Phaser.Input.Keyboard.Key>;
type Waypoint = Point & { length: number; total: number };
type Paint = { roof: string; mid: string; dark: string; edge: string; wall: string; lamp: string };
type CulledGroup = Rect & { items: (Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible)[] };
type Rain = { x: number; y: number; speed: number; height: number; alpha: number };

const { width: WIDTH, height: HEIGHT, roads: ROADS, zones: ZONES } = cityMap;
const KMH_PER_PIXEL = 0.63;
const pt = (x: number, y: number): Point => ({ x, y });
const ROUTES: Record<Exclude<RoadMode, 'free'>, Route> = {
  sprint: { points: [pt(500, 420), pt(1130, 420), pt(1130, 1030), pt(1890, 1030), pt(1890, 1680), pt(2660, 1680), pt(3260, 1680)], laps: 1, opponents: 3 },
  circuit: { points: [pt(1170, 1030), pt(1890, 1030), pt(1890, 1680), pt(1130, 1680), pt(1130, 1030), pt(1170, 1030)], laps: 2, opponents: 3 },
  time: { points: [pt(480, 1680), pt(1130, 1680), pt(1130, 2160), pt(1890, 2160), pt(1890, 1680), pt(2660, 1680)], laps: 1, opponents: 0 },
  drift: { points: [pt(2620, 2160), pt(1890, 2160), pt(1890, 1680), pt(1130, 1680), pt(1130, 2160), pt(400, 2160)], laps: 1, opponents: 0 },
  drag: { points: [pt(1950, 420), pt(2270, 420), pt(2660, 420), pt(3020, 420), pt(3260, 420)], laps: 1, opponents: 2 },
};
const PAINTS: Paint[] = [
  { roof:'#3d464d', mid:'#2c333f', dark:'#151e2b', edge:'#606172', wall:'#262d39', lamp:'#eeb889' },
  { roof:'#454155', mid:'#342e44', dark:'#1b1a2c', edge:'#646176', wall:'#2b2741', lamp:'#76d5cf' },
  { roof:'#484641', mid:'#32343a', dark:'#1b222d', edge:'#65635a', wall:'#32333b', lamp:'#ed9e70' },
  { roof:'#364e4e', mid:'#263c43', dark:'#192935', edge:'#536466', wall:'#243842', lamp:'#c1e0ae' },
];
const DEFAULT_TUNING: Tuning = { power: 1, grip: 1, brakes: 1, maxSpeed: 160, nitro: 1, color: 0xc94b40, model: 0 };
const TAU = Math.PI * 2;
const clamp = Phaser.Math.Clamp;
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const unit = (a: Point, b: Point) => { const size = distance(a, b) || 1; return { x: (b.x - a.x) / size, y: (b.y - a.y) / size }; };
const contains = (rect: Rect, x: number, y: number) => x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;

class Random {
  private value: number;
  constructor(seed: number) { this.value = seed; }
  next() { this.value = (Math.imul(this.value, 1664525) + 1013904223) >>> 0; return this.value / 0x100000000; }
  integer(min: number, max: number) { return Math.floor(this.next() * (max - min + 1)) + min; }
  pick<T>(items: T[]) { return items[this.integer(0, items.length - 1)]; }
}

export class RoadScene extends Phaser.Scene {
  private mode: RoadMode = 'free';
  private tuning: Tuning = DEFAULT_TUNING;
  private resume?: RoadStart['resume'];
  private route?: Route;
  private waypoints: Waypoint[] = [];
  private player!: Car;
  private keys?: KeyMap;
  private random = new Random(43);
  private solids: Rect[] = [];
  private culled: CulledGroup[] = [];
  private cullTimer = 0;
  private rivals: Driver[] = [];
  private traffic: Driver[] = [];
  private marks!: Phaser.GameObjects.Graphics;
  private weather!: Phaser.GameObjects.Graphics;
  private rain: Rain[] = [];
  private particles: { x: number; y: number; time: number; size: number; color: number; vx: number; vy: number }[] = [];
  private checkpoint = 1;
  private lap = 1;
  private elapsed = 0;
  private countdown = 0;
  private position = 1;
  private nextHud = 0;
  private hitCooldown = 0;
  private markClock = 0;
  private nitro = 100;
  private damage = 0;
  private drift = 0;
  private travel = 0;
  private finishDelay = 0;
  private finished = false;
  private completed = false;
  private wasTouchInteract = false;
  private interactionPending = false;
  private nearest?: Zone;
  private modeClock = 0;
  private trafficLights: { image: Phaser.GameObjects.Rectangle; horizontal: boolean }[] = [];
  private pedestrians: { body: Phaser.GameObjects.Image; x: number; y: number; facing: number; phase: number }[] = [];

  constructor() { super('road'); }

  init(data?: RoadStart) {
    this.mode = data?.mode ?? 'free';
    this.tuning = data?.tuning ?? DEFAULT_TUNING;
    this.resume = data?.resume;
    this.route = this.mode === 'free' ? undefined : ROUTES[this.mode];
    this.waypoints = this.route ? this.makeCourse(this.route.points) : [];
    this.random = new Random(43);
    this.solids = [];
    this.culled = [];
    this.cullTimer = 0;
    this.rivals = [];
    this.traffic = [];
    this.trafficLights = [];
    this.pedestrians = [];
    this.particles = [];
    this.checkpoint = 1;
    this.lap = 1;
    this.elapsed = 0;
    this.countdown = this.route ? 3.55 : 0;
    this.position = this.route ? Math.min(2, this.route.opponents + 1) : 1;
    this.nextHud = 0;
    this.hitCooldown = 0;
    this.markClock = 0;
    this.nitro = 100;
    this.damage = 0;
    this.drift = 0;
    this.travel = 0;
    this.finishDelay = 0;
    this.finished = false;
    this.completed = false;
    this.wasTouchInteract = false;
    this.interactionPending = false;
    this.nearest = undefined;
    this.modeClock = 0;
  }

  preload() {
    const root = import.meta.env.BASE_URL;
    for (let index = 0; index < 12; index++) {
      const model = String(index).padStart(2, '0');
      if (!this.textures.exists('road-car-' + index)) this.load.image('road-car-' + index, root + 'art/car-' + model + '.png');
      if (!this.textures.exists('road-mask-' + index)) this.load.image('road-mask-' + index, root + 'art/car-mask-' + model + '.png');
    }
    for (const kind of ['industrial', 'corner', 'apartments']) {
      if (!this.textures.exists('road-building-' + kind)) this.load.image('road-building-' + kind, root + 'art/building-' + kind + '.png');
    }
    if (!this.textures.exists('road-props')) this.load.spritesheet('road-props', root + 'art/city-props.png', { frameWidth: 64, frameHeight: 64 });
  }

  create() {
    this.buildTextures();
    this.buildCity();
    const start = this.route ? this.route.points[0] : this.validResume();
    const target = this.route?.points[1];
    const angle = target ? Math.atan2(target.y - start.y, target.x - start.x) : Phaser.Math.DegToRad(this.resume?.angle ?? 0);
    const lane = this.route ? 21 : 0;
    this.player = this.addCar(start.x - Math.sin(angle) * lane, start.y + Math.cos(angle) * lane, angle, this.tuning.model, this.tuning.color, true);
    this.buildDrivers(angle);
    this.marks = this.add.graphics().setDepth(74);
    this.weather = this.add.graphics().setDepth(100);
    this.rain = Array.from({ length: 130 }, () => ({
      x: this.random.next(), y: this.random.next(),
      speed: this.random.integer(180, 390), height: this.random.integer(4, 11), alpha: this.random.next() * 0.21 + 0.06,
    }));
    const camera = this.cameras.main;
    camera.setBackgroundColor('#111a21').setBounds(0, 0, WIDTH, HEIGHT);
    camera.setZoom(this.route ? 1.35 : 1.03);
    camera.centerOn(this.player.x, this.player.y);
    camera.startFollow(this.player.body, true, 0.12, 0.12);
    if (this.route) camera.zoomTo(1.03, 3250, 'Sine.easeInOut');
    camera.fadeIn(this.route ? 700 : 260, 11, 15, 24);
    this.keys = this.input.keyboard?.addKeys({
      w: 'W', a: 'A', s: 'S', d: 'D', up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT',
      space: 'SPACE', shift: 'SHIFT', e: 'E',
    }) as KeyMap | undefined;
    this.cullDecorations();
    const interactionKey = this.keys?.e;
    const queueInteraction = () => { if (!bridge.paused) this.interactionPending = true; };
    interactionKey?.on('down', queueInteraction);
    const removeTouchListener = bridge.on('interact:press', queueInteraction);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      interactionKey?.off('down', queueInteraction);
      removeTouchListener();
    });
    bridge.emit('road-ready', { mode: this.mode });
    this.emitHud(0, 0);
  }

  private validResume(): Point {
    if (this.resume && this.resume.x > 60 && this.resume.x < WIDTH - 60 && this.resume.y > 60 && this.resume.y < HEIGHT - 60
      && !this.inCollision(this.resume.x, this.resume.y)) return this.resume;
    return cityMap.garage;
  }

  private canvasTexture(name: string, width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) {
    if (this.textures.exists(name)) return;
    const texture = this.textures.createCanvas(name, width, height);
    if (!texture) return;
    const ctx = texture.getContext();
    ctx.imageSmoothingEnabled = false;
    paint(ctx);
    texture.refresh();
  }

  private buildTextures() {
    const surfaces = [
      ['asphalt', '#283140', '#344356', '#1a2333'],
      ['lot', '#28343c', '#405362', '#232d35'],
      ['paving', '#3b444d', '#4a5660', '#2f3744'],
      ['park', '#223638', '#2d403d', '#1d2f36'],
      ['water', '#122c3b', '#1c3b4b', '#102531'],
    ];
    for (const [name, base, bright, dark] of surfaces) {
      this.canvasTexture('road-' + name, 64, 64, ctx => {
        const random = new Random(422 + name.charCodeAt(0));
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, 64, 64);
        for (let index = 0; index < 145; index++) {
          ctx.fillStyle = index % 3 ? bright : dark;
          ctx.globalAlpha = .21 + random.next() * .2;
          ctx.fillRect(random.integer(0, 63), random.integer(0, 63), random.integer(1, name === 'water' ? 10 : 3), 1);
        }
        ctx.globalAlpha = .75;
        if (name === 'paving') {
          ctx.fillStyle = dark;
          for (let y = 0; y < 64; y += 16) {
            ctx.fillRect(0, y, 64, 1);
            for (let x = y % 32 ? -16 : 0; x < 64; x += 32) ctx.fillRect(x, y, 1, 16);
          }
        }
        if (name === 'asphalt') {
          ctx.fillStyle = '#bacccc';
          ctx.globalAlpha = .08;
          ctx.fillRect(11, 8, 14, 1);
          ctx.fillRect(16, 9, 8, 1);
          ctx.fillRect(42, 41, 11, 1);
        }
      });
    }
    for (const [name, color] of [['amber', '#f4bd7d'], ['mint', '#75d8c6'], ['pink', '#e17ac8'], ['red', '#ff815d']] as const) {
      this.canvasTexture('road-glow-' + name, 96, 96, ctx => {
        const gradient = ctx.createRadialGradient(48, 48, 0, 48, 48, 48);
        gradient.addColorStop(0, color + 'a5');
        gradient.addColorStop(.23, color + '55');
        gradient.addColorStop(.66, color + '21');
        gradient.addColorStop(1, color + '00');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 96, 96);
      });
    }
    this.canvasTexture('road-head-beam', 168, 74, ctx => {
      const gradient = ctx.createLinearGradient(0, 0, 168, 0);
      gradient.addColorStop(0, '#eece8275');
      gradient.addColorStop(.19, '#f7dc9a40');
      gradient.addColorStop(.7, '#eece8214');
      gradient.addColorStop(1, '#eece8200');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0, 32);
      ctx.lineTo(0, 42);
      ctx.lineTo(150, 74);
      ctx.lineTo(168, 58);
      ctx.lineTo(168, 16);
      ctx.lineTo(150, 0);
      ctx.closePath();
      ctx.fill();
    });
    this.canvasTexture('road-tree', 64, 67, ctx => {
      const random = new Random(8052);
      const polygon = (color: string, vertices: number[][]) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        vertices.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        ctx.closePath();
        ctx.fill();
      };
      polygon('#151f2bc0', [[19,38],[37,35],[60,51],[54,60],[34,62],[9,48]]);
      ctx.fillStyle = '#42403a';
      ctx.fillRect(31, 41, 5, 16);
      ctx.fillStyle = '#646353';
      ctx.fillRect(31, 42, 2, 11);
      polygon('#132b2f', [[8,23],[13,14],[22,8],[30,9],[36,4],[46,9],[49,16],[55,19],[59,30],[53,43],[43,49],[29,50],[19,46],[9,42],[4,34]]);
      polygon('#244341', [[9,22],[16,15],[22,12],[33,12],[36,7],[45,11],[48,19],[53,23],[55,31],[48,38],[40,41],[26,43],[18,40],[9,34]]);
      polygon('#35534a', [[11,22],[17,17],[27,13],[36,13],[40,11],[45,15],[42,20],[48,22],[46,29],[38,28],[34,34],[25,36],[16,33],[11,29]]);
      for (let index = 0; index < 35; index++) {
        const x = random.integer(11, 49), y = random.integer(12, 37);
        if (Math.hypot((x - 30) * .79, y - 25) < 15) {
          ctx.fillStyle = random.pick(['#476057','#4e6955','#263e3d','#294842','#3c544b']);
          ctx.fillRect(x, y, random.integer(2, 5), 2);
        }
      }
    });
    this.canvasTexture('road-pedestrian', 12, 20, ctx => {
      ctx.fillStyle = '#10182799'; ctx.fillRect(3, 17, 9, 3);
      ctx.fillStyle = '#242739'; ctx.fillRect(3, 12, 6, 5); ctx.fillRect(2, 16, 3, 3); ctx.fillRect(7, 17, 3, 2);
      ctx.fillStyle = '#74866f'; ctx.fillRect(2, 6, 8, 7);
      ctx.fillStyle = '#aab49b'; ctx.fillRect(3, 6, 5, 2);
      ctx.fillStyle = '#c79378'; ctx.fillRect(4, 2, 4, 5);
      ctx.fillStyle = '#48373f'; ctx.fillRect(3, 1, 5, 3);
    });
    for (let model = 0; model < 12; model++) {
      if (!this.textures.exists('road-car-' + model)) this.fallbackCar(model);
    }
  }

  private fallbackCar(model: number) {
    this.canvasTexture('road-car-' + model, 64, 32, ctx => {
      const random = new Random(1943 + model * 11);
      const tail = 6 + model % 4;
      const nose = 58 - model % 5;
      const top = 5 + model % 3;
      const bottom = 32 - top;
      const colors = ['#ac4e4a','#8d6778','#a18564','#6b918d','#999eaa','#b2796c'];
      const body = colors[model % colors.length];
      const roofEnd = random.integer(33, 39);
      ctx.fillStyle = '#121925';
      ctx.fillRect(tail + 3, top - 2, 11, 5); ctx.fillRect(tail + 3, bottom - 2, 11, 5);
      ctx.fillRect(nose - 13, top - 2, 10, 5); ctx.fillRect(nose - 13, bottom - 2, 10, 5);
      ctx.fillStyle = '#181c2b';
      ctx.beginPath();
      ctx.moveTo(tail, top + 1); ctx.lineTo(nose - 4, top); ctx.lineTo(nose + 1, top + 4);
      ctx.lineTo(nose + 1, bottom - 4); ctx.lineTo(nose - 4, bottom); ctx.lineTo(tail, bottom - 1);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = body;
      ctx.fillRect(tail + 1, top + 2, nose - tail - 4, bottom - top - 4);
      ctx.fillStyle = '#f8b88b46'; ctx.fillRect(tail + 2, top + 2, nose - tail - 7, 2);
      ctx.fillStyle = '#171d30'; ctx.fillRect(tail + 8, top + 5, 11, bottom - top - 10);
      ctx.fillStyle = '#283f51'; ctx.fillRect(tail + 10, top + 6, 5, bottom - top - 12);
      ctx.fillStyle = '#182c42'; ctx.fillRect(roofEnd, top + 4, 10, bottom - top - 8);
      ctx.fillStyle = '#56858e'; ctx.fillRect(roofEnd + 7, top + 6, 2, bottom - top - 12);
      ctx.fillStyle = '#392537'; ctx.fillRect(tail + 3, bottom - 5, nose - tail - 9, 2);
      ctx.fillStyle = '#ff534f'; ctx.fillRect(tail, top + 3, 3, 4); ctx.fillRect(tail, bottom - 6, 3, 4);
      ctx.fillStyle = '#ffe0a1'; ctx.fillRect(nose - 3, top + 3, 3, 4); ctx.fillRect(nose - 3, bottom - 6, 3, 4);
      if (model % 3 === 1) { ctx.fillStyle = '#424555'; ctx.fillRect(tail + 2, top - 1, 3, bottom - top + 3); }
    });
  }

  private cullDecorations() {
    const view = this.cameras.main.worldView;
    const width = view.width || 960, height = view.height || 540;
    const x = view.width ? view.x - 104 : this.player.x - width / 2 - 104;
    const y = view.height ? view.y - 104 : this.player.y - height / 2 - 104;
    const right = x + width + 208, bottom = y + height + 208;
    for (const group of this.culled) {
      const visible = group.x + group.width >= x && group.x <= right && group.y + group.height >= y && group.y <= bottom;
      for (const item of group.items) if (item.visible !== visible) item.setVisible(visible);
    }
    for (const driver of [...this.rivals, ...this.traffic]) {
      const body = driver.car.body;
      const visible = body.x >= x && body.x <= right && body.y >= y && body.y <= bottom;
      if (body.visible !== visible) body.setVisible(visible);
    }
  }

  private cullGroup(start: number, x: number, y: number, width: number, height: number) {
    const items = this.children.getChildren().slice(start) as CulledGroup['items'];
    this.culled.push({ x, y, width, height, items });
  }

  private buildCity() {
    const ground = this.add.graphics().setDepth(1);
    this.add.tileSprite(0, 0, WIDTH, HEIGHT, 'road-lot').setOrigin(0);
    this.add.tileSprite(3375, 0, WIDTH - 3375, HEIGHT, 'road-water').setOrigin(0).setDepth(2);
    ground.fillStyle(0x172128, 0.72);
    ground.fillRect(3365, 0, 20, HEIGHT);
    ground.lineStyle(2, 0x6a7779, .64);
    ground.lineBetween(3374, 0, 3374, HEIGHT);
    for (const y of [450, 850, 1400, 1900]) {
      ground.fillStyle(0x323840, 1);
      ground.fillRect(3315, y, 300, 70);
      ground.fillStyle(0x4c5154, 1);
      ground.fillRect(3315, y, 300, 5);
      for (let x = 3360; x < 3614; x += 16) ground.fillRect(x, y + 5, 1, 65);
      ground.fillStyle(0x75483c, 1);
      ground.fillRect(3610, y + 4, 7, 62);
    }
    const paving = this.add.graphics().setDepth(3);
    for (const rect of ROADS) {
      paving.fillStyle(0x101a24, 1);
      paving.fillRect(rect.x - 21, rect.y - 19, rect.width + 42, rect.height + 40);
      const index = this.children.length;
      this.add.tileSprite(rect.x - 16, rect.y - 15, rect.width + 32, rect.height + 30, 'road-paving').setOrigin(0).setDepth(4);
      this.cullGroup(index, rect.x - 16, rect.y - 15, rect.width + 32, rect.height + 30);
    }
    for (const rect of ROADS) {
      const index = this.children.length;
      this.add.tileSprite(rect.x, rect.y, rect.width, rect.height, 'road-asphalt').setOrigin(0).setDepth(5);
      this.cullGroup(index, rect.x, rect.y, rect.width, rect.height);
    }
    const lanes = this.add.graphics().setDepth(6);
    const details = this.add.graphics().setDepth(7);
    for (const [index, rect] of ROADS.entries()) {
      const horizontal = index < HORIZONTALS.length;
      const cross = horizontal ? VERTICALS : HORIZONTALS;
      const center = horizontal ? rect.y + rect.height / 2 : rect.x + rect.width / 2;
      const start = horizontal ? rect.x : rect.y;
      const size = horizontal ? rect.width : rect.height;
      const half = (horizontal ? rect.height : rect.width) / 2;
      for (let along = start + 18; along < start + size - 21; along += 36) {
        if (cross.some(axis => Math.abs(axis - along) < 120)) continue;
        lanes.fillStyle(index === 0 || index === 2 ? 0xba9667 : 0xa6a7aa, .47);
        if (horizontal) lanes.fillRect(along, center - 1, 17, 2);
        else lanes.fillRect(center - 1, along, 2, 17);
      }
      for (let along = start; along < start + size; along += 10) {
        if (cross.some(axis => Math.abs(axis - along) < 103)) continue;
        lanes.fillStyle(0x829394, .36);
        for (const side of [-1, 1]) {
          if (horizontal) lanes.fillRect(along, center + side * (half - 3), 10, 2);
          else lanes.fillRect(center + side * (half - 3), along, 2, 10);
        }
        if (along % 50 === 0) {
          details.fillStyle(0x141b27, .65);
          if (horizontal) details.fillRect(along, center + half - 9, 13, 3);
          else details.fillRect(center + half - 9, along, 3, 13);
        }
      }
      for (let along = start + 79; along < start + size - 70; along += 155) {
        if (cross.some(axis => Math.abs(axis - along) < 138)) continue;
        const side = Math.floor(along / 100) % 2 ? 1 : -1;
        const x = horizontal ? along : center + side * (half + 8);
        const y = horizontal ? center + side * (half + 8) : along;
        this.streetlamp(x, y, horizontal, index % 2 ? 'mint' : 'amber');
      }
    }
    for (const x of VERTICALS) for (const y of HORIZONTALS) {
      for (const dir of [-1, 1]) {
        for (let stripe = -69; stripe < 73; stripe += 13) {
          lanes.fillStyle(0xbcc0b6, .34);
          lanes.fillRect(x + dir * 102 - 7, y + stripe, 15, 6);
          lanes.fillRect(x + stripe, y + dir * 105 - 7, 6, 15);
        }
      }
      this.trafficLight(x - 102, y + 108, true);
      this.trafficLight(x + 104, y - 100, false);
    }
    this.populateBlocks();
    this.signage();
  }

  private streetlamp(x: number, y: number, horizontal: boolean, color: 'amber' | 'mint') {
    const start = this.children.length;
    const light = color === 'amber' ? 0xf8d3a0 : 0x8cdfd0;
    const reflection = this.add.graphics().setDepth(8);
    for (let streak = 0; streak < 34; streak++) {
      const dx = this.random.integer(-32, 32);
      const dy = this.random.integer(-43, 43);
      reflection.fillStyle(light, (this.random.next() * .22 + .045) * (1 - Math.hypot(dx, dy) / 83));
      if (horizontal) reflection.fillRect(x + dx, y + dy, this.random.integer(4, 24), 1);
      else reflection.fillRect(x + dy, y + dx, this.random.integer(4, 18), 1);
    }
    this.add.image(x + 4, y - 7, 'road-glow-' + color).setDepth(9).setDisplaySize(223, 179).setBlendMode(Phaser.BlendModes.ADD).setAlpha(.82);
    const pole = this.add.graphics().setDepth(48);
    pole.fillStyle(0x101925, .66).fillRect(x - 2, y + 3, 18, 3);
    pole.fillStyle(0x121d28, 1).fillRect(x - 3, y - 1, 7, 4);
    pole.fillStyle(0x7a8588, 1).fillRect(x, y - 19, 2, 20);
    pole.fillStyle(0x47565f, 1).fillRect(x + 2, y - 19, 1, 20);
    pole.fillStyle(0xa8b1a5, 1).fillRect(x, y - 21, 9, 3);
    pole.fillStyle(light, 1).fillRect(x + 2, y - 19, 7, 3);
    this.add.image(x + 5, y - 18, 'road-glow-' + color).setDepth(49).setDisplaySize(39, 33).setBlendMode(Phaser.BlendModes.ADD);
    this.cullGroup(start, x - 107, y - 97, 215, 192);
  }

  private trafficLight(x: number, y: number, horizontal: boolean) {
    const start = this.children.length;
    const post = this.add.graphics().setDepth(48);
    post.fillStyle(0x141b26, 1).fillRect(x - 4, y - 21, 10, 17).fillRect(x, y - 6, 2, 7);
    post.fillStyle(0x586975, 1).fillRect(x - 5, y - 22, 1, 17).fillRect(x + 2, y - 4, 1, 6);
    const image = this.add.rectangle(x + 1, y - 15, 3, 5, 0x99dab0).setDepth(49);
    this.add.image(x + 1, y - 14, 'road-glow-mint').setDepth(49).setDisplaySize(31, 31).setAlpha(.55).setBlendMode(Phaser.BlendModes.ADD);
    this.trafficLights.push({ image, horizontal });
    this.cullGroup(start, x - 14, y - 30, 26, 37);
  }

  private populateBlocks() {
    const lefts = [70, ...VERTICALS];
    const rights = [...VERTICALS, 3332];
    const tops = [20, ...HORIZONTALS];
    const bottoms = [...HORIZONTALS, 2395];
    for (let row = 0; row < tops.length; row++) for (let col = 0; col < lefts.length; col++) {
      let left = lefts[col] + (col === 0 ? 0 : 112);
      let top = tops[row] + (row === 0 ? 0 : 124);
      const right = rights[col] - (col === rights.length - 1 ? 0 : 112);
      const bottom = bottoms[row] - (row === bottoms.length - 1 ? 0 : 123);
      if (right - left < 105 || bottom - top < 100) continue;
      const park = (row === 2 && col === 3) || (row === 3 && col === 4);
      const parking = (row === 0 && col === 3) || (row === 4 && col === 2);
      const industrial = row === 1 || col >= 4 || row === 4;
      const otherWidth = right - left;
      const otherHeight = bottom - top;
      const blockIndex = this.children.length;
      this.add.tileSprite(left, top, otherWidth, otherHeight, park ? 'road-park' : parking ? 'road-asphalt' : 'road-paving').setOrigin(0).setDepth(2);
      this.cullGroup(blockIndex, left, top, otherWidth, otherHeight);
      if (park) {
        this.park(left, top, otherWidth, otherHeight);
        continue;
      }
      if (parking) {
        this.parking(left, top, otherWidth, otherHeight);
        continue;
      }
      const small = otherWidth < 340;
      const columns = small ? 1 : 2;
      const rows = otherHeight > 295 ? 2 : 1;
      for (let buildingRow = 0; buildingRow < rows; buildingRow++) {
        for (let buildingCol = 0; buildingCol < columns; buildingCol++) {
          const workshop = row === 1 && col === 1 && buildingRow === 0 && buildingCol === 0;
          const width = Math.min(Math.floor(otherWidth / columns) - 22, this.random.integer(150, industrial ? 245 : 206));
          const height = Math.min(Math.floor(otherHeight / rows) - 22, this.random.integer(98, industrial ? 156 : 147));
          const x = Math.floor(left + buildingCol * otherWidth / columns + (otherWidth / columns - width) / 2);
          const y = Math.floor(top + buildingRow * otherHeight / rows + (otherHeight / rows - height) / 2);
          const variant = (buildingRow + col + row + buildingCol) % 4;
          this.structure(x, y, width, height, variant, industrial ? 'industrial' : buildingRow === 1 ? 'apartments' : 'corner', workshop);
        }
      }
      for (let tree = 0; tree < 4; tree++) {
        const x = tree % 2 ? right - 1 : left + 4;
        const y = top + 30 + Math.floor(tree / 2) * (otherHeight - 55);
        if (!this.inCollision(x, y, 32)) this.tree(x, y, industrial ? .8 : 1.04);
      }
      if (industrial) {
        this.streetProps(left + 14, top + otherHeight * .56);
        this.streetProps(right - 29, bottom - 18);
      }
      if (row === 2 && col === 2) {
        for (let index = 0; index < 4; index++) this.parked(left + 136 + index * 71, top - 30, index + 2, 0, index);
      }
      left += 8;
      top += 8;
      if (!industrial && row > 0) {
        for (let index = 0; index < 3; index++) {
          const x = left + 34 + index * Math.min(61, otherWidth / 4);
          this.pedestrians.push({ body: this.add.image(x, top, 'road-pedestrian').setDepth(49).setScale(1.25), x, y: top, facing: index % 2 ? -1 : 1, phase: index * 5 + col * 7 });
        }
      }
    }
  }

  private structure(x: number, y: number, width: number, height: number, variant: number, kind: 'industrial' | 'corner' | 'apartments', workshop: boolean) {
    const start = this.children.length;
    const paint = PAINTS[variant % PAINTS.length];
    const key = `road-roof-${width}-${height}-${variant}-${workshop ? 1 : 0}`;
    const artKey = 'road-building-' + kind;
    if (this.textures.exists(artKey) && !workshop) {
      this.add.image(x + width / 2, y + height / 2, artKey).setDepth(31).setDisplaySize(width + 8, height + 8);
    } else {
      this.canvasTexture(key, width + 28, height + 28, ctx => {
        const random = new Random(width * 29 + height * 53 + variant * 123);
        const faceStart = height - 32;
        ctx.fillStyle = '#141c29ad'; ctx.fillRect(14, 15, width + 12, height + 10);
        ctx.fillStyle = paint.dark; ctx.fillRect(2, 10, width + 8, height - 4);
        ctx.fillStyle = paint.wall; ctx.fillRect(4, faceStart, width - 4, 36);
        ctx.fillStyle = paint.roof; ctx.fillRect(2, 3, width, faceStart - 1);
        ctx.fillStyle = paint.mid; ctx.fillRect(8, 10, width - 12, faceStart - 16);
        ctx.fillStyle = paint.edge; ctx.fillRect(3, 3, width - 1, 2); ctx.fillRect(2, 5, 2, faceStart - 7);
        ctx.fillStyle = '#111a27'; ctx.fillRect(9, faceStart - 6, width - 10, 3); ctx.fillRect(width - 3, 5, 3, faceStart - 8);
        ctx.fillStyle = '#121725'; ctx.fillRect(4, faceStart, width - 4, 4); ctx.fillRect(5, height + 3, width - 5, 4);
        ctx.fillStyle = paint.edge; ctx.fillRect(5, faceStart + 4, width - 7, 1);
        for (let step = 0; step < 90; step++) {
          ctx.globalAlpha = .18 + random.next() * .35;
          ctx.fillStyle = random.pick([paint.dark, paint.edge, paint.roof]);
          ctx.fillRect(random.integer(10, width - 11), random.integer(9, faceStart - 11), random.integer(2, 12), 1);
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = paint.dark;
        for (let line = 16; line < width - 5; line += 25) ctx.fillRect(line, 12, 1, faceStart - 23);
        const vents = kind === 'industrial' ? 3 : 2;
        for (let vent = 0; vent < vents; vent++) {
          const vx = 20 + vent * Math.min(43, Math.floor((width - 44) / vents));
          const vy = random.integer(17, Math.max(20, faceStart - 35));
          ctx.fillStyle = '#161725'; ctx.fillRect(vx + 3, vy + 4, 22, 15);
          ctx.fillStyle = paint.edge; ctx.fillRect(vx, vy, 22, 12);
          ctx.fillStyle = paint.dark; ctx.fillRect(vx + 2, vy + 2, 18, 8);
          ctx.fillStyle = paint.roof;
          for (let ridge = 3; ridge < 18; ridge += 3) ctx.fillRect(vx + ridge, vy + 3, 1, 6);
        }
        if (kind === 'industrial' || workshop) {
          for (let bay = 14; bay < width - 34; bay += 48) {
            const shutter = workshop && bay === 14;
            ctx.fillStyle = '#181d29'; ctx.fillRect(bay - 2, faceStart + 7, 39, 27);
            ctx.fillStyle = shutter ? '#665249' : paint.mid; ctx.fillRect(bay, faceStart + 10, 35, 24);
            ctx.fillStyle = paint.edge; ctx.fillRect(bay, faceStart + 9, 35, 1);
            ctx.fillStyle = paint.dark;
            for (let ridge = 14; ridge < 32; ridge += 3) ctx.fillRect(bay + 1, faceStart + ridge, 32, 1);
            ctx.fillStyle = shutter ? '#f19a66' : paint.lamp; ctx.fillRect(bay + 12, faceStart + 6, 9, 2);
          }
        } else {
          for (let wx = 13; wx < width - 18; wx += 24) {
            for (const wy of [faceStart + 8, faceStart + 20]) {
              ctx.fillStyle = '#161d2a'; ctx.fillRect(wx - 1, wy - 1, 15, 10);
              ctx.fillStyle = random.next() > .35 ? paint.lamp : '#3a505e'; ctx.fillRect(wx + 1, wy, 11, 6);
              ctx.fillStyle = paint.wall; ctx.fillRect(wx + 6, wy, 1, 7);
              ctx.fillStyle = paint.edge; ctx.fillRect(wx - 1, wy + 8, 15, 1);
            }
          }
        }
      });
      this.add.image(x, y, key).setOrigin(0).setDepth(30);
    }
    this.solids.push({ x: x + 7, y: y + 11, width: width - 12, height: height - 10 });
    const glow = workshop ? 'red' : variant === 1 || variant === 3 ? 'mint' : 'amber';
    const lights = this.add.graphics().setDepth(10);
    for (let offset = 16; offset < width - 14; offset += 42) {
      this.add.image(x + offset + 7, y + height + 5, 'road-glow-' + glow).setDepth(29).setDisplaySize(76, 72).setBlendMode(Phaser.BlendModes.ADD).setAlpha(.7);
      for (let reflection = 0; reflection < 6; reflection++) {
        const tint = glow === 'mint' ? 0x6ed3bc : 0xf9af7b;
        lights.fillStyle(tint, .14 - reflection * .015);
        lights.fillRect(x + offset + this.random.integer(-5, 7), y + height + 10 + reflection * 3, this.random.integer(3, 14), 1);
      }
    }
    this.cullGroup(start, x - 14, y - 4, width + 55, height + 52);
  }

  private park(left: number, top: number, width: number, height: number) {
    const path = this.add.graphics().setDepth(8);
    path.fillStyle(0x3e5051, .8).fillRect(left + 6, top + height / 2 - 12, width - 12, 24);
    path.fillStyle(0x647073, .36).fillRect(left + 6, top + height / 2 - 11, width - 12, 2);
    for (let x = left + 24; x < left + width - 9; x += 53) {
      for (const y of [top + 40, top + height - 29]) this.tree(x + this.random.integer(-9, 9), y + this.random.integer(-8, 8), this.random.next() * .44 + .77, true);
      if (Math.floor(x / 53) % 2 === 0) this.streetlamp(x, top + height / 2, true, 'mint');
    }
    for (let x = left + 52; x < left + width - 40; x += 106) {
      const y = top + height / 2 + 17;
      path.fillStyle(0x151f2b, .8).fillRect(x + 2, y + 2, 26, 10);
      path.fillStyle(0x7d655c, .88).fillRect(x, y, 25, 5);
      path.fillStyle(0x322f39, 1).fillRect(x + 3, y + 5, 2, 4).fillRect(x + 21, y + 5, 2, 4);
    }
  }

  private tree(x: number, y: number, scale: number, solid = false) {
    const start = this.children.length;
    this.add.image(x, y, 'road-tree').setOrigin(.5, .77).setDepth(46).setScale(scale);
    if (solid) this.solids.push({ x: x - 7, y: y - 5, width: 14, height: 13 });
    this.cullGroup(start, x - 34, y - 60, 68, 77);
  }

  private parking(left: number, top: number, width: number, height: number) {
    const paint = this.add.graphics().setDepth(8);
    for (let x = left + 30; x < left + width - 25; x += 42) {
      paint.fillStyle(0xa2a797, .52).fillRect(x - 19, top + 26, 2, 51).fillRect(x - 19, top + height - 79, 2, 51);
      if (this.random.next() < .75) this.parked(x, top + this.random.integer(47, 54), this.random.integer(0, 11), 90, this.random.integer(0, 6));
      if (this.random.next() > .33) this.parked(x, top + height - 54, this.random.integer(0, 11), 270, this.random.integer(0, 6));
    }
    this.streetlamp(left + 15, top + height / 2, true, 'amber');
    this.streetlamp(left + width - 17, top + height / 2, true, 'amber');
  }

  private prop(x: number, y: number, frame: number, scale = 1) {
    if (this.textures.exists('road-props')) this.add.image(x, y, 'road-props', frame).setOrigin(.5, .84).setScale(scale).setDepth(38);
  }

  private streetProps(x: number, y: number) {
    const start = this.children.length;
    const detail = this.add.graphics().setDepth(38);
    const tint = this.random.pick([0x4b6063, 0x5f524f, 0x546375]);
    detail.fillStyle(0x16202e, .75).fillRect(x + 5, y + 4, 24, 16);
    detail.fillStyle(tint, 1).fillRect(x, y, 25, 13);
    detail.fillStyle(0x7e8d87, .48).fillRect(x + 1, y, 23, 2);
    detail.fillStyle(0x28393c, .8).fillRect(x, y + 10, 25, 3);
    for (let ridge = 3; ridge < 25; ridge += 4) detail.fillStyle(0x25323a, .5).fillRect(x + ridge, y + 2, 1, 8);
    detail.fillStyle(0xb78b63, .8).fillRect(x + 3, y + 11, 2, 1).fillRect(x + 21, y + 11, 2, 1);
    this.solids.push({ x, y, width: 25, height: 13 });
    this.cullGroup(start, x, y, 30, 22);
  }

  private signage() {
    this.prop(1045, 944, 2, 1.18);
    this.prop(1006, 960, 2, 1.18);
    for (let index = 0; index < 4; index++) this.prop(518 + index * 52, 1830 + index % 2 * 16, 1, 1.1);
    this.prop(3081, 516, 3, 1.16);
    this.prop(3253, 1874, 1, 1.3);
    this.prop(3310, 1878, 1, 1.27);
    for (const zone of ZONES) {
      const start = this.children.length;
      const marker = this.add.graphics().setDepth(12);
      const radius = zone.garage ? 48 : 30;
      marker.lineStyle(1, zone.accent, zone.garage ? .86 : .45);
      marker.strokeRoundedRect(zone.x - radius, zone.y - 17, radius * 2, 34, 3);
      marker.fillStyle(zone.accent, .10);
      marker.fillRoundedRect(zone.x - radius, zone.y - 17, radius * 2, 34, 3);
      marker.fillStyle(zone.accent, .65);
      marker.fillRect(zone.x - radius + 4, zone.y + 12, radius * 2 - 8, 2);
      this.add.image(zone.x, zone.y, 'road-glow-' + (zone.garage || zone.race ? 'red' : 'mint')).setDepth(13)
        .setDisplaySize(radius * 4, 120).setBlendMode(Phaser.BlendModes.ADD).setAlpha(.8);
      const label = this.add.text(zone.x, zone.y + 21, zone.short.toUpperCase(), {
        fontFamily: 'Trebuchet MS, sans-serif', fontSize: zone.garage ? '12px' : '9px', color: '#' + zone.accent.toString(16).padStart(6, '0'),
        stroke: '#151b29', strokeThickness: 3, fontStyle: 'bold',
      }).setOrigin(.5, 0).setDepth(18);
      if (!zone.garage && this.route) { label.setAlpha(.38); marker.setAlpha(.4); }
      this.cullGroup(start, zone.x - 100, zone.y - 62, 200, 125);
    }
    const titles = [
      {x: 655, y: 550, name: 'NIGHT GARAGE', note: 'EST. 1996', color: '#ff9b69'},
      {x: 1023, y: 931, name: 'NOX', note: 'COMBUSTIBLES', color: '#89e4d2'},
      {x: 2015, y: 1146, name: 'COBALTO', note: 'MOTORS', color: '#cfacfa'},
      {x: 2536, y: 927, name: 'OVERDRIVE', note: 'PIEZAS', color: '#ffc196'},
      {x: 534, y: 1797, name: 'FARO', note: 'RECAMBIOS', color: '#eaba8b'},
      {x: 3270, y: 1840, name: 'DÁRSENA 9', note: 'PUERTO', color: '#8dd9da'},
      {x: 2774, y: 2045, name: 'MONTES', note: 'DEL ESTE', color: '#d2b6fc'},
    ];
    for (const title of titles) {
      const start = this.children.length;
      const width = Math.max(83, title.name.length * 9 + 24);
      const board = this.add.graphics().setDepth(51);
      board.fillStyle(0x0d1723, .85).fillRoundedRect(title.x - width / 2, title.y - 15, width, 39, 2);
      board.lineStyle(1, Number.parseInt(title.color.slice(1), 16), .56).strokeRoundedRect(title.x - width / 2, title.y - 15, width, 39, 2);
      board.fillStyle(Number.parseInt(title.color.slice(1), 16), .43).fillRect(title.x - width / 2 + 4, title.y - 12, width - 8, 1);
      this.add.text(title.x, title.y - 5, title.name, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '15px', color: title.color, fontStyle: 'bold' }).setOrigin(.5).setDepth(52);
      this.add.text(title.x, title.y + 11, title.note, { fontFamily: 'monospace', fontSize: '8px', color: '#a5a39e' }).setOrigin(.5).setDepth(52);
      this.add.image(title.x, title.y + 3, 'road-glow-red').setDisplaySize(width * 1.75, 89).setAlpha(.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(52);
      this.cullGroup(start, title.x - width, title.y - 42, width * 2, 90);
    }
  }

  private coloredModel(model: number, color: number) {
    const original = 'road-car-' + model;
    const mask = 'road-mask-' + model;
    if (!this.textures.exists(mask)) return original;
    const key = `road-painted-${model}-${color}`;
    const originalImage = this.textures.get(original).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const maskImage = this.textures.get(mask).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const { width, height } = originalImage;
    this.canvasTexture(key, width, height, ctx => {
      ctx.drawImage(maskImage, 0, 0);
      const recolored = ctx.getImageData(0, 0, width, height);
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(originalImage, 0, 0);
      const base = ctx.getImageData(0, 0, width, height);
      const colors = [color >>> 16 & 255, color >>> 8 & 255, color & 255];
      for (let index = 0; index < recolored.data.length; index += 4) {
        if (!recolored.data[index + 3]) continue;
        const shade = recolored.data[index];
        for (let channel = 0; channel < 3; channel++) {
          const component = colors[channel];
          const tinted = shade < 179 ? component * shade / 179 : component + (255 - component) * (shade - 179) / 76;
          const alpha = recolored.data[index + 3] / 255;
          base.data[index + channel] = tinted * alpha + base.data[index + channel] * (1 - alpha);
        }
      }
      ctx.putImageData(base, 0, 0);
    });
    return key;
  }

  private addCar(x: number, y: number, angle: number, model: number, color: number, player = false, parked = false): Car {
    const id = Phaser.Math.Wrap(Math.round(model), 0, 12);
    const body = this.add.container(x, y).setRotation(angle).setDepth(43);
    const lights = this.add.graphics();
    const design = player ? this.tuning : undefined;
    lights.fillStyle(0x0d1420, .62).fillEllipse(2, 6, 62, 26);
    lights.fillStyle(0x000716, .53).fillEllipse(0, 3, 58, 22);
    const kit = this.add.graphics();
    if (design?.neon) {
      const neonColors = [0xf87a54, 0x76dbcd, 0xef8bd5, 0xb498ff];
      kit.fillStyle(neonColors[(design.neon - 1) % neonColors.length], .56).fillEllipse(1, 0, 73, 36);
      kit.fillStyle(neonColors[(design.neon - 1) % neonColors.length], .34).fillEllipse(1, 0, 80, 40);
    }
    body.add([lights]);
    if (!parked) {
      const reach = player ? 153 : 94;
      const headlight = this.add.image(22, 0, 'road-head-beam').setOrigin(0, .5).setDisplaySize(reach, player ? 71 : 39)
        .setBlendMode(Phaser.BlendModes.ADD).setAlpha(player ? .9 : .52);
      headlight.setName('headlights');
      const tail = this.add.image(-23, 0, 'road-glow-red').setDisplaySize(player ? 90 : 62, 47).setAlpha(.64).setBlendMode(Phaser.BlendModes.ADD);
      tail.setName('taillights');
      body.add([headlight, tail]);
    }
    body.add(kit);
    const image = this.add.image(0, design?.ride ? Math.max(-2, -design.ride) : 0, this.coloredModel(id, color)).setAlpha(parked ? .82 : 1);
    body.add(image);
    if (design) this.decorateCar(body, design);
    return { body, x, y, velocityX: 0, velocityY: 0, angle };
  }

  private decorateCar(body: Phaser.GameObjects.Container, design: Tuning) {
    const decals = this.add.graphics();
    if (design.wing) {
      decals.fillStyle(0x121623, .95).fillRect(-24, -14, 5, 28);
      decals.fillStyle(0x8d8799, .9).fillRect(-24, -13, 1, 26);
      decals.fillStyle(design.color, .9).fillRect(-25, -14, 2, 3).fillRect(-25, 12, 2, 3);
    }
    if (design.vinyl) {
      const colors = [0xf5c186, 0x93d1ba, 0xe8cdec];
      const color = colors[(design.vinyl - 1) % colors.length];
      decals.fillStyle(color, .9).fillRect(-22, -1, 11, 3).fillRect(13, -1, 12, 3);
      decals.fillStyle(color, .43).fillRect(-9, -1, 13, 3);
      if (design.vinyl > 1) decals.fillStyle(color, .83).fillRect(13, 5, 12, 1).fillRect(-22, 5, 11, 1);
    }
    if (design.rims) {
      const rims = [0xcad0d4, 0xc18654, 0x637286];
      decals.fillStyle(rims[(design.rims - 1) % rims.length], .88);
      for (const x of [-17, 17]) for (const y of [-13, 12]) decals.fillRect(x - 2, y, 5, 2);
    }
    if (design.bumper) decals.fillStyle(0x3e4552, 1).fillRect(27, -9, 2, 18);
    if (design.exhaust) decals.fillStyle(0xbac2c6, 1).fillRect(-26, 5, 5, 2);
    body.add(decals);
  }

  private parked(x: number, y: number, model: number, angle: number, tone: number) {
    const colors = [0x7c8a89, 0x8a625f, 0x6e758e, 0x93786c, 0x7e9791, 0xada499, 0x575c71];
    const start = this.children.length;
    this.addCar(x, y, Phaser.Math.DegToRad(angle), model, colors[tone], false, true);
    this.cullGroup(start, x - 36, y - 34, 72, 68);
    this.solids.push({ x: x - 14, y: y - 13, width: 28, height: 26 });
  }

  private buildDrivers(initialAngle: number) {
    const colors = [0x56a5a0, 0xd3a15f, 0x9b71b4, 0x9a5576, 0x83a88c, 0xada499, 0x6b8fbd];
    if (this.route) {
      for (let index = 0; index < this.route.opponents; index++) {
        const lane = [-34, 44, -30][index];
        const initial = this.mode === 'drag' ? 0 : [-5, -63, -66][index];
        const pace = (this.mode === 'drag' ? [224, 200, 222] : this.mode === 'circuit' ? [207, 198, 183] : [185, 172, 155])[index] + Math.max(0, this.tuning.maxSpeed - 165) * .28;
        const point = this.sampleRoute(initial, lane);
        this.rivals.push({ car: this.addCar(point.x, point.y, initialAngle, [6, 10, 4][index], colors[index]), progress: initial, pace, lane, phase: index * 2.2 });
      }
      return;
    }
    for (let index = 0; index < 12; index++) {
      const progress = 230 + index * 598;
      const lane = index % 2 ? 44 : 30;
      const course = this.trafficCourse(index);
      const point = this.sampleCourse(course, progress, lane, true);
      this.traffic.push({ car: this.addCar(point.x, point.y, point.angle, (index * 7 + 1) % 12, colors[index % colors.length]), progress, pace: 76 + index % 5 * 10, lane, phase: index, course });
    }
  }

  private trafficCourse(index: number): Waypoint[] {
    const region = index % 4;
    const left = VERTICALS[region], right = VERTICALS[region + 1];
    const top = HORIZONTALS[Math.floor(index / 4)], bottom = HORIZONTALS[Math.floor(index / 4) + 1];
    return this.makeCourse([pt(left, top), pt(right, top), pt(right, bottom), pt(left, bottom), pt(left, top)]);
  }

  private makeCourse(points: Point[]) {
    let total = 0;
    return points.map((point, index) => {
      const length = index ? distance(points[index - 1], point) : 0;
      total += length;
      return { ...point, length, total };
    });
  }

  private sampleRoute(progress: number, lane: number) {
    return this.sampleCourse(this.waypoints, progress, lane, this.mode === 'circuit');
  }

  private sampleCourse(points: Waypoint[], progress: number, lane: number, closed: boolean) {
    const total = points[points.length - 1].total;
    const along = closed && progress > total ? progress % total : Math.min(progress, total + 170);
    let index = points.findIndex(point => point.total > along);
    index = index <= 0 ? index === 0 ? 1 : points.length - 1 : index;
    const from = points[index - 1], to = points[index];
    let direction = unit(from, to);
    const excess = along - from.total;
    let x = from.x + direction.x * excess;
    let y = from.y + direction.y * excess;
    for (const corner of [index - 1, index]) {
      const center = points[corner];
      const before = points[corner - 1] ?? (closed ? points[points.length - 2] : undefined);
      const after = points[corner + 1] ?? (closed ? points[1] : undefined);
      if (!before || !after) continue;
      const inDir = unit(before, center), outDir = unit(center, after);
      if (inDir.x === outDir.x && inDir.y === outDir.y) continue;
      const bend = Math.min(90, distance(center, before) * .37, distance(center, after) * .37);
      const offset = along - center.total;
      if (Math.abs(offset) > bend) continue;
      const t = (offset + bend) / (2 * bend);
      const remain = 1 - t;
      x = center.x - inDir.x * bend * remain * remain + outDir.x * bend * t * t;
      y = center.y - inDir.y * bend * remain * remain + outDir.y * bend * t * t;
      direction = { x: inDir.x * remain + outDir.x * t, y: inDir.y * remain + outDir.y * t };
      const length = Math.hypot(direction.x, direction.y) || 1;
      direction.x /= length; direction.y /= length;
    }
    return { x: x - direction.y * lane, y: y + direction.x * lane, angle: Math.atan2(direction.y, direction.x) };
  }

  update(_time: number, delta: number) {
    if (bridge.paused || !this.player) return;
    const seconds = Math.min(delta / 1000, .05);
    this.modeClock += seconds;
    this.hitCooldown = Math.max(0, this.hitCooldown - seconds);
    const keys = this.keys;
    const touch = bridge.touch;
    const pad = this.input.gamepad?.getPad(0);
    const accelerating = Boolean(keys?.w.isDown || keys?.up.isDown || touch.up || pad?.up || (pad?.R2 ?? 0) > .2);
    const decelerating = Boolean(keys?.s.isDown || keys?.down.isDown || touch.down || pad?.down || (pad?.L2 ?? 0) > .2);
    const left = Number(Boolean(keys?.a.isDown || keys?.left.isDown || touch.left || pad?.left));
    const right = Number(Boolean(keys?.d.isDown || keys?.right.isDown || touch.right || pad?.right));
    const steer = right - left || (pad && Math.abs(pad.leftStick.x) > .18 ? pad.leftStick.x : 0);
    const handbrake = Boolean(keys?.space.isDown || touch.handbrake || pad?.X);
    const boost = Boolean(keys?.shift.isDown || touch.boost || pad?.B) && accelerating;
    const interact = touch.interact || Boolean(pad?.A);
    if (this.countdown > 0) this.countdown = Math.max(0, this.countdown - seconds);
    if (this.finishDelay > 0) {
      this.finishDelay -= seconds;
      if (this.finishDelay <= 0) this.reportResult();
    }
    let slip = 0;
    if (this.countdown <= 0 && !this.finished) {
      if (this.route) this.elapsed += seconds;
      const substeps = Math.max(1, Math.ceil(seconds * 120));
      for (let index = 0; index < substeps; index++) {
        slip = this.drive(seconds / substeps, accelerating, decelerating, steer, handbrake, boost);
      }
      this.updateDrivers(seconds);
      if (this.route) this.updateRace(seconds, slip);
      else this.updateZone(this.interactionPending || interact && !this.wasTouchInteract);
    } else if (this.finished) {
      this.player.velocityX *= Math.pow(.16, seconds);
      this.player.velocityY *= Math.pow(.16, seconds);
      this.updateDrivers(seconds);
    }
    this.interactionPending = false;
    this.wasTouchInteract = interact;
    this.drawMotion(seconds, slip, boost);
    this.drawWeather(seconds);
    this.drawRoute();
    this.cullTimer -= seconds;
    if (this.cullTimer <= 0) { this.cullTimer = .085; this.cullDecorations(); }
    this.nextHud -= seconds;
    if (this.nextHud <= 0) {
      this.nextHud = .078;
      this.emitHud(accelerating ? 1 : 0, slip);
    }
  }

  private drive(step: number, gas: boolean, brake: boolean, steering: number, handbrake: boolean, boost: boolean) {
    const car = this.player;
    const tune = this.tuning;
    let forwardX = Math.cos(car.angle), forwardY = Math.sin(car.angle);
    let longitudinal = car.velocityX * forwardX + car.velocityY * forwardY;
    const road = ROADS.some(rect => contains(rect, car.x, car.y));
    const topSpeed = tune.maxSpeed / KMH_PER_PIXEL * (road ? 1 : .63) * (1 - this.damage * .0036);
    const hasBoost = boost && this.nitro > 0;
    let acceleration = 0;
    if (gas) acceleration += longitudinal < -5 ? 283 * tune.brakes : (169 * tune.power + (hasBoost ? 104 : 0)) * (1 - .61 * clamp(longitudinal / (topSpeed * 1.05), 0, 1));
    if (brake) acceleration -= longitudinal > 9 ? 298 * tune.brakes : 119;
    const steeringSpeed = Phaser.Math.SmoothStep(Math.abs(longitudinal), 6, 112) * (.59 + .41 * clamp(Math.abs(longitudinal) / 70, 0, 1));
    const rotation = steering * (handbrake ? 2.67 : 2.42) * steeringSpeed * Math.sign(longitudinal || 1) * (road ? 1 : .86);
    car.angle = Phaser.Math.Angle.Wrap(car.angle + rotation * step);
    forwardX = Math.cos(car.angle);
    forwardY = Math.sin(car.angle);
    const sideX = -forwardY, sideY = forwardX;
    const sideSlip = car.velocityX * sideX + car.velocityY * sideY;
    longitudinal = car.velocityX * forwardX + car.velocityY * forwardY;
    longitudinal += acceleration * step;
    const rolling = handbrake ? .82 : gas || brake ? .19 : .73;
    longitudinal *= Math.exp(-(rolling + (road ? 0 : .34)) * step);
    if (handbrake && Math.abs(longitudinal) > 30) longitudinal -= Math.sign(longitudinal) * 26 * step;
    const cap = topSpeed * (hasBoost ? 1.23 : 1);
    if (longitudinal > cap) longitudinal = Math.max(cap, longitudinal - (hasBoost ? 42 : 105) * step);
    longitudinal = Math.max(-63, longitudinal);
    const lateral = sideSlip * Math.exp(-(handbrake ? 1.86 : road ? 8.5 * tune.grip : 4.55 * tune.grip) * step);
    car.velocityX = forwardX * longitudinal + sideX * lateral;
    car.velocityY = forwardY * longitudinal + sideY * lateral;
    const nextX = car.x + car.velocityX * step, nextY = car.y + car.velocityY * step;
    if (this.inCollision(nextX, nextY)) {
      if (!this.inCollision(nextX, car.y)) car.x = nextX;
      else car.velocityX *= -.28;
      if (!this.inCollision(car.x, nextY)) car.y = nextY;
      else car.velocityY *= -.28;
      this.collision(Math.hypot(longitudinal, lateral), nextX, nextY);
    } else {
      car.x = nextX;
      car.y = nextY;
      this.travel += Math.hypot(car.velocityX, car.velocityY) * step;
    }
    if (hasBoost) this.nitro = Math.max(0, this.nitro - 27 * step / tune.nitro);
    else this.nitro = Math.min(100, this.nitro + (handbrake ? 7.2 : 3.8) * step);
    car.body.setPosition(car.x, car.y).setRotation(car.angle);
    const taillights = car.body.getByName('taillights') as Phaser.GameObjects.Image | null;
    if (taillights) taillights.setAlpha(brake || handbrake ? 1 : .53);
    return clamp(Math.abs(lateral) / 103, 0, 1);
  }

  private inCollision(x: number, y: number, radius = 15) {
    if (x < 44 + radius || y < 31 + radius || x > 3376 - radius || y > HEIGHT - 23 - radius) return true;
    return this.solids.some(rect => {
      if (x < rect.x - radius || x > rect.x + rect.width + radius || y < rect.y - radius || y > rect.y + rect.height + radius) return false;
      const closestX = clamp(x, rect.x, rect.x + rect.width);
      const closestY = clamp(y, rect.y, rect.y + rect.height);
      return (x - closestX) ** 2 + (y - closestY) ** 2 < radius ** 2;
    });
  }

  private collision(speed: number, x: number, y: number) {
    if (speed < 31 || this.hitCooldown > 0) return;
    this.hitCooldown = .42;
    this.damage = Math.min(100, this.damage + 1 + speed * .043);
    this.cameras.main.shake(150, clamp(speed / 31000, .001, .008), true);
    for (let spark = 0; spark < 16; spark++) {
      const angle = this.random.next() * TAU;
      const momentum = this.random.integer(25, 112);
      this.particles.push({ x, y, time: this.random.next() * .32 + .08, size: this.random.integer(1, 3), color: this.random.pick([0xffad68, 0xe66c4e, 0xffe2ac]), vx: Math.cos(angle) * momentum, vy: Math.sin(angle) * momentum });
    }
    bridge.emit('road-hit', { intensity: clamp(speed / 250, 0, 1) });
  }

  private updateDrivers(step: number) {
    for (const driver of this.rivals) {
      const speed = driver.pace * clamp(.39 + this.elapsed * .23, .39, 1) * (1 + Math.sin(this.elapsed * 1.73 + driver.phase) * .075);
      const span = this.waypoints[this.waypoints.length - 1].total;
      const nearCorner = this.waypoints.slice(1, -1).some((point, index) =>
        Math.abs(point.total - (driver.progress % span)) < 79 && Math.abs(unit(this.waypoints[index], point).x - unit(point, this.waypoints[index + 2]).x) > .5);
      const limit = span * (this.route?.laps ?? 1) + 62;
      driver.progress = Math.min(limit, driver.progress + speed * step * (nearCorner ? .70 : 1));
      const point = this.sampleRoute(driver.progress, driver.lane);
      this.moveDriver(driver, point, step);
    }
    for (const driver of this.traffic) {
      const course = driver.course!;
      const span = course[course.length - 1].total;
      const progress = driver.progress % span;
      const next = course.find(point => point.total > progress);
      const point = this.sampleCourse(course, progress, driver.lane, true);
      const horizontal = Math.abs(Math.cos(point.angle)) > .72;
      const green = (Math.floor(this.modeClock / 7.6) % 2 === 0) === horizontal;
      const stopForLight = next && next.total - progress < 125 && next.total - progress > 74 && !green && this.modeClock > 2;
      if (!stopForLight) driver.progress += driver.pace * step;
      this.moveDriver(driver, point, step);
    }
    for (const light of this.trafficLights) {
      const go = (Math.floor(this.modeClock / 7.6) % 2 === 0) === light.horizontal;
      light.image.setFillStyle(go ? 0x9ff1af : 0xfa6b56);
    }
    for (const walker of this.pedestrians) {
      const phase = (this.modeClock * .40 + walker.phase) % TAU;
      walker.body.setPosition(walker.x + Math.sin(phase) * 36, walker.y + (Math.round(this.modeClock * 7 + walker.phase) % 2))
        .setFlipX(Math.cos(phase) * walker.facing < 0);
    }
  }

  private moveDriver(driver: Driver, point: Point & { angle: number }, step: number) {
    const other = driver.car;
    const oldX = other.x, oldY = other.y;
    other.x = point.x; other.y = point.y; other.angle = point.angle;
    other.body.setPosition(point.x, point.y).setRotation(point.angle);
    if (this.finished) return;
    const offsetX = this.player.x - point.x, offsetY = this.player.y - point.y;
    const gap = Math.hypot(offsetX, offsetY);
    if (gap <= 1 || gap >= 32) return;
    const nx = offsetX / gap, ny = offsetY / gap;
    const relative = (this.player.velocityX - (other.x - oldX) / Math.max(step, .004)) * nx
      + (this.player.velocityY - (other.y - oldY) / Math.max(step, .004)) * ny;
    if (relative < 0) {
      const impulse = Math.max(9, -relative * .78);
      this.player.velocityX += nx * impulse;
      this.player.velocityY += ny * impulse;
      this.collision(Math.abs(relative), this.player.x - nx * 11, this.player.y - ny * 11);
    }
    const push = Math.min(5, (32 - gap) * .44);
    const x = this.player.x + nx * push, y = this.player.y + ny * push;
    if (!this.inCollision(x, y)) { this.player.x = x; this.player.y = y; }
  }

  private updateRace(step: number, slip: number) {
    const route = this.route!;
    const target = this.waypoints[this.checkpoint];
    const last = this.waypoints[this.checkpoint - 1];
    const next = this.waypoints[this.checkpoint + 1];
    const direction = unit(last, target);
    const relativeX = this.player.x - target.x, relativeY = this.player.y - target.y;
    const forward = relativeX * direction.x + relativeY * direction.y;
    const lateral = relativeY * direction.x - relativeX * direction.y;
    const corner = next && (Math.abs(unit(target, next).x - direction.x) + Math.abs(unit(target, next).y - direction.y)) > .4;
    const accepted = corner ? Math.hypot(relativeX, relativeY) < 77 : forward > -13 && forward < 98 && Math.abs(lateral) < 86;
    const lapLength = this.waypoints[this.waypoints.length - 1].total;
    const progress = (this.lap - 1) * lapLength + last.total + clamp(target.length + forward, 0, target.length);
    this.position = 1 + this.rivals.filter(driver => driver.progress > progress + 5).length;
    if (this.mode === 'drift' && slip > .16 && Math.hypot(this.player.velocityX, this.player.velocityY) > 60 && ROADS.some(rect => contains(rect, this.player.x, this.player.y))) {
      this.drift += slip * step * 695;
    }
    if (this.elapsed > (this.mode === 'circuit' ? 145 : 99)) {
      this.position = this.rivals.length + 1;
      this.finish(false);
      return;
    }
    if (!accepted) return;
    bridge.emit('road-checkpoint', { checkpoint: this.checkpoint, lap: this.lap });
    if (next) { this.checkpoint++; return; }
    if (this.lap < route.laps) { this.lap++; this.checkpoint = 1; return; }
    if (this.mode === 'time') {
      const targetTime = RACES.time.target ?? 32;
      this.position = this.elapsed < targetTime ? 1 : this.elapsed < targetTime * 1.45 ? 2 : 3;
    }
    if (this.mode === 'drift') {
      const targetDrift = RACES.drift.target ?? 1150;
      this.position = this.drift >= targetDrift ? 1 : this.drift >= targetDrift * .41 ? 2 : 3;
    }
    this.finish(true);
  }

  private finish(completed: boolean) {
    this.completed = completed;
    this.finished = true;
    this.finishDelay = .42;
    this.cameras.main.flash(350, 244, 164, 111, false);
  }

  private reportResult() {
    bridge.emit('race-result', {
      mode: this.mode, position: this.position, total: this.route?.opponents ? this.route.opponents + 1 : 3,
      time: this.elapsed, damage: Math.round(this.damage), drift: Math.round(this.drift), distance: Math.round(this.travel), completed: this.completed,
    });
  }

  private updateZone(interacted: boolean) {
    const closest = ZONES.reduce((best, zone) => distance(this.player, zone) < distance(this.player, best) ? zone : best, ZONES[0]);
    this.nearest = distance(this.player, closest) < (closest.garage ? 92 : 71) ? closest : undefined;
    if (!interacted || !this.nearest || Math.hypot(this.player.velocityX, this.player.velocityY) > 105) return;
    if (this.nearest.garage) {
      bridge.emit('road-exit', { damage: Math.round(this.damage), distance: Math.round(this.travel), x: this.player.x, y: this.player.y, angle: Phaser.Math.RadToDeg(this.player.angle) });
    } else if (this.nearest.race) {
      bridge.emit('road-race', { mode: this.nearest.race });
    } else if (this.nearest.service) {
      bridge.emit('road-service', { service: this.nearest.service, zone: this.nearest.name });
    }
  }

  private drawMotion(step: number, slip: number, boost: boolean) {
    this.markClock -= step;
    if (this.markClock <= 0 && (slip > .14 || boost || this.damage > 47)) {
      const x = this.player.x - Math.cos(this.player.angle) * 22;
      const y = this.player.y - Math.sin(this.player.angle) * 22;
      const hot = boost && this.nitro > 0;
      const smoke = this.damage > 47 || slip > .14;
      const direction = this.player.angle + Math.PI;
      if (hot || smoke) {
        this.particles.push({ x, y, time: hot ? .21 : .49, size: hot ? 3 : this.random.integer(3, 7), color: hot ? 0x78dbf1 : 0xa1adb1,
          vx: Math.cos(direction) * (hot ? 97 : 30) + this.random.integer(-19, 19), vy: Math.sin(direction) * (hot ? 97 : 30) + this.random.integer(-17, 17) });
      }
      this.markClock = .034;
    }
    for (const particle of this.particles) {
      particle.time -= step; particle.x += particle.vx * step; particle.y += particle.vy * step;
    }
    this.particles = this.particles.filter(particle => particle.time > 0);
  }

  private drawWeather(step: number) {
    this.weather.clear();
    const view = this.cameras.main.worldView;
    const width = Math.max(750, view.width), height = Math.max(430, view.height);
    const rainCount = bridge.quality === 'low' ? 43 : this.rain.length;
    for (let index = 0; index < rainCount; index++) {
      const drop = this.rain[index];
      drop.y += drop.speed * step / height;
      drop.x += drop.speed * step * .16 / width;
      if (drop.y >= 1.04) { drop.y -= 1.07; drop.x = this.random.next(); }
      if (drop.x >= 1.03) drop.x -= 1.06;
      const x = view.x + drop.x * width, y = view.y + drop.y * height;
      this.weather.lineStyle(1, 0x9cb8c7, drop.alpha);
      this.weather.lineBetween(x, y, x + drop.height * .16, y + drop.height);
    }
    for (const particle of this.particles) {
      const alpha = clamp(particle.time * 1.8, .05, .8);
      this.weather.fillStyle(particle.color, alpha).fillRect(Math.round(particle.x), Math.round(particle.y), particle.size, particle.size);
    }
  }

  private drawRoute() {
    this.marks.clear();
    if (!this.route || this.finished) {
      if (this.nearest) {
        const pulse = .65 + Math.sin(this.modeClock * 4) * .28;
        const { x, y, accent } = this.nearest;
        this.marks.lineStyle(2, accent, pulse).strokeRoundedRect(x - 31, y - 18, 62, 36, 3);
        this.marks.fillStyle(accent, pulse).fillRect(x - 6, y - 26, 12, 3).fillRect(x - 2, y - 23, 4, 5);
      }
      return;
    }
    const point = this.waypoints[this.checkpoint];
    const last = this.waypoints[this.checkpoint - 1];
    const next = this.waypoints[this.checkpoint + 1];
    const incoming = unit(last, point);
    const outgoing = next ? unit(point, next) : incoming;
    const color = this.mode === 'drift' ? 0xdb9ff9 : 0xffac6e;
    const pulse = .6 + Math.sin(this.modeClock * 5.1) * .23;
    const paintArrow = (x: number, y: number, direction: Point, alpha: number, size = 1) => {
      const dx = direction.x, dy = direction.y, sx = -dy, sy = dx;
      this.marks.lineStyle(2, color, alpha);
      this.marks.beginPath();
      this.marks.moveTo(x - dx * 9 * size - sx * 11 * size, y - dy * 9 * size - sy * 11 * size);
      this.marks.lineTo(x + dx * 6 * size, y + dy * 6 * size);
      this.marks.lineTo(x - dx * 9 * size + sx * 11 * size, y - dy * 9 * size + sy * 11 * size);
      this.marks.strokePath();
    };
    const reach = Math.min(point.length - 10, Math.max(170, distance(this.player, point) - 100));
    for (let length = 95; length <= reach; length += 59) {
      paintArrow(point.x - incoming.x * length, point.y - incoming.y * length, incoming, .34, .84);
    }
    for (let index = 0; index < 3; index++) {
      const x = point.x + outgoing.x * (index * 17 + 4), y = point.y + outgoing.y * (index * 17 + 4);
      paintArrow(x, y, outgoing, pulse, 1.22);
    }
    const perpendicular = { x: -incoming.y, y: incoming.x };
    const final = !next && this.lap === this.route.laps;
    if (final) {
      for (let offset = -64; offset < 64; offset += 8) for (let row = 0; row < 3; row++) {
        if ((offset / 8 + row) % 2 === 0) continue;
        this.marks.fillStyle(0xffd4a1, .63).fillRect(point.x + perpendicular.x * offset + incoming.x * row * 8 - 4,
          point.y + perpendicular.y * offset + incoming.y * row * 8 - 4, 8, 8);
      }
    } else {
      for (const side of [-1, 1]) {
        const x = point.x + perpendicular.x * 62 * side, y = point.y + perpendicular.y * 62 * side;
        this.marks.fillStyle(color, pulse).fillRect(x - 3, y - 3, 6, 6);
        this.marks.lineStyle(1, color, .23).strokeCircle(x, y, 13);
      }
    }
    const view = this.cameras.main.worldView;
    if (distance(this.player, point) > 460 && view.width > 25) {
      const x = clamp(point.x, view.x + 40, view.right - 40), y = clamp(point.y, view.y + 52, view.bottom - 65);
      paintArrow(x, y, unit(this.player, point), pulse, 1.10);
    }
  }

  private neighborhood() {
    const p = this.player;
    if (p.x > 3040) return 'Puerto de Umbral';
    if (p.y > 1860 && p.x > 1475) return 'Montes del Este';
    if (p.y > 1470 && p.x < 870) return 'Barrio del Faro';
    if (p.y < 780 && p.x < 1480) return 'Distrito Industrial';
    if (p.y > 1440) return 'Bajo Puente';
    return 'Centro de Umbral';
  }

  private emitHud(throttle: number, slip: number) {
    const speed = Math.round(Math.hypot(this.player.velocityX, this.player.velocityY) * KMH_PER_PIXEL);
    const reverse = this.player.velocityX * Math.cos(this.player.angle) + this.player.velocityY * Math.sin(this.player.angle) < -3;
    const target = this.route ? this.waypoints[this.checkpoint] : this.nearest ?? ZONES[0];
    const next = this.waypoints[this.checkpoint + 1];
    const x = Math.round(this.player.x), y = Math.round(this.player.y), angle = Phaser.Math.RadToDeg(this.player.angle);
    bridge.emit('road-hud', {
      mode: this.mode, speed, nitro: Math.round(this.nitro), damage: Math.round(this.damage), time: this.elapsed,
      position: this.position, total: this.route?.opponents ? this.route.opponents + 1 : 1, lap: this.lap,
      laps: this.route?.laps ?? 0, checkpoint: this.completed ? this.waypoints.length - 1 : Math.max(0, this.checkpoint - 1),
      checkpoints: Math.max(0, this.waypoints.length - 1), countdown: this.countdown > 0 ? Math.min(3, Math.ceil(this.countdown)) : this.route && this.elapsed < .45 ? 'GO' : 0,
      zone: this.nearest?.name ?? this.neighborhood(),
      prompt: this.nearest ? speed > 66 ? 'Reduce la velocidad para interactuar' : this.nearest.garage ? 'Entrar al taller' : this.nearest.short : '',
      minimap: {
        width: WIDTH, height: HEIGHT, roads: ROADS, player: { x, y, angle }, rivals: [...this.rivals, ...this.traffic].map(driver => ({ x: driver.car.x, y: driver.car.y })),
        target: target ? { x: target.x, y: target.y } : undefined, next: next ? { x: next.x, y: next.y } : undefined, course: this.route?.points,
        zones: ZONES.map(zone => ({ x: zone.x, y: zone.y, name: zone.short, accent: zone.accent })),
      },
      x, y, angle, distance: Math.round(this.travel), drift: Math.round(this.drift), throttle, slip, gear: speed < 4 ? 0 : reverse ? -1 : Math.min(6, 1 + Math.floor(speed / 34)),
    });
  }
}
