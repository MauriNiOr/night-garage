import Phaser from 'phaser'
import { bridge } from './bridge'

type StationId = 'lift' | 'tools' | 'pc' | 'parts' | 'paint' | 'engine' | 'parking' | 'diagnostic' | 'exit'
type Point = { x: number; y: number }
type CarStyle = { wheels?: number; height?: number; spoiler?: number; bumper?: number; vinyl?: number; underglow?: number; exhaust?: number }
type GarageData = { spawn?: Point; level?: number; color?: number; model?: number; target?: StationId; style?: CarStyle }
type Fixture = Point & { id: StationId; label: string; radius: number; markerOffset?: number }
type Particle = Point & { dx: number; dy: number; life: number; initialLife: number; color: number }

const stations: Fixture[] = [
  { id: 'pc', label: 'Oficina', x: 135, y: 177, radius: 41, markerOffset: 27 },
  { id: 'tools', label: 'Banco de herramientas', x: 219, y: 241, radius: 43 },
  { id: 'lift', label: 'Elevador', x: 548, y: 229, radius: 52 },
  { id: 'parts', label: 'Almacén de componentes', x: 803, y: 173, radius: 48 },
  { id: 'paint', label: 'Cabina de pintura', x: 800, y: 296, radius: 52 },
  { id: 'engine', label: 'Banco de motores', x: 268, y: 340, radius: 51 },
  { id: 'parking', label: 'Aparcamiento', x: 617, y: 352, radius: 67, markerOffset: 9 },
  { id: 'diagnostic', label: 'Diagnóstico', x: 506, y: 326, radius: 45 },
  { id: 'exit', label: 'Salida a la ciudad', x: 490, y: 459, radius: 45 },
]

const stationSymbols: Record<StationId, string[]> = {
  pc: ['111111111', '100000001', '101010101', '100000001', '111111111', '000010000', '001111100'],
  tools: ['001100010', '000100111', '000101110', '000111100', '001110000', '011100000', '111000000'],
  lift: ['100010001', '100111001', '100010001', '100010001', '100000001', '111111111', '100000001'],
  parts: ['001111100', '010010010', '111111111', '100010001', '100010001', '010010010', '001111100'],
  paint: ['000010000', '000111000', '001111100', '011011110', '011011110', '011111110', '001111100'],
  engine: ['001111100', '000010000', '101111101', '111000111', '101101101', '001111100', '000111000'],
  parking: ['001111100', '010000010', '111111111', '110000011', '111111111', '100000001', '100000001'],
  diagnostic: ['000010000', '000010000', '000101000', '110101011', '001001100', '001001000', '000001000'],
  exit: ['111100000', '100100100', '100100010', '100101111', '100100010', '100100100', '111100000'],
}

const obstacles = [
  [37, 68, 88, 81],
  [72, 98, 124, 109],
  [247, 91, 301, 105],
  [371, 64, 434, 79],
  [399, 107, 431, 126],
  [103, 148, 135, 160],
  [287, 151, 330, 166],
  [235, 145, 250, 153],
  [54, 174, 84, 186],
].map(([left, top, right, bottom]) => new Phaser.Geom.Rectangle(left * 2 - 7, top * 2 - 5, (right - left) * 2 + 14, (bottom - top) * 2 + 9))

const colors = ['#f89d53', '#39bdba', '#ef4967', '#8c9ef4', '#e8c28c']
const modelKey = (index: number) => String(index).padStart(2, '0')
const seed = (x: number, y: number) => {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return value - Math.floor(value)
}

function block(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

function shape(ctx: CanvasRenderingContext2D, color: string, ...points: number[]) {
  ctx.beginPath()
  ctx.moveTo(points[0], points[1])
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1])
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string) {
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x0 + .5, y0 + .5)
  ctx.lineTo(x1 + .5, y1 + .5)
  ctx.stroke()
}

function aura(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(rx, ry)
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
  gradient.addColorStop(0, color)
  gradient.addColorStop(1, 'transparent')
  ctx.fillStyle = gradient
  ctx.fillRect(-1, -1, 2, 2)
  ctx.restore()
}

function stripes(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  block(ctx, x, y, w, h, '#1b171e')
  for (let i = 0; i < w - h; i += 7) {
    shape(ctx, '#a54253', x + i, y + h, x + i + h, y, x + i + h + 4, y, x + i + 4, y + h)
  }
}

function sign(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size = 7) {
  ctx.font = `bold ${size}px monospace`
  ctx.textBaseline = 'top'
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
}

function crate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, tone = 0) {
  const top = ['#745341', '#465257', '#5c3d41'][tone]
  const front = ['#503833', '#323b42', '#402d36'][tone]
  block(ctx, x - 1, y + 1, w + 3, h + 3, '#121822')
  block(ctx, x, y, w, h, front)
  shape(ctx, top, x, y, x + 3, y - 3, x + w + 2, y - 3, x + w, y)
  block(ctx, x + 1, y + 1, w - 2, 1, top)
  block(ctx, x + 2, y + 3, 1, h - 4, top)
  block(ctx, x + w - 3, y + 3, 1, h - 4, top)
  block(ctx, x + Math.floor(w / 2) - 2, y + 3, 4, 2, '#a28767')
  block(ctx, x + 3, y + h - 2, w - 6, 1, '#27252b')
}

function cabinet(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, red = false) {
  const face = red ? '#793548' : '#404b56'
  const top = red ? '#ac5060' : '#61717b'
  shape(ctx, '#10151e', x - 2, y + h, x + w + 9, y + h, x + w + 13, y + h + 7, x + 2, y + h + 7)
  shape(ctx, top, x, y, x + 5, y - 5, x + w + 6, y - 5, x + w, y)
  shape(ctx, '#252d39', x + w, y, x + w + 6, y - 5, x + w + 6, y + h - 4, x + w, y + h)
  block(ctx, x, y, w, h, face)
  block(ctx, x, y, w, 1, top)
  block(ctx, x + 1, y + 2, 1, h - 4, top)
  block(ctx, x + w - 2, y + 2, 1, h - 3, '#202431')
  for (let i = y + 4; i < y + h - 2; i += 5) {
    block(ctx, x + 3, i, w - 6, 1, '#232630')
    block(ctx, x + (w >> 1) - 4, i + 1, 8, 1, '#9e9695')
  }
  block(ctx, x + 3, y + h, 3, 3, '#131924')
  block(ctx, x + w - 6, y + h, 3, 3, '#131924')
}

function lamp(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, red = false) {
  const light = red ? '#ff6576' : '#c6e5f1'
  block(ctx, x - 2, y - 3, width + 4, 6, '#141820')
  block(ctx, x, y - 2, width, 4, red ? '#953649' : '#698b9f')
  block(ctx, x + 1, y - 1, width - 2, 2, light)
  block(ctx, x + 2, y - 1, width - 4, 1, red ? '#ffc9cf' : '#f4faff')
  aura(ctx, x + width / 2, y + 4, width * 1.15, width * .7, red ? '#fb29444a' : '#b0dcff36')
}

