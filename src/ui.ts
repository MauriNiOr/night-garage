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
}
export function icon(name: string, size = 20) {
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] ?? paths.wrench) + '</svg>'
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
