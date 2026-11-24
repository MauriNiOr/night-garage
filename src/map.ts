import { cityMap } from './geography';

type Point = { x: number; y: number };
type Rect = Point & { width: number; height: number };

export type MapWorld = {
  width: number;
  height: number;
  roads: readonly Rect[];
  player: Point & { angle: number };
  rivals: readonly Point[];
  target?: Point;
  course?: readonly Point[];
};

export const CITY_LEGEND = [
  { name: 'Tu coche', color: '#f4faee' },
  { name: 'Taller', color: '#ff8b54' },
  { name: 'Carreras', color: '#ffa873' },
  { name: 'Servicios', color: '#87d3cc' },
  { name: 'Destino o control', color: '#f9d388' },
  { name: 'Tráfico y rivales', color: '#e7847d' },
] as const;

type Projection = {
  x: (x: number) => number;
  y: (y: number) => number;
  s: number;
};

type Base = { image: HTMLCanvasElement; roads: readonly Rect[]; key: string };
const bases = new WeakMap<HTMLCanvasElement, Base>();
const fallback: MapWorld = { ...cityMap, player: cityMap.garage, rivals: [] };

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

export function drawMap(canvas: HTMLCanvasElement, world: MapWorld = fallback, large = false): void {
  const bounds = canvas.getBoundingClientRect();
  if (canvas.isConnected && (!bounds.width || !bounds.height)) return;
  const width = Math.round(bounds.width || canvas.width || 150);
  const height = Math.round(bounds.height || canvas.height || 100);
  const ratio = bounds.width ? Math.min(canvas.ownerDocument.defaultView?.devicePixelRatio ?? 1, 2) : 1;
  const pixelWidth = Math.ceil(width * ratio);
  const pixelHeight = Math.ceil(height * ratio);
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  if (!canvas.hasAttribute('aria-label')) canvas.setAttribute('aria-label', 'Mapa de la ciudad');
  if (!canvas.hasAttribute('role')) canvas.setAttribute('role', 'img');

  const ctx = canvas.getContext('2d');
  if (!ctx || width < 10 || height < 10) return;
  const padding = large ? 12 : 5;
  const scale = Math.min((width - padding * 2) / world.width, (height - padding * 2) / world.height);
  if (!Number.isFinite(scale) || scale <= 0) return;
  const tx = (width - world.width * scale) / 2;
  const ty = (height - world.height * scale) / 2;
  const project: Projection = { s: scale, x: x => tx + x * scale, y: y => ty + y * scale };

  const key = `${width}/${height}/${ratio}/${world.width}/${world.height}/${large}`;
  let base = bases.get(canvas);
  if (!base || base.key !== key || base.roads !== world.roads) {
    const image = canvas.ownerDocument.createElement('canvas');
    image.width = pixelWidth;
    image.height = pixelHeight;
    const backdrop = image.getContext('2d');
    if (!backdrop) return;
    backdrop.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawBase(backdrop, width, height, world, project, large);
    base = { image, roads: world.roads, key };
    bases.set(canvas, base);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(base.image, 0, 0);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  if (world.course && world.course.length > 1) {
    ctx.beginPath();
    ctx.lineJoin = 'round';
    ctx.moveTo(project.x(world.course[0].x), project.y(world.course[0].y));
    for (const point of world.course.slice(1)) ctx.lineTo(project.x(point.x), project.y(point.y));
    ctx.strokeStyle = '#202638';
    ctx.lineWidth = large ? 5 : 2.8;
    ctx.stroke();
    ctx.strokeStyle = '#f89963';
    ctx.lineWidth = large ? 2.1 : 1.3;
    ctx.stroke();
  }
  if (large) drawLabels(ctx, width, height, project, world);

  if (world.target) {
    const x = project.x(world.target.x);
    const y = project.y(world.target.y);
    const radius = large ? 9 : 4.5;
    ctx.beginPath();
    ctx.strokeStyle = '#f4c775';
    ctx.lineWidth = 1.5;
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    diamond(ctx, x, y, large ? 4 : 2, '#ffe3aa');
  }

  for (const rival of world.rivals) {
    ctx.beginPath();
    ctx.fillStyle = '#e7847d';
    ctx.arc(project.x(rival.x), project.y(rival.y), large ? 2.6 : 1.55, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(project.x(world.player.x), project.y(world.player.y));
  ctx.rotate((world.player.angle || 0) * Math.PI / 180);
  const size = large ? 7 : 4;
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.67, size * 0.56);
  ctx.lineTo(-size * 0.33, 0);
  ctx.lineTo(-size * 0.67, -size * 0.56);
  ctx.closePath();
  ctx.strokeStyle = '#101b24';
  ctx.lineWidth = large ? 2.6 : 1.4;
  ctx.stroke();
  ctx.fillStyle = '#f4faee';
  ctx.fill();
  ctx.restore();
}

function drawBase(ctx: CanvasRenderingContext2D, width: number, height: number, world: MapWorld, p: Projection, large: boolean): void {
  ctx.fillStyle = '#101923';
  ctx.fillRect(0, 0, width, height);
  const grid = large ? 16 : 8;
  ctx.fillStyle = '#2633426b';
  for (let x = grid; x < width; x += grid) ctx.fillRect(x, 0, 1, height);
  for (let y = grid; y < height; y += grid) ctx.fillRect(0, y, width, 1);

  const shore = p.x(world.width * 3375 / 3660);
  ctx.fillStyle = '#12303c';
  ctx.fillRect(shore, p.y(0), p.x(world.width) - shore, world.height * p.s);
  ctx.fillStyle = '#456572';
  ctx.fillRect(shore, p.y(0), 1, world.height * p.s);
  ctx.fillStyle = '#3d545d';
  for (const y of [450, 850, 1400, 1900]) ctx.fillRect(shore, p.y(y), p.s * 240, Math.max(1, p.s * 70));

  const horizontal = world.roads.filter(road => road.width > road.height);
  const vertical = world.roads.filter(road => road.width <= road.height);
  ctx.fillStyle = '#1c2934';
  for (let col = 1; col < vertical.length; col++) {
    for (let row = 1; row < horizontal.length; row++) {
      const before = vertical[col - 1];
      const above = horizontal[row - 1];
      const left = before.x + before.width + 30;
      const top = above.y + above.height + 34;
      const width = vertical[col].x - left - 34;
      const height = horizontal[row].y - top - 37;
      if (width < 100 || height < 90) continue;
      ctx.fillStyle = (col === 3 && row === 2) || (col === 4 && row === 3) ? '#203c3c' : '#1c2934';
      ctx.fillRect(p.x(left), p.y(top), width * p.s, height * p.s);
      if (!large) continue;
      ctx.fillStyle = '#2d3a45';
      ctx.fillRect(p.x(left + width * .13), p.y(top + height * .18), width * .33 * p.s, height * .60 * p.s);
      ctx.fillRect(p.x(left + width * .57), p.y(top + height * .24), width * .31 * p.s, height * .51 * p.s);
    }
  }

  for (const [color, edge] of [['#111b24', 1.3], ['#4d5d68', 0]] as const) {
    ctx.fillStyle = color;
    for (const road of world.roads) {
      ctx.fillRect(p.x(road.x) - edge, p.y(road.y) - edge, road.width * p.s + edge * 2, road.height * p.s + edge * 2);
    }
  }

  if (large) {
    ctx.strokeStyle = '#84909a69';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    for (const road of horizontal) {
      ctx.moveTo(p.x(road.x), p.y(road.y + road.height / 2));
      ctx.lineTo(p.x(road.x + road.width), p.y(road.y + road.height / 2));
    }
    for (const road of vertical) {
      ctx.moveTo(p.x(road.x + road.width / 2), p.y(road.y));
      ctx.lineTo(p.x(road.x + road.width / 2), p.y(road.y + road.height));
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const zone of cityMap.zones) {
    if (!large && !zone.garage && !zone.race) continue;
    const x = p.x(zone.x), y = p.y(zone.y);
    if (zone.garage) {
      const size = large ? 5 : 2.8;
      ctx.beginPath();
      ctx.moveTo(x - size, y);
      ctx.lineTo(x, y - size);
      ctx.lineTo(x + size, y);
      ctx.lineTo(x + size, y + size);
      ctx.lineTo(x - size, y + size);
      ctx.closePath();
      ctx.fillStyle = '#ff8b54';
      ctx.fill();
    } else if (zone.race) diamond(ctx, x, y, large ? 3.7 : 1.8, '#ffa873');
    else {
      ctx.fillStyle = '#87d3cc';
      ctx.fillRect(x - 3, y - 3, 6, 6);
    }
  }

  ctx.font = `600 ${large ? 10 : 7}px "IBM Plex Mono", monospace`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#acc5cc';
  ctx.fillText('N', large ? 10 : 4, large ? 8 : 3);
}

function drawLabels(ctx: CanvasRenderingContext2D, width: number, height: number, p: Projection, { course, player, target }: MapWorld): void {
  const points = cityMap.zones.map(zone => ({ zone, x: p.x(zone.x), y: p.y(zone.y) }));
  const occupied: Rect[] = points.map(({ x, y }) => ({ x: x - 5, y: y - 5, width: 10, height: 10 }));
  occupied.push({ x: p.x(player.x) - 8, y: p.y(player.y) - 8, width: 16, height: 16 });
  if (target) occupied.push({ x: p.x(target.x) - 11, y: p.y(target.y) - 11, width: 22, height: 22 });
  const raceLine: Rect[] = [];
  for (let index = 1; course && index < course.length; index++) {
    const a = course[index - 1], b = course[index];
    raceLine.push({ x: p.x(Math.min(a.x, b.x)) - 3, y: p.y(Math.min(a.y, b.y)) - 3, width: Math.abs(a.x - b.x) * p.s + 6, height: Math.abs(a.y - b.y) * p.s + 6 });
  }

  const font = width >= 500 ? 11 : 9;
  ctx.font = `500 ${font}px "IBM Plex Mono", monospace`;
  ctx.textBaseline = 'middle';
  for (const { zone, x, y } of points) {
    const names = zone.garage || width >= 560 ? [zone.name, zone.short] : [zone.short];
    for (const text of names) {
      const labelWidth = Math.ceil(ctx.measureText(text).width) + 10;
      const labelHeight = font + 5;
      const alternatives = [
        { x: x + 8, y: y - labelHeight / 2 },
        { x: x - labelWidth - 8, y: y - labelHeight / 2 },
        { x: x - labelWidth / 2, y: y - labelHeight - 8 },
        { x: x - labelWidth / 2, y: y + 8 },
      ].map(position => ({ ...position, width: labelWidth, height: labelHeight }));
      const available = alternatives.filter(rect => rect.x >= 6 && rect.y >= 4 && rect.x + rect.width < width - 6 && rect.y + rect.height < height - 4 && !occupied.some(other => overlaps(rect, other)));
      const label = available.find(rect => !raceLine.some(segment => overlaps(rect, segment))) ?? available[0];
      if (!label) continue;
      occupied.push(label);
      ctx.fillStyle = '#111a25f5';
      ctx.fillRect(label.x, label.y, label.width, label.height);
      ctx.fillStyle = zone.garage ? '#ffc097' : '#d3e1e5';
      ctx.fillText(text, label.x + 5, label.y + label.height / 2 + 0.3);
      break;
    }
  }
}

function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
  ctx.beginPath();
  ctx.moveTo(x, y - radius);
  ctx.lineTo(x + radius, y);
  ctx.lineTo(x, y + radius);
  ctx.lineTo(x - radius, y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}