function windowBay(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cityId: number) {
  block(ctx, x - 3, y - 3, w + 6, h + 6, '#111823')
  block(ctx, x - 1, y - 1, w + 2, h + 1, '#657078')
  block(ctx, x, y, w, h, '#1f3346')
  for (let col = -2; col < w; col += 9) {
    const buildingH = 7 + Math.floor(seed(cityId + col, 19) * (h - 7))
    const buildingW = Math.min(7, w - col)
    block(ctx, Math.max(x, x + col), y + h - buildingH, buildingW, buildingH, col % 2 === 0 ? '#182333' : '#243141')
    for (let py = h - buildingH + 2; py < h - 1; py += 3) {
      for (let px = Math.max(0, col + 1); px < Math.min(w, col + 6); px += 3) {
        if (seed(px, py + cityId) > .69) block(ctx, x + px, y + py, 1, 1, px % 3 === 1 ? '#fa7186' : '#75a0ae')
      }
    }
  }
  for (let i = 1; i < w; i += 3) {
    const py = Math.floor(seed(i, cityId) * h)
    block(ctx, x + i, y + py, 1, Math.min(h - py, 2 + i % 3), '#8dbbd52b')
  }
  for (let i = 0; i < w; i += 15) {
    block(ctx, x + i, y, 1, h, '#111c29')
    block(ctx, x + i + 1, y, 1, h, '#536274')
  }
  block(ctx, x, y + Math.floor(h / 2), w, 1, '#111c29')
  block(ctx, x - 2, y + h, w + 4, 2, '#526476')
}

function drawStructure(ctx: CanvasRenderingContext2D, level: number) {
  block(ctx, 0, 0, 480, 270, '#0c0a12')
  const city = ctx.createLinearGradient(0, 0, 0, 43)
  city.addColorStop(0, '#13121e')
  city.addColorStop(1, '#463146')
  ctx.fillStyle = city
  ctx.fillRect(0, 0, 480, 37)
  for (let x = -4; x < 480; x += 13) {
    const h = 3 + Math.round(seed(x, 71) * 22)
    block(ctx, x, 32 - h, 10, h + 8, x % 2 === 0 ? '#172133' : '#19263a')
    for (let y = 32 - h + 3; y < 30; y += 4) {
      for (let dx = 2; dx < 9; dx += 3) {
        if (seed(x + dx, y) > .76) block(ctx, x + dx, y, 1, 1, x % 2 === 0 ? '#e66377' : '#abaeca')
      }
    }
  }
  for (let k = 0; k < 3; k++) line(ctx, 0, 10 + k * 4, 479, 20 - k * 2, '#101a28')
  shape(ctx, '#111825', 15, 33, 464, 33, 479, 64, 0, 64)
  block(ctx, 17, 35, 446, 3, '#55404c')
  block(ctx, 17, 38, 446, 18, '#25212c')
  block(ctx, 16, 55, 450, 2, '#657078')

  const wall = ctx.createLinearGradient(0, 43, 0, 94)
  wall.addColorStop(0, level > 2 ? '#4b3d4a' : '#433744')
  wall.addColorStop(1, '#32313c')
  ctx.fillStyle = wall
  ctx.fillRect(23, 46, 434, 44)
  for (let y = 46; y < 90; y += 5) {
    block(ctx, 23, y, 434, 1, '#252732')
    for (let x = 23 + (y % 2) * 6; x < 457; x += 12) {
      block(ctx, x, y + 1, 1, 4, '#292730')
      if (seed(x, y) > .7) block(ctx, x + 1, y + 1, 9, 1, '#5f4f4e66')
    }
  }
  block(ctx, 22, 83, 437, 3, '#3d4b58')
  block(ctx, 23, 86, 434, 5, '#151d29')
  block(ctx, 23, 92, 434, 1, '#47525b')

  shape(ctx, '#212832', 23, 58, 34, 83, 34, 233, 12, 246, 8, 112, 13, 75)
  shape(ctx, '#202633', 456, 58, 446, 83, 446, 233, 468, 246, 473, 107, 466, 76)
  for (let y = 87; y < 245; y += 8) {
    line(ctx, 11, y + 3, 33, y, '#171e28')
    line(ctx, 447, y, 470, y + 3, '#171e28')
    if ((y & 8) === 0) {
      block(ctx, 19, y + 1, 1, 5, '#141d29')
      block(ctx, 459, y + 1, 1, 5, '#141d29')
    }
  }
  block(ctx, 29, 85, 4, 150, '#37434e')
  block(ctx, 447, 85, 4, 150, '#37434e')
  block(ctx, 29, 85, 1, 150, '#4d5b62')
  block(ctx, 450, 85, 1, 150, '#4d5b62')

  windowBay(ctx, 105, 48, 71, 26, 30)
  windowBay(ctx, 302, 48, 62, 26, 71)
  aura(ctx, 240, 57, 97, 29, '#f52d5253')
  shape(ctx, '#160d17', 197, 44, 285, 44, 291, 51, 291, 66, 284, 73, 191, 73, 191, 51)
  line(ctx, 197, 45, 284, 45, '#bb3a50')
  line(ctx, 192, 51, 192, 64, '#c03c52')
  line(ctx, 289, 51, 289, 64, '#c03c52')
  line(ctx, 198, 70, 282, 70, '#762838')
  aura(ctx, 240, 57, 52, 15, '#f62d5769')
  sign(ctx, 'NIGHT GARAGE', 200, 51, '#fa3855', 11)
  sign(ctx, 'NIGHT GARAGE', 200, 50, '#ffd5d9', 11)
  shape(ctx, '#ee4861', 233, 66, 236, 62, 239, 62, 236, 66)
  shape(ctx, '#ee4861', 240, 66, 243, 62, 246, 62, 243, 66)
  for (const x of [94, 184, 291, 366]) {
    block(ctx, x, 41, 2, 46, '#101821')
    block(ctx, x + 2, 41, 1, 46, '#5a4b48')
    block(ctx, x - 1, 50, 5, 1, '#807479')
  }

  const floor = ctx.createLinearGradient(0, 83, 0, 242)
  floor.addColorStop(0, '#38343f')
  floor.addColorStop(.56, level >= 3 ? '#42404c' : '#3e3b46')
  floor.addColorStop(1, '#2f303a')
  ctx.fillStyle = floor
  ctx.fillRect(34, 88, 412, 151)
  for (let x = 41; x < 449; x += 33) {
    const back = 240 + Math.round((x - 240) * .88)
    line(ctx, back, 88, x, 239, '#1f2531')
    line(ctx, back + 1, 88, x + 1, 239, '#6166753a')
  }
  for (const y of [94, 115, 140, 170, 207, 237]) {
    block(ctx, 34, y, 412, 1, '#202631')
    block(ctx, 34, y + 1, 412, 1, '#4a4e58')
  }
  for (let x = 34; x < 446; x += 2) {
    for (let y = 90; y < 238; y += 2) {
      const n = seed(x, y)
      if (n > .83) block(ctx, x, y, n > .97 ? 3 : 1, 1, n > .93 ? '#72808b32' : '#13172440')
    }
  }
  for (const [x, y, rx, ry] of [[87, 114, 41, 24], [263, 110, 67, 23], [409, 137, 49, 28], [280, 198, 149, 35]]) {
    aura(ctx, x, y, rx, ry, y < 120 ? '#c1d7ed34' : '#a4c6ed28')
  }
  aura(ctx, 406, 83, 63, 47, '#ff2e514f')
  aura(ctx, 243, 223, 93, 36, '#1894b332')
  aura(ctx, 90, 111, 65, 42, '#df335442')
  aura(ctx, 407, 148, 71, 45, '#ee426432')
  aura(ctx, 240, 143, 115, 46, '#ff305632')

  for (let i = 0; i < 52; i++) {
    const x = 42 + Math.floor(seed(i, 150) * 393), y = 96 + Math.floor(seed(i, 32) * 135)
    block(ctx, x, y, 1 + Math.round(seed(i, 31) * 8), 1, '#e5c19d14')
  }
  for (const [x, y, w, h] of [[224, 196, 46, 23], [145, 146, 34, 11], [344, 194, 43, 12], [206, 117, 21, 9]]) {
    shape(ctx, '#54304770', x, y + h, x + 5, y + 1, x + w - 7, y, x + w, y + h - 7, x + w - 2, y + h)
    for (let i = 0; i < 8; i++) {
      const dy = Math.round(seed(i, y) * (h - 3))
      const dx = Math.round(seed(i, x) * (w - 17))
      block(ctx, x + 6 + dx, y + 2 + dy, 4 + i % 5, 1, i % 3 === 0 ? '#f8728f68' : '#a1b7d038')
    }
  }
  for (const [x, y] of [[29, 108], [450, 108]]) {
    block(ctx, x - 2, y - 5, 5, 103, '#17121e')
    block(ctx, x, y, 1, 94, '#ff607e')
    block(ctx, x - 1, y + 2, 1, 90, '#8b314f')
    aura(ctx, x, y + 43, 48, 74, '#ef244b44')
    for (let i = 0; i < 4; i++) block(ctx, x - 3, y + 12 + i * 24, 6, 2, '#2b2431')
  }

  // Steel channels drain the rainwater that pools near the entrance.
  block(ctx, 38, 217, 404, 5, '#1f2936')
  block(ctx, 38, 221, 404, 1, '#62707b')
  for (let x = 41; x < 440; x += 4) block(ctx, x, 218, 1, 3, '#56616d')
  block(ctx, 38, 217, 404, 1, '#74818a52')
  for (const x of [192, 282]) {
    for (let y = 184; y < 214; y += 9) block(ctx, x, y, 2, 5, '#db647662')
  }
  for (const y of [204, 214, 225]) {
    shape(ctx, '#bd5d7180', 232, y - 3, 239, y, 246, y - 3, 246, y, 239, y + 3, 232, y)
  }
  for (const [x, y] of [[157, 105], [180, 185], [116, 210], [366, 175], [390, 113], [203, 155]]) {
    line(ctx, x, y, x + 5, y + 3, '#151c294f')
    line(ctx, x + 5, y + 3, x + 12, y + 3, '#151c294f')
    line(ctx, x + 12, y + 3, x + 16, y + 7, '#151c294f')
  }

  // The cutaway front wall leaves the roller door and wet curb visible.
  block(ctx, 0, 243, 480, 27, '#17212e')
  for (let i = 0; i < 130; i++) {
    const x = Math.floor(seed(i, 42) * 480), y = 246 + Math.floor(seed(i, 92) * 24)
    block(ctx, x, y, 1 + i % 8, 1, i % 3 ? '#6885a32c' : '#53b8bf36')
  }
  shape(ctx, '#292e3b', 25, 235, 194, 235, 182, 248, 8, 248)
  shape(ctx, '#292e3b', 287, 235, 454, 235, 476, 248, 301, 248)
  block(ctx, 26, 236, 168, 2, '#6c6366')
  block(ctx, 287, 236, 169, 2, '#6c6366')
  block(ctx, 12, 246, 170, 3, '#111a26')
  block(ctx, 301, 246, 169, 3, '#111a26')
  for (const x of [32, 52, 72, 92, 112, 132, 152, 172, 310, 330, 350, 370, 390, 410, 430, 450]) {
    block(ctx, x, 240, 1, 5, '#151d29')
  }
  stripes(ctx, 199, 227, 82, 5)
  block(ctx, 189, 237, 7, 14, '#141c26')
  block(ctx, 290, 237, 7, 14, '#141c26')
  block(ctx, 191, 237, 2, 12, '#7b6d65')
  block(ctx, 292, 237, 2, 12, '#7b6d65')
  for (const x of [191, 291]) {
    block(ctx, x, 236, 3, 2, '#ff5a77')
    aura(ctx, x, 244, 25, 18, '#f2376268')
  }
}

