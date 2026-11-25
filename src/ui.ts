import type { ComponentKey } from './catalog'

export const asset = (path: string) => new URL(import.meta.env.BASE_URL + path, document.baseURI).href

const paths: Record<string, string> = {
  play: '<path d="m9 5 12 7-12 7z"/>',
  wrench: '<path d="M14.7 6.3a5 5 0 0 0-6.4 6.4l-4.6 4.6a2 2 0 1 0 2.8 2.8l4.6-4.6a5 5 0 0 0 6.4-6.4l-3.5 3.5-2.8-2.8z"/>',
  settings: '<path d="M4 7h16M4 17h16M9 4v6m6 4v6"/>',
  folder: '<path d="M3 7h7l2 2h9v10H3z"/>',
  pause: '<path d="M9 5v14m6-14v14"/>',
  map: '<path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14m6-12v14"/>',
  bag: '<path d="M5 8h14l1 12H4zM9 9V6a3 3 0 0 1 6 0v3"/>',
  flag: '<path d="M5 21V4c5-4 9 3 15-1v12c-6 4-10-3-15 1"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  expand: '<path d="M9 3H3v6m12-6h6v6m0 6v6h-6m-6 0H3v-6"/>',
  sound: '<path d="M3 9h4l5-4v14l-5-4H3zm13 0a4 4 0 0 1 0 6m2-8a7 7 0 0 1 0 10"/>',
  mute: '<path d="M3 9h4l5-4v14l-5-4H3zm13 1 5 5m0-5-5 5"/>',
  dash: '<path d="M5 18a9 9 0 1 1 14 0M12 14l4-5M4 13h3m10 0h3M12 5v3"/>',
  lock: '<path d="M5 10h14v11H5zm3 0V7a4 4 0 1 1 8 0v3"/>',
  medal: '<circle cx="12" cy="15" r="5"/><path d="M9 11 5 3h5l2 4 2-4h5l-4 8"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  flash: '<path d="m13 2-9 12h7l-1 8 10-12h-8z"/>',
  back: '<path d="m13 5-7 7 7 7m-7-7h13"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  up: '<path d="m5 15 7-7 7 7"/>',
  down: '<path d="m5 9 7 7 7-7"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  wallet: '<path d="M20 8H5a2 2 0 0 1 0-4h13v4m3 1v11H5a2 2 0 0 1-2-2V6m18 5h-5a2 2 0 0 0 0 4h5"/>',
  gear: '<path d="M5 4v4m7-4v16m7-16v4M5 8h14M5 16h14m-14 4v-4m14 4v-4"/>',
  location: '<path d="M19 10c0 5-7 10-7 10s-7-5-7-10a7 7 0 0 1 14 0z"/><circle cx="12" cy="10" r="2"/>',
  route: '<circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 18h10a3 3 0 0 0 0-6H7a3 3 0 0 1 0-6h10"/>',
  trophy: '<path d="M8 4h8v6a4 4 0 0 1-8 0zm0 2H4v3a3 3 0 0 0 3 3h1m8-6h4v3a3 3 0 0 1-3 3h-1m-4 2v5m-4 1h8"/>',
  box: '<path d="m3 7 9-4 9 4v10l-9 4-9-4zm0 0 9 4 9-4m-9 4v10M8 5l9 4v4"/>',
  fuel: '<path d="M3 21h12m-10 0V3h8v18M5 7h8m0 5h2a2 2 0 0 1 2 2v3a2 2 0 0 0 4 0v-6l-4-4m4 4h-2V9"/>',
  car: '<path d="M5 17v2m14-2v2M3 17h18v-5l-2-2-2-5H7l-2 5-2 2zM5 10h14M6 14h2m8 0h2"/>',
  warning: '<path d="M12 3 2 20h20zM12 9v5m0 3h.01"/>',
  battery: '<rect x="3" y="7" width="18" height="12" rx="1"/><path d="M6 7V4m12 3V4M6 13h4m6-2v4m-2-2h4"/>',
  tire: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.1"/><path d="M12 7v4m1 2 3 2m-5-2-3 2"/>',
  engine: '<path d="M4 8h3l2-2h6v3h3v3h3v6h-4l-2-2H7l-3-3zm0 3H2m0-3v6m10-8V3M9 3h6"/>',
  paint: '<path d="m4 20 8-8m1-1 3-6 4-2 1 4-3 5-6 2M7 17l-1-3 4-4 4 4-4 4z"/>',
  desktop: '<rect x="3" y="4" width="18" height="13" rx="1"/><path d="M12 17v4m-4 0h8"/>',
  garage: '<path d="M3 21V8l9-5 9 5v13M6 21V10h12v11M6 14h12M6 17h12m-15 4h18"/>',
  light: '<path d="M8 17h8m-7 4h6M9 17v-2a6 6 0 1 1 6 0v2"/>',
  keyboard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M5 9h1m3 0h1m3 0h1m3 0h2m-14 3h1m3 0h1m3 0h1m3 0h2M8 15h8"/>',
  gamepad: '<path d="M8 7h8a4 4 0 0 1 4 3l1 6a2 2 0 0 1-3 2l-4-3h-4l-4 3a2 2 0 0 1-3-2l1-6a4 4 0 0 1 4-3zm-2 4h4m-2-2v4m8-2h.01m2 2h.01"/>',
  hand: '<path d="M7 12V5a1.5 1.5 0 1 1 3 0v6-8a1.5 1.5 0 1 1 3 0v8-6a1.5 1.5 0 1 1 3 0v7-3a1.5 1.5 0 1 1 3 0v6a6 6 0 0 1-6 6h-2a5 5 0 0 1-4-2l-4-5a1.6 1.6 0 0 1 2-2l2 2"/>',
  spark: '<path d="M12 2v7m0 6v7M2 12h7m6 0h7M5 5l4 4m6 6 4 4m0-14-4 4m-6 6-4 4"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  move: '<path d="M12 2v20M2 12h20M9 5l3-3 3 3m-6 14 3 3 3-3m4-4 3-3-3-3M5 9l-3 3 3 3"/>',
  exit: '<path d="M11 4H5v16h6m3-12 4 4-4 4m4-4H9"/>',
  drop: '<path d="M12 3c-3 5-7 8-7 12a7 7 0 0 0 14 0c0-4-4-7-7-12zM8 15c0 2 2 3 3 3"/>',
  weight: '<path d="M8 9h8l3 11H5zm2 0V6a2 2 0 0 1 4 0v3"/>',
}
export function icon(name: string, size = 20) {
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] ?? paths.wrench) + '</svg>'
}