function drawOffice(ctx: CanvasRenderingContext2D, level: number) {
  shape(ctx, '#171d2866', 41, 64, 96, 64, 103, 84, 41, 90)
  block(ctx, 39, 74, 48, 4, '#3c2e31')
  block(ctx, 40, 67, 47, 9, '#75604b')
  shape(ctx, '#a47f61', 40, 67, 48, 62, 93, 62, 87, 67)
  shape(ctx, '#423439', 87, 67, 93, 62, 93, 72, 87, 77)
  block(ctx, 42, 75, 3, 7, '#232532')
  block(ctx, 83, 74, 3, 7, '#232532')
  block(ctx, 58, 58, 13, 11, '#232c39')
  block(ctx, 59, 59, 11, 8, level > 2 ? '#5fb6a9' : '#577879')
  block(ctx, 60, 60, 8, 1, '#99d0b8')
  block(ctx, 61, 62, 6, 1, '#89bfab')
  block(ctx, 62, 64, 7, 1, '#89bfab')
  block(ctx, 63, 68, 3, 3, '#333a44')
  block(ctx, 60, 71, 9, 2, '#242835')
  block(ctx, 77, 64, 8, 5, '#cdbd9c')
  block(ctx, 78, 65, 5, 1, '#9b8271')
  block(ctx, 78, 67, 4, 1, '#9b8271')
  block(ctx, 47, 65, 4, 4, '#bc5546')
  block(ctx, 50, 66, 2, 2, '#e3a670')
  block(ctx, 53, 84, 9, 6, '#1b2431')
  block(ctx, 54, 82, 7, 5, '#675259')
  block(ctx, 55, 82, 5, 2, '#9c6e64')
  block(ctx, 57, 88, 2, 4, '#4e535d')
  block(ctx, 54, 92, 8, 1, '#141923')
  aura(ctx, 63, 68, 19, 13, '#65e0d72e')
}

function drawWorkbenches(ctx: CanvasRenderingContext2D, level: number) {
  shape(ctx, '#131925', 72, 96, 132, 96, 132, 111, 72, 116)
  block(ctx, 75, 88, 49, 14, '#292e39')
  block(ctx, 76, 89, 47, 12, '#53484b')
  for (let x = 78; x < 122; x += 3) {
    for (let y = 91; y < 100; y += 3) block(ctx, x, y, 1, 1, '#75645e')
  }
  block(ctx, 80, 91, 2, 8, '#a49b89')
  block(ctx, 79, 90, 4, 2, '#c4a77f')
  block(ctx, 86, 93, 2, 7, '#ba9b67')
  block(ctx, 85, 92, 4, 2, '#aab1b2')
  line(ctx, 91, 99, 97, 91, '#a4abad')
  block(ctx, 91, 98, 3, 2, '#b35f47')
  block(ctx, 99, 94, 6, 2, '#9dadad')
  block(ctx, 100, 92, 2, 5, '#b4875f')
  for (let x = 108; x < 122; x += 4) {
    block(ctx, x, 93 + x % 3, 2, 5, '#a77050')
    block(ctx, x, 90, 1, 5, '#b6afa1')
  }
  cabinet(ctx, 72, 103, 52, 7, true)
  block(ctx, 73, 102, 52, 2, '#98715b')
  cabinet(ctx, 53, 174, 25, 12, false)
  block(ctx, 66, 168, 9, 5, '#495462')
  block(ctx, 68, 166, 5, 2, '#97928a')
  crate(ctx, 45, 183, 17, 8, 0)
  crate(ctx, 61, 187, 11, 7, 1)
  crate(ctx, 32, 157, 16, 8, 1)
  for (let i = 0; i < 3; i++) {
    const x = 37 + i * 5
    const y = 153 - i % 2 * 3
    block(ctx, x, y, 4, 8, '#2c6069')
    block(ctx, x + 1, y - 1, 2, 1, '#afb3a5')
    block(ctx, x + 1, y + 3, 3, 2, '#77898c')
  }
  cabinet(ctx, 103, 150, 31, 12, level < 2)
  const engineTone = level > 3 ? '#8eb8b4' : '#a3a098'
  const engine = ['..######......', '.##########...', '############..', '##############', '..###########.', '..##########..', '...##....##...']
  engine.forEach((row, dy) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] === '#') block(ctx, 114 + i, 142 + dy, 1, 1, (i + dy) % 4 === 0 ? '#585861' : engineTone)
    }
  })
  block(ctx, 116, 143, 4, 2, '#b9714d')
  block(ctx, 120, 147, 9, 1, '#303e48')
  block(ctx, 125, 142, 3, 3, '#664647')
  block(ctx, 114, 148, 4, 2, '#424955')
  line(ctx, 103, 154, 101, 165, '#ad7a56')
  line(ctx, 101, 165, 95, 163, '#ad7a56')
  lamp(ctx, 80, 86, 40, level < 2)
}

function drawLift(ctx: CanvasRenderingContext2D, level: number) {
  const post = level > 1 ? '#903b5b' : '#643448'
  const postEdge = level > 1 ? '#ed6583' : '#bf7487'
  shape(ctx, '#141d29', 234, 85, 315, 85, 329, 114, 230, 114)
  shape(ctx, '#3e4650', 239, 89, 311, 89, 320, 111, 235, 111)
  for (let x = 243; x < 318; x += 6) line(ctx, x - 3, 109, x, 92, '#293442')
  block(ctx, 240, 98, 76, 4, '#202a35')
  block(ctx, 247, 95, 59, 2, '#929887')
  block(ctx, 245, 102, 67, 2, '#7c8887')
  block(ctx, 260, 98, 28, 2, '#69727c')
  stripes(ctx, 235, 110, 85, 3)
  for (const x of [238, 312]) {
    block(ctx, x - 2, 106, 12, 4, '#1b2632')
    block(ctx, x, 75, 7, 34, post)
    block(ctx, x, 75, 6, 2, postEdge)
    block(ctx, x + 1, 78, 2, 26, '#302333')
    block(ctx, x + 4, 79, 1, 27, postEdge)
    block(ctx, x + 2, 102, 6, 3, '#cc5970')
    block(ctx, x + 5, 86, 3, 9, '#1f303e')
    block(ctx, x + 6, 87, 1, 2, '#eaa858')
    block(ctx, x + 6, 91, 1, 1, '#55b5a6')
    line(ctx, x + 2, 75, x + 2, 72, '#343d45')
  }
  block(ctx, 238, 73, 80, 2, '#475460')
  lamp(ctx, 250, 75, 57)
}

function drawParts(ctx: CanvasRenderingContext2D, level: number) {
  block(ctx, 372, 59, 67, 24, '#17212a')
  block(ctx, 371, 56, 2, 30, '#777d78')
  block(ctx, 436, 56, 2, 30, '#777d78')
  block(ctx, 371, 58, 67, 1, '#837767')
  block(ctx, 372, 70, 65, 2, '#594d4a')
  block(ctx, 372, 81, 65, 2, '#594d4a')
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < (level === 1 ? 4 : 5); i++) {
      const x = 375 + i * 12
      crate(ctx, x, 62 + row * 11, 7 + i % 3, 6, (row + i) % 3)
    }
  }
  lamp(ctx, 375, 55, 58, true)
  for (let i = 2; i >= 0; i--) {
    block(ctx, 435 + i, 87 - i * 3, 9, 7, '#131c28')
    block(ctx, 436 + i, 87 - i * 3, 7, 1, '#505763')
    block(ctx, 437 + i, 89 - i * 3, 6, 1, '#3a4450')
  }
}

function drawPaint(ctx: CanvasRenderingContext2D, level: number) {
  const color = level > 3 ? '#9a5485' : '#71537b'
  shape(ctx, '#12232f', 385, 102, 442, 102, 443, 149, 379, 150)
  shape(ctx, '#303b50', 389, 105, 439, 105, 439, 140, 384, 140)
  block(ctx, 392, 105, 42, 29, '#34374d')
  block(ctx, 393, 106, 40, 1, color)
  block(ctx, 389, 107, 2, 35, color)
  block(ctx, 435, 106, 2, 35, color)
  for (let x = 394; x < 433; x += 5) block(ctx, x, 109, 1, 30, '#252b40')
  for (let y = 114; y < 137; y += 6) block(ctx, 392, y, 44, 1, '#283044')
  lamp(ctx, 394, 106, 40)
  aura(ctx, 412, 126, 35, 23, level > 3 ? '#f176bc79' : '#be4a9964')
  block(ctx, 396, 130, 4, 8, '#ad4d68')
  block(ctx, 397, 128, 2, 2, '#e2c0b6')
  block(ctx, 401, 131, 3, 6, '#558795')
  block(ctx, 407, 129, 4, 8, '#667db7')
  block(ctx, 408, 128, 2, 1, '#b0c5c8')
  stripes(ctx, 382, 140, 60, 4)
  block(ctx, 414, 125, 17, 4, '#6b5e79')
  block(ctx, 416, 123, 13, 2, '#a48096')
  block(ctx, 417, 129, 2, 8, '#303548')
  block(ctx, 427, 129, 2, 8, '#303548')
}

function drawParking(ctx: CanvasRenderingContext2D, level: number) {
  shape(ctx, '#35323e', 280, 139, 347, 139, 356, 185, 272, 185)
  for (const [x, reverse] of [[280, -1], [347, 1]]) {
    line(ctx, x, 138, x + reverse * 7, 183, '#aa5669')
    line(ctx, x + reverse, 139, x + reverse * 8, 183, '#5a3d4b')
  }
  block(ctx, 272, 183, 85, 1, '#aa5669')
  block(ctx, 279, 180, 9, 2, '#596369')
  block(ctx, 341, 180, 9, 2, '#596369')
  block(ctx, 289, 141, 17, 2, '#aa5669')
  block(ctx, 326, 141, 17, 2, '#aa5669')
  cabinet(ctx, 236, 147, 14, 8)
  block(ctx, 237, 140, 13, 8, '#192937')
  block(ctx, 238, 141, 11, 6, level > 2 ? '#57aaa5' : '#3f697c')
  block(ctx, 239, 142, 3, 1, '#b5e4c8')
  line(ctx, 242, 145, 244, 143, '#9ac6b0')
  line(ctx, 244, 143, 246, 144, '#9ac6b0')
  line(ctx, 246, 144, 248, 142, '#9ac6b0')
  aura(ctx, 243, 143, 16, 13, '#35cada38')
  block(ctx, 253, 151, 3, 4, '#373342')
  block(ctx, 254, 154, 1, 4, '#363740')
  line(ctx, 252, 151, 257, 155, '#101824')
  line(ctx, 257, 155, 261, 155, '#101824')
  line(ctx, 261, 155, 263, 151, '#101824')
}