export const componentIcon: Record<ComponentKey, string> = {
  tires:'tire', engine:'engine', oil:'drop', battery:'battery', brakes:'tire',
  suspension:'settings', turbo:'dash', body:'car', paint:'paint', gearbox:'gear',
}

const statIcons: Record<string, string> = {
  'Reputación':'medal', 'Experiencia':'spark', 'Carreras':'flag', 'Victorias':'trophy', 'Reparaciones':'wrench',
  'Kilómetros':'route', 'Km':'route', 'Ingresos':'wallet', 'Gastos':'wallet', 'Colección':'car', 'Caja':'wallet',
  'Potencia':'engine', 'Tracción':'gear', 'Nivel':'layers', 'Premio':'trophy', 'Premio máximo':'trophy', 'Pieza':'box',
  'Depósito':'fuel', 'Hasta lleno':'wallet', 'Inscripción':'wallet', 'Crono':'clock', 'Daños':'warning', 'Derrape':'dash',
  'Saldo':'wallet', 'Peso':'weight', 'Velocidad':'dash', '0–100':'clock', 'Valor':'wallet',
}

export function statIcon(label: string) {
  return icon(statIcons[label] ?? 'dash', 16)
}

export function conditionGauge(value: number, label: string) {
  const score = Math.round(value)
  const state = score < 35 ? 'critical' : score < 65 ? 'worn' : 'healthy'
  return '<span class="part-meter ' + state + '"><meter min="0" max="100" value="' + score + '" aria-label="' + safe(label) + '"></meter><b>' + score + ' %</b></span>'
}

export const safe = (value: unknown) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character] ?? character)

export const euro = (value: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
export const number = (value: number) => new Intl.NumberFormat('es-ES').format(value)
export const rgb = (value: number) => '#' + value.toString(16).padStart(6, '0')
export const time = (seconds: number) => {
  const hundredths = Math.floor(Math.max(0, seconds) * 100)
  const minutes = Math.floor(hundredths / 6000)
  return String(minutes).padStart(2, '0') + ':' + String(Math.floor(hundredths / 100) % 60).padStart(2, '0') + '.' + String(hundredths % 100).padStart(2, '0')
}

export function button(text: string, action: string, opts: { kind?: string; icon?: string; disabled?: boolean; title?: string } = {}) {
  return '<button class="button ' + (opts.kind ?? 'secondary') + '" data-action="' + safe(action) + '"' +
    (opts.disabled ? ' disabled' : '') + (opts.title ? ' title="' + safe(opts.title) + '"' : '') + '>' +
    (opts.icon ? icon(opts.icon) : '') + '<span>' + safe(text) + '</span></button>'
}

export function carImage(model: number, color: number, mods?: Record<string, number>) {
  const suffix = String(model).padStart(2, '0') + '.png'
  const sprite = asset('art/car-' + suffix)
  const mask = asset('art/car-mask-' + suffix)
  return '<div class="car-portrait" style="--car-color:' + rgb(color) + ';--mask:url(&quot;' + mask + '&quot;)"><img src="' + sprite +
    '" alt="" draggable="false"><i class="car-mask"></i>' +
    (mods?.neon ? '<i class="car-neon"></i>' : '') + (mods?.vinyl ? '<i class="car-vinyl"></i>' : '') +
    (mods?.wing ? '<i class="car-wing"></i>' : '') + (mods?.rims ? '<i class="car-rims"></i>' : '') +
    (mods?.bumper ? '<i class="car-bumper"></i>' : '') + (mods?.exhaust ? '<i class="car-exhaust"></i>' : '') +
    (mods?.ride ? '<i class="car-ride"></i>' : '') + '</div>'
}