function drawExtraDetails(ctx: CanvasRenderingContext2D, level: number) {
  for (const x of [35, 444]) {
    block(ctx, x - 1, 122, 2, 15, '#121b27')
    block(ctx, x - 2, 123, 4, 10, '#754639')
    block(ctx, x - 2, 125, 1, 6, '#c96f54')
    block(ctx, x - 3, 121, 5, 2, '#41424a')
  }
  for (let i = 0; i < 4; i++) {
    const x = 360 + (i % 2) * 6, y = 207 - Math.floor(i / 2) * 5
    block(ctx, x, y, 9, 4, '#161e2a')
    block(ctx, x + 2, y - 1, 5, 2, '#af7748')
    block(ctx, x + 3, y - 3, 3, 2, '#cf934f')
    block(ctx, x + 3, y - 1, 3, 1, '#d6c0a0')
  }
  crate(ctx, 181, 87, 17, 9, 0)
  crate(ctx, 187, 83, 13, 7, 2)
  crate(ctx, 356, 86, 12, 9, 1)
  for (const [x, y] of [[45, 135], [54, 149], [433, 168], [438, 172]]) {
    block(ctx, x, y, 6, 10, '#3d4e59')
    block(ctx, x + 1, y - 1, 4, 2, '#8d8a7c')
    block(ctx, x + 1, y + 3, 4, 2, '#5c686c')
    block(ctx, x + 1, y + 8, 4, 1, '#687574')
  }
  for (let i = 0; i < 22; i++) {
    const x = 34 + Math.floor(seed(i, 33) * 410), y = 85 + Math.floor(seed(i, 65) * 130)
    if (i % 3 === 0) block(ctx, x, y, 2, 1, '#ab8e6377')
  }
  line(ctx, 34, 94, 34, 220, '#778994')
  line(ctx, 446, 94, 446, 220, '#778994')
  if (level >= 2) {
    lamp(ctx, 151, 88, 32)
    lamp(ctx, 333, 94, 39)
    block(ctx, 36, 114, 2, 39, '#c28653')
    block(ctx, 444, 144, 2, 40, '#c28653')
  }
  if (level >= 3) {
    block(ctx, 144, 187, 25, 17, '#2a353f')
    block(ctx, 145, 186, 23, 1, '#818285')
    stripes(ctx, 145, 202, 23, 2)
    cabinet(ctx, 146, 178, 16, 10, true)
    aura(ctx, 243, 57, 102, 43, '#f555392b')
  }
  if (level >= 4) {
    block(ctx, 36, 89, 2, 130, '#30a2a9')
    block(ctx, 444, 89, 2, 130, '#30a2a9')
    aura(ctx, 36, 155, 46, 91, '#55e7e847')
    aura(ctx, 442, 158, 49, 87, '#53e1f049')
  }
  if (level >= 5) {
    for (const [x, y] of [[152, 123], [172, 123], [347, 157], [367, 157]]) {
      block(ctx, x, y, 17, 1, '#e29561')
      aura(ctx, x + 8, y, 20, 9, '#ff864236')
    }
    cabinet(ctx, 381, 179, 27, 13)
    block(ctx, 385, 167, 19, 11, '#2a5264')
    block(ctx, 386, 168, 17, 8, '#54a0a6')
    sign(ctx, 'NG', 388, 169, '#ceead8', 6)
  }
}

function paintGarage(ctx: CanvasRenderingContext2D, level: number) {
  ctx.imageSmoothingEnabled = false
  drawStructure(ctx, level)
  drawOffice(ctx, level)
  drawWorkbenches(ctx, level)
  drawLift(ctx, level)
  drawParts(ctx, level)
  drawPaint(ctx, level)
  drawParking(ctx, level)
  drawExtraDetails(ctx, level)
  const vignette = ctx.createRadialGradient(240, 131, 113, 240, 136, 280)
  vignette.addColorStop(0, 'transparent')
  vignette.addColorStop(1, '#1009116f')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, 480, 270)
}

export class GarageScene extends Phaser.Scene {
  private dataIn: GarageData = {}
  private player!: Phaser.GameObjects.Sprite
  private playerShadow!: Phaser.GameObjects.Graphics
  private garageArt!: Phaser.GameObjects.Image
  private car!: Phaser.GameObjects.Image
  private carDetails!: Phaser.GameObjects.Graphics
  private marker!: Phaser.GameObjects.Graphics
  private markerIcons: Phaser.GameObjects.Image[] = []
  private reduceMotion = false
  private weather!: Phaser.GameObjects.Graphics
  private shutter!: Phaser.GameObjects.Graphics
  private keys?: Record<'W' | 'A' | 'S' | 'D' | 'E', Phaser.Input.Keyboard.Key>
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys
  private activeStation?: Fixture
  private target?: StationId
  private level = 1
  private model = 0
  private color = 0xbf654f
  private style: CarStyle = {}
  private facing = 0
  private walkingTime = 0
  private lastMove: Point = { x: 470, y: 379 }
  private lastMoveAt = 0
  private actionHeld = false
  private actionQueued = false
  private playerInteractingAt = -999
  private doorProgress = 0
  private doorWanted = 0
  private previousShutterHeight = -1
  private previousShutterStatus = false
  private leaving = false
  private effect: Particle[] = []
  private animateParkedCarUntil = 0
  private lastFootstep = -999
  private carTextureKey = ''

  constructor() {
    super('garage')
  }

  init(data: GarageData = {}) {
    this.dataIn = data
    this.activeStation = undefined
    this.target = data.target
    this.level = Phaser.Math.Clamp(data.level ?? 1, 1, 5)
    this.model = Phaser.Math.Clamp(Math.floor(data.model ?? 0), 0, 11)
    this.color = data.color ?? 0xbf654f
    this.style = data.style ?? {}
    this.facing = 0
    this.walkingTime = 0
    this.lastMoveAt = 0
    this.actionHeld = false
    this.actionQueued = false
    this.playerInteractingAt = -999
    this.doorProgress = 0
    this.doorWanted = 0
    this.previousShutterHeight = -1
    this.previousShutterStatus = false
    this.leaving = false
    this.effect = []
    this.animateParkedCarUntil = 0
    this.lastFootstep = -999
  }

  preload() {
    const base = import.meta.env.BASE_URL
    if (!this.textures.exists('ng-protagonist')) {
      this.load.spritesheet('ng-protagonist', `${base}art/protagonist.png`, { frameWidth: 16, frameHeight: 24 })
    }
    for (let i = 0; i < 12; i++) {
      const index = modelKey(i)
      if (!this.textures.exists(`ng-garage-car-${index}`)) this.load.image(`ng-garage-car-${index}`, `${base}art/car-${index}.png`)
      if (!this.textures.exists(`ng-garage-mask-${index}`)) this.load.image(`ng-garage-mask-${index}`, `${base}art/car-mask-${index}.png`)
    }
  }

  create() {
    const key = this.roomTexture()
    this.garageArt = this.add.image(0, 0, key).setOrigin(0).setScale(2)
    this.carDetails = this.add.graphics().setDepth(2)
    this.car = this.add.image(616, 320, '__MISSING').setScale(2).setDepth(3)
    this.renderCar()
    this.playerShadow = this.add.graphics().setDepth(4)
    this.marker = this.add.graphics().setDepth(8)
    this.markerIcons = this.createStationIcons()
    this.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    this.shutter = this.add.graphics().setDepth(10)
    this.weather = this.add.graphics().setDepth(11)
    const proposed = this.dataIn.spawn ?? { x: 470, y: 379 }
    const origin = this.canStand(proposed.x, proposed.y) ? proposed : { x: 470, y: 379 }
    this.player = this.add.sprite(origin.x, origin.y, this.playerTexture(), 0).setOrigin(.5, .92).setScale(2).setDepth(7)
    this.lastMove = { ...origin }
    this.keys = this.input.keyboard?.addKeys('W,A,S,D,E') as typeof this.keys
    this.cursors = this.input.keyboard?.createCursorKeys()
    this.input.keyboard?.removeCapture(Phaser.Input.Keyboard.KeyCodes.E)
    const queueAction = () => {
      if (!bridge.paused && !this.leaving) this.actionQueued = true
    }
    const interactKey = this.keys?.E
    interactKey?.on('down', queueAction)
    const onGarageUpdate = (data: GarageData) => this.applyData(data)
    const onGarageEffect = (data: { id?: StationId; kind?: string }) => this.playEffect(data)
    const offUpdate = bridge.on('garage:update', onGarageUpdate)
    const offEffect = bridge.on('garage-effect', onGarageEffect)
    const offAction = bridge.on('interact:press', queueAction)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      interactKey?.off('down', queueAction)
      offUpdate()
      offEffect()
      offAction()
      bridge.emit('near', {})
    })
    this.cameras.main.fadeIn(420, 8, 12, 23)
    bridge.emit('garage:ready', {})
  }

  update(time: number, delta: number) {
    const dt = Math.min(delta, 40) / 1000
    this.updateShutter(delta)
    this.updateWeather(time, dt)
    this.drawMarker(time)
    if (time > this.animateParkedCarUntil) this.car.setY(320 + (this.style.height ?? 0) % 4 * .65)
    else this.car.setY(319 - Math.sin((this.animateParkedCarUntil - time) * .007) * 4)
    const interact = this.actionQueued
    this.actionQueued = false
    const pad = this.input.gamepad?.pad1
    const action = Boolean(bridge.touch.interact || pad?.A)
    if (bridge.paused || this.leaving) {
      this.actionHeld = action
      return
    }

    const stickX = pad?.leftStick.x ?? 0
    const stickY = pad?.leftStick.y ?? 0
    const left = this.keys?.A.isDown || this.cursors?.left.isDown || bridge.touch.left || pad?.left || stickX < -.25
    const right = this.keys?.D.isDown || this.cursors?.right.isDown || bridge.touch.right || pad?.right || stickX > .25
    const up = this.keys?.W.isDown || this.cursors?.up.isDown || bridge.touch.up || pad?.up || stickY < -.25
    const down = this.keys?.S.isDown || this.cursors?.down.isDown || bridge.touch.down || pad?.down || stickY > .25
    const dx = Number(Boolean(right)) - Number(Boolean(left))
    const dy = Number(Boolean(down)) - Number(Boolean(up))
    if (dx || dy) this.walk(dx, dy, dt, time)
    else {
      this.walkingTime = 0
      this.player.setFrame(this.facing * 4 + (time - this.playerInteractingAt < 260 ? 1 : 0))
      this.drawShadow()
    }

    const near = this.nearestStation()
    if (near?.id !== this.activeStation?.id) {
      this.activeStation = near
      bridge.emit('near', near ? { id: near.id, label: near.label } : {})
    }
    if ((interact || (action && !this.actionHeld)) && near) this.interactWith(near, time)
    this.actionHeld = action
  }

  private roomTexture() {
    const key = `ng-workshop-level-${this.level}`
    if (!this.textures.exists(key)) {
      const texture = this.textures.createCanvas(key, 480, 270)
      if (!texture) throw new Error('No se pudo preparar el taller')
      paintGarage(texture.getContext(), this.level)
      texture.refresh()
      texture.setFilter(Phaser.Textures.FilterMode.NEAREST)
    }
    return key
  }

  private createStationIcons() {
    const key = 'ng-station-icons'
    const width = 9, height = 7
    if (!this.textures.exists(key)) {
      const texture = this.textures.createCanvas(key, width * stations.length, height)
      if (!texture) return []
      const ctx = texture.getContext()
      stations.forEach(({ id }, index) => {
        const offset = index * width
        stationSymbols[id].forEach((pixels, y) => {
          for (let x = 0; x < width; x++) {
            if (pixels[x] === '1') block(ctx, offset + x, y, 1, 1, '#fff1f5')
          }
        })
        texture.add(id, 0, offset, 0, width, height)
      })
      texture.refresh()
      texture.setFilter(Phaser.Textures.FilterMode.NEAREST)
    }
    return stations.map(({ id, x, y, markerOffset = 0 }) =>
      this.add.image(x, y + markerOffset - 16, key, id).setScale(2).setDepth(9))
  }

  private playerTexture() {
    if (this.textures.exists('ng-protagonist')) return 'ng-protagonist'
    const key = 'ng-protagonist-local'
    if (this.textures.exists(key)) return key
    const texture = this.textures.createCanvas(key, 64, 96)
    if (!texture) return '__MISSING'
    const ctx = texture.getContext()
    for (let dir = 0; dir < 4; dir++) {
      for (let frame = 0; frame < 4; frame++) {
        const x = frame * 16, y = dir * 24
        const leg = frame === 1 ? 2 : frame === 3 ? -2 : 0
        block(ctx, x + 5, y + 5, 7, 7, '#121c29')
        block(ctx, x + 6, y + 6, 5, 4, dir === 3 ? '#41333b' : '#b77e66')
        block(ctx, x + 5, y + 4, 7, 3, '#40343a')
        block(ctx, x + 6, y + 4, 4, 1, '#775547')
        block(ctx, x + 4, y + 11, 9, 7, '#293343')
        block(ctx, x + 5, y + 11, 7, 5, '#af6248')
        block(ctx, x + (dir === 2 ? 10 : 5), y + 12, 2, 5, '#e09864')
        block(ctx, x + 4, y + 14, 2, 3, '#bd7d65')
        block(ctx, x + 12, y + 13, 1, 4, '#bd7d65')
        block(ctx, x + 6, y + 16, 2, 4 + leg, '#354251')
        block(ctx, x + 9, y + 16, 2, 4 - leg, '#354251')
        block(ctx, x + 5, y + 20 + leg, 3, 2, '#151d28')
        block(ctx, x + 9, y + 20 - leg, 3, 2, '#151d28')
      }
    }
    texture.refresh()
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST)
    for (let i = 0; i < 16; i++) texture.add(i, 0, i % 4 * 16, Math.floor(i / 4) * 24, 16, 24)
    return key
  }

  private renderCar() {
    const id = modelKey(this.model)
    const original = `ng-garage-car-${id}`
    const mask = `ng-garage-mask-${id}`
    const nextKey = 'ng-recolored-parked-car'
    let textureKey = original
    if (this.textures.exists(original) && this.textures.exists(mask)) {
      const texture = this.textures.get(nextKey) as Phaser.Textures.CanvasTexture
      const canvas = this.textures.exists(nextKey) ? texture : this.textures.createCanvas(nextKey, 64, 32)
      if (canvas) {
        const ctx = canvas.getContext()
        ctx.clearRect(0, 0, 64, 32)
        ctx.drawImage(this.textures.get(mask).getSourceImage() as CanvasImageSource, 0, 0)
        const pixelMask = ctx.getImageData(0, 0, 64, 32).data
        ctx.clearRect(0, 0, 64, 32)
        ctx.drawImage(this.textures.get(original).getSourceImage() as CanvasImageSource, 0, 0)
        const sprite = ctx.getImageData(0, 0, 64, 32)
        const { red, green, blue } = Phaser.Display.Color.IntegerToColor(this.color)
        const rgb = [red, green, blue]
        for (let i = 0; i < sprite.data.length; i += 4) {
          if (pixelMask[i + 3] < 10) continue
          const tone = pixelMask[i] / 179
          for (let k = 0; k < 3; k++) {
            const shaded = tone < 1 ? Math.round(rgb[k] * tone) : Math.round(rgb[k] + (255 - rgb[k]) * (tone - 1) * 1.75)
            sprite.data[i + k] = Phaser.Math.Clamp(shaded, 0, 255)
          }
        }
        ctx.putImageData(sprite, 0, 0)
        canvas.refresh()
        canvas.setFilter(Phaser.Textures.FilterMode.NEAREST)
        textureKey = nextKey
      }
    }
    if (!this.textures.exists(textureKey)) textureKey = this.carFallback()
    this.carTextureKey = textureKey
    this.car.setTexture(textureKey)
    this.renderCarDetails()
  }

  private carFallback() {
    const key = 'ng-parked-local'
    const texture = this.textures.exists(key)
      ? this.textures.get(key) as Phaser.Textures.CanvasTexture
      : this.textures.createCanvas(key, 64, 32)
    if (!texture) return '__MISSING'
    const ctx = texture.getContext()
    ctx.clearRect(0, 0, 64, 32)
    const body = Phaser.Display.Color.IntegerToColor(this.color).rgba
    shape(ctx, '#141c27', 5, 9, 12, 6, 52, 6, 59, 10, 61, 16, 59, 23, 50, 27, 9, 26, 3, 21, 4, 12)
    shape(ctx, body, 6, 10, 15, 7, 51, 8, 56, 10, 60, 16, 57, 22, 49, 25, 10, 24, 5, 19)
    shape(ctx, '#814c47', 13, 8, 44, 8, 40, 12, 17, 12)
    shape(ctx, '#7a524b', 9, 22, 17, 20, 39, 21, 48, 24, 11, 24)
    shape(ctx, '#2a4356', 22, 11, 39, 11, 45, 15, 42, 20, 20, 20, 17, 16)
    shape(ctx, '#648196', 39, 12, 43, 14, 43, 18, 40, 19, 38, 17)
    block(ctx, 27, 12, 10, 7, '#4f5d70')
    block(ctx, 28, 12, 8, 1, '#9b8386')
    block(ctx, 9, 8, 7, 2, '#151c23')
    block(ctx, 45, 8, 7, 2, '#151c23')
    block(ctx, 9, 23, 7, 3, '#151c23')
    block(ctx, 45, 23, 7, 3, '#151c23')
    block(ctx, 55, 11, 3, 2, '#f5ddba')
    block(ctx, 55, 20, 3, 2, '#f5ddba')
    block(ctx, 6, 11, 3, 2, '#eb6552')
    block(ctx, 5, 19, 3, 2, '#e77263')
    texture.refresh()
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST)
    return key
  }

  private renderCarDetails() {
    const underglow = this.style.underglow ?? 0
    const decals = this.style.vinyl ?? 0
    const color = Phaser.Display.Color.HexStringToColor(colors[underglow % colors.length]).color
    this.carDetails.clear()
    this.carDetails.fillStyle(0x111925, .63).fillEllipse(614, 329, 115, 36)
    if (underglow) {
      for (let i = 0; i < 4; i++) this.carDetails.fillStyle(color, .12).fillEllipse(616, 324, 146 - i * 14, 54 - i * 8)
      this.carDetails.fillStyle(color, .64).fillRect(575, 333, 77, 2)
    }
    if (!this.carTextureKey) return
    const key = 'ng-parked-with-options'
    const texture = this.textures.exists(key) ? this.textures.get(key) as Phaser.Textures.CanvasTexture : this.textures.createCanvas(key, 64, 32)
    if (!texture) return
    const ctx = texture.getContext()
    ctx.clearRect(0, 0, 64, 32)
    if (this.style.exhaust) {
      block(ctx, 1, 19, 10, 3, '#1b2430')
      block(ctx, 1, 18, 5, 2, '#a5aeb5')
      block(ctx, 2, 21, 6, 1, '#657989')
    }
    ctx.drawImage(this.textures.get(this.carTextureKey).getSourceImage() as CanvasImageSource, 0, 0)
    if (decals) {
      const hue = colors[decals % colors.length]
      const visible = ctx.getImageData(0, 0, 64, 32).data
      for (const y of [11 + decals % 3, 19 + decals % 3]) {
        for (let x = 33; x < 58; x++) {
          const i = (y * 64 + x) * 4
          if (visible[i + 3] > 110 && visible[i] > visible[i + 2] * .9) block(ctx, x, y, 1, 1, hue)
        }
      }
    }
    if (this.style.spoiler) {
      block(ctx, 6, 9, 3, 16, '#242934')
      block(ctx, 6, 10, 1, 13, '#7d8790')
      block(ctx, 7, 8, 5, 2, '#393e4a')
      block(ctx, 7, 24, 5, 2, '#393e4a')
    }
    if (this.style.bumper) {
      block(ctx, 62, 11, 1, 11, '#6f757c')
      block(ctx, 61, 13, 2, 7, '#2a2c36')
      block(ctx, 60, 13, 2, 1, '#a4b8bb')
      block(ctx, 60, 20, 2, 1, '#a4b8bb')
    }
    if (this.style.wheels) {
      for (const x of [12, 48]) {
        for (const y of [6, 25]) {
          block(ctx, x, y, 5, 2, '#202632')
          block(ctx, x + 1, y, 3, 1, '#a5aeb1')
        }
      }
    }
    texture.refresh()
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST)
    this.car.setTexture(key)
  }

  private canStand(x: number, y: number) {
    return x >= 74 && x <= 886 && y >= 162 && y <= 468 && !obstacles.some(rect => rect.contains(x, y))
  }

  private walk(dx: number, dy: number, dt: number, time: number) {
    const previousX = this.player.x, previousY = this.player.y
    const distance = dt * 153 / Math.hypot(dx, dy)
    if (this.canStand(this.player.x + dx * distance, this.player.y)) this.player.x += dx * distance
    if (this.canStand(this.player.x, this.player.y + dy * distance)) this.player.y += dy * distance
    this.facing = dx < 0 ? 1 : dx > 0 ? 2 : dy < 0 ? 3 : 0
    if (this.player.x !== previousX || this.player.y !== previousY) {
      if (import.meta.env.DEV) bridge.emit('garage-coordinates', { x: this.player.x, y: this.player.y })
      this.walkingTime += dt
      this.player.setFrame(this.facing * 4 + Math.floor(this.walkingTime * 10) % 4)
      if (time - this.lastFootstep > 245) {
        this.lastFootstep = time
        bridge.emit('footstep', {})
      }
      if (time - this.lastMoveAt > 140 && Math.hypot(this.player.x - this.lastMove.x, this.player.y - this.lastMove.y) > 7) {
        this.lastMove = { x: this.player.x, y: this.player.y }
        this.lastMoveAt = time
        bridge.emit('move', this.lastMove)
      }
    }
    this.drawShadow()
  }

  private drawShadow() {
    this.playerShadow.clear()
    this.playerShadow.fillStyle(0x090e18, .55).fillEllipse(Math.floor(this.player.x / 2) * 2, Math.floor(this.player.y / 2) * 2 + 1, 26, 10)
  }

  private nearestStation() {
    let closest: Fixture | undefined
    let closestDistance = Infinity
    for (const station of stations) {
      const distance = Math.hypot(station.x - this.player.x, station.y - this.player.y)
      if (distance < station.radius && distance < closestDistance) {
        closest = station
        closestDistance = distance
      }
    }
    return closest
  }

  private interactWith(station: Fixture, time: number) {
    this.playerInteractingAt = time
    const dx = station.x - this.player.x
    const dy = station.y - this.player.y
    if (Math.hypot(dx, dy) > 6) {
      this.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0)
    }
    this.player.setFrame(this.facing * 4 + 1)
    bridge.emit('move', { x: this.player.x, y: this.player.y })
    if (station.id !== 'exit') {
      bridge.emit('station', { id: station.id })
      return
    }
    this.leaving = true
    this.doorWanted = 1
    this.time.delayedCall(455, () => {
      bridge.emit('station', { id: 'exit' })
      this.leaving = false
      this.time.delayedCall(450, () => { this.doorWanted = 0 })
    })
  }

  private applyData(data: GarageData) {
    if (data.level !== undefined && data.level !== this.level) {
      this.level = Phaser.Math.Clamp(data.level, 1, 5)
      this.garageArt.setTexture(this.roomTexture())
      this.playEffect({ id: 'tools', kind: 'upgrade' })
    }
    if (data.model !== undefined) this.model = Phaser.Math.Clamp(Math.floor(data.model), 0, 11)
    if (data.color !== undefined) this.color = data.color
    if (data.style !== undefined) this.style = data.style
    if (Object.prototype.hasOwnProperty.call(data, 'target')) this.target = data.target
    if (data.model !== undefined || data.color !== undefined || data.style !== undefined) this.renderCar()
  }

  private playEffect(data: { id?: StationId; kind?: string } = {}) {
    const fixture = stations.find(item => item.id === data.id) ?? this.activeStation ?? stations[2]
    const isPaint = data.kind === 'paint' || fixture.id === 'paint'
    const isLift = data.kind === 'lift' || fixture.id === 'lift'
    const position = { x: fixture.x, y: fixture.y - 22 }
    if (isLift) this.animateParkedCarUntil = this.time.now + 650
    const count = isPaint ? 22 : 28
    for (let i = 0; i < count; i++) {
      const life = Phaser.Math.FloatBetween(.18, .65)
      const tone = isPaint ? 0xed8bbd : i % 3 === 0 ? 0xffefd8 : 0xff636d
      this.effect.push({
        ...position,
        dx: Phaser.Math.FloatBetween(-72, 72),
        dy: Phaser.Math.FloatBetween(-134, -18),
        life,
        initialLife: life,
        color: tone,
      })
    }
  }

  private drawMarker(time: number) {
    this.marker.clear()
    const pulse = this.reduceMotion ? 0 : (1 + Math.sin(time / 205)) / 2
    stations.forEach((fixture, index) => {
      const selected = fixture.id === this.activeStation?.id
      const guided = fixture.id === this.target
      const { x } = fixture
      const y = fixture.y + (fixture.markerOffset ?? 0)
      const emphasized = selected || guided
      const center = y - 16 - (guided && !selected ? Math.round(pulse * 4) : 0)
      const radius = emphasized ? 16 : 13
      const color = selected ? 0xffe1e8 : 0xff5b79
      if (emphasized) {
        this.marker.lineStyle(1, color, .17 + pulse * .2).strokeCircle(x, center, radius + 4 + pulse * 3)
        this.marker.fillStyle(color, .29).fillEllipse(x, y + 3, 25, 6)
        this.marker.fillStyle(color, .92).fillTriangle(x - 5, center + radius - 2, x + 5, center + radius - 2, x, y + 4)
      }
      this.marker.fillStyle(0x120d19, .97).fillCircle(x, center + 2, radius + 1)
      this.marker.fillStyle(guided ? 0x961f43 : 0x241b27, emphasized ? 1 : .93).fillCircle(x, center, radius)
      this.marker.lineStyle(emphasized ? 2 : 1, color, emphasized ? .96 : .73).strokeCircle(x, center, radius)
      this.markerIcons[index]?.setY(center).setAlpha(emphasized ? 1 : .94)
    })
  }

  private updateWeather(time: number, dt: number) {
    this.weather.clear()
    const lowQuality = bridge.quality === 'low'
    for (let i = 0; i < (lowQuality ? 24 : 51); i++) {
      const y = i % 3 === 0 ? ((time * .06 + seed(i, 87) * 52) % 52) : 491 + ((time * .10 + seed(i, 4) * 46) % 46)
      const x = (seed(i, 94) * 961 + time * .016) % 960
      this.weather.lineStyle(1, i % 6 === 0 ? 0xf884a0 : 0x7a8da8, .17 + seed(i, 56) * .21)
      this.weather.lineBetween(Math.floor(x), Math.floor(y), Math.floor(x - 4), Math.floor(y + 8))
    }
    if (!lowQuality && !this.reduceMotion) {
      for (let i = 0; i < 9; i++) {
        const progress = (time / 2300 + i / 9) % 1
        const x = 824 + Math.round(Math.sin(progress * 8 + i) * 9) + Math.round(progress * 21)
        const y = 263 - Math.round(progress * 33)
        this.weather.fillStyle(0xf3a4cb, (1 - progress) * .14).fillRect(x, y, 2 + Math.round(progress * 6), 2)
      }
      for (let i = 0; i < 9; i++) {
        const x = 492 + Math.floor((seed(i, 71) * 120 + time / 137) % 120)
        const y = 167 + Math.floor((seed(i, 96) * 55 + time / 244) % 55)
        this.weather.fillStyle(0xc4e0d3, .06 + Math.sin(time / 780 + i) * .035).fillRect(x, y, 2, 2)
      }
      for (let i = 0; i < 13; i++) {
        const phase = (time / 2240 + seed(i, 44)) % 1
        const y = 491 + Math.round(phase * 48)
        const spread = (i % 2 ? 1 : -1) * Math.round(phase * 11)
        const x = (i % 2 ? 382 : 582) + spread + Math.floor(seed(i, 61) * 19)
        this.weather.fillStyle(0xfc5579, Math.sin(phase * Math.PI) * .24).fillRect(x, y, 6 + i % 8, 1)
      }
      const scanY = 284 + Math.floor(time / 110) % 8
      this.weather.fillStyle(0xb1f9df, .23).fillRect(477, scanY, 19, 1)
    }
    this.weather.fillStyle(0x9be6e2, .31 + Math.sin(time / 280) * .21).fillRect(480, 291, 3, 2)
    this.weather.fillStyle(0xff7890, .4 + Math.sin(time / 250) * .25).fillRect(637, 182, 2, 2)
    for (let i = this.effect.length - 1; i >= 0; i--) {
      const particle = this.effect[i]
      if (particle.life <= 0) {
        this.effect.splice(i, 1)
        continue
      }
      particle.life -= dt
      particle.dy += 250 * dt
      particle.x += particle.dx * dt
      particle.y += particle.dy * dt
      const alpha = Math.max(0, particle.life / particle.initialLife)
      const size = alpha > .5 ? 3 : 2
      this.weather.fillStyle(particle.color, alpha).fillRect(Math.round(particle.x), Math.round(particle.y), size, size)
    }
  }

  private updateShutter(delta: number) {
    const step = Math.min(1, delta / 430)
    if (this.doorProgress < this.doorWanted) this.doorProgress = Math.min(this.doorWanted, this.doorProgress + step)
    if (this.doorProgress > this.doorWanted) this.doorProgress = Math.max(this.doorWanted, this.doorProgress - step)
    const { shutter } = this
    const height = Math.round(20 * (1 - this.doorProgress))
    if (height === this.previousShutterHeight && this.leaving === this.previousShutterStatus) return
    this.previousShutterHeight = height
    this.previousShutterStatus = this.leaving
    shutter.clear()
    shutter.fillStyle(0x080f1c, .9).fillRect(391, 474, 188, 26)
    if (this.doorProgress > .04) {
      shutter.fillStyle(0x42a6ae, .24 * this.doorProgress).fillRect(397, 475, 175, 24)
      shutter.fillStyle(0x8be9db, .45 * this.doorProgress).fillRect(397, 497, 175, 2)
      shutter.fillStyle(0x66cbd3, .28 * this.doorProgress).fillTriangle(417, 499, 555, 499, 567, 521)
    }
    for (let i = 0; i < height; i += 4) {
      shutter.fillStyle(i % 8 === 0 ? 0x48515e : 0x3a4654, 1).fillRect(395, 475 + i, 180, Math.min(3, height - i))
      shutter.fillStyle(0x78828b, .6).fillRect(397, 475 + i, 175, 1)
    }
    shutter.fillStyle(0x191f2b, 1).fillRect(391, 473, 187, 4)
    shutter.fillStyle(0xed6b8a, .58).fillRect(399, 473, 173, 1)
    shutter.fillStyle(this.leaving ? 0x7ee3bf : 0xf85c78, 1).fillRect(581, 479, 3, 3)
  }
}
