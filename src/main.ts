import '@fontsource/barlow/latin-400.css'
import '@fontsource/barlow/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import '@fontsource/barlow-condensed/latin-900-italic.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-600.css'
import './style.css'
import './story-guide.css'
import { audio } from './audio'
import { bridge } from './bridge'
import {
  ACHIEVEMENTS, COMPONENTS, COMPONENT_KEYS, CUSTOMIZATIONS, CUSTOMIZATION_KEYS,
  JOBS, LEVELS, MODELS, RACES, STORY, TOURNAMENT, TUTORIAL,
} from './catalog'
import type { ComponentKey, CustomizationKey, RaceMode } from './catalog'
import {
  abandonRace, acceptJob, activeCar, advanceTutorial, applyDrive, buyCar, buyPart,
  canDrive, carTuning, carValue, claimJob, customizeCar, fuelPrice, GARAGE_SPAWN,
  marketOffers, newGame, raceEntry, refuel, repairCar, selectCar, sellCar, settleRace,
  skipTutorial, resumeTutorial, startTournament, tournamentRace, upgradeWorkshop,
} from './domain'
import type { Car, CommandResult, GameState, PlayerPosition, RaceReport, RaceReward, Settings } from './domain'
import { exportSave, importSave, listSlots, loadSlot, saveSlot } from './storage'
import type { SlotSummary } from './storage'
import { CITY_LEGEND, drawMap, type MapWorld } from './map'
import { cityMap } from './geography'
import { RACE_COURSES } from './courses'
import { coachStep, drillCount, drivingDrill, guideContent } from './guide'
import { storyChapters, storyFrame, storyLength, storyTitle } from './story'
import { mountRepair, repairMarkup } from './repair'
import { asset, button, carImage, componentIcon, conditionGauge, euro, icon, number, rgb, safe, statIcon, time } from './ui'

const app = document.querySelector<HTMLElement>('#app')!
app.innerHTML = '<div id="canvas-host"></div><div id="game-ui" hidden></div><div id="front"></div><div id="modal-root"></div><div id="toast-root" aria-live="polite"></div><input id="import-file" type="file" accept=".json,application/json" hidden>'
const canvasHost = document.querySelector<HTMLElement>('#canvas-host')!
const gameUi = document.querySelector<HTMLElement>('#game-ui')!
const front = document.querySelector<HTMLElement>('#front')!
const modalRoot = document.querySelector<HTMLElement>('#modal-root')!
const toastRoot = document.querySelector<HTMLElement>('#toast-root')!
const inputFile = document.querySelector<HTMLInputElement>('#import-file')!

const STATIONS = {
  lift: { name:'Elevador', hint:'Consulta el desgaste de las piezas del coche.' },
  tools: { name:'Banco de herramientas', hint:'Monta los recambios que tienes en el inventario.' },
  pc: { name:'Ordenador', hint:'Acepta encargos y consulta las cuentas del taller.' },
  parts: { name:'Almacén de recambios', hint:'Compra las piezas antes de empezar una reparación.' },
  paint: { name:'Cabina de pintura', hint:'Prueba colores y piezas antes de instalarlos.' },
  engine: { name:'Banco de motores', hint:'Repara el motor, el turbo y la transmisión.' },
  parking: { name:'Aparcamiento', hint:'Cambia de vehículo, reposta o vende un coche.' },
  diagnostic: { name:'Máquina de diagnóstico', hint:'Localiza la avería que impide el arranque.' },
  exit: { name:'Portón de salida', hint:'Abre el portón y sal a conducir por Puerto Umbral.' },
} as const
type Station = keyof typeof STATIONS
type Place = 'menu' | 'garage' | 'road' | 'race'
type Mode = 'free' | RaceMode
type RoadHUD = {
  mode: Mode; speed: number; nitro: number; damage: number; time: number; lap: number; laps: number;
  position: number; total: number; checkpoint: number; checkpoints: number; countdown: number | string;
  zone: string; prompt: string; minimap: MapWorld & { next?: { x: number; y: number } }; x: number; y: number; angle: number; drift: number;
  throttle: number; slip: number; gear: number; distance?: number; courseName?: string; handbrake?: boolean; boosting?: boolean;
}
type Panel = 'slots' | 'new-slots' | 'overwrite' | 'settings' | 'pause' | 'inventory' | 'map' | 'missions' |
 'statistics' | 'lift' | 'diagnostic' | 'parts' | 'tools' | 'engine' | 'paint' | 'parking' | 'exit' | 'management' |
 'market' | 'fuel' | 'races' | 'race-preview' | 'result' | 'abandon' | 'menu-confirm' | 'sell-confirm' | 'work' | 'job' | 'tutorial' | 'story'

let state = newGame()
const seenStations = new Set<Station>()
let stationTipTimer = 0
let selectedSlot = 1
let slots: (SlotSummary | null)[] = [null, null, null]
let settingsInMenu = { ...state.settings }
let panel: Panel | null = null
let returnFocus: HTMLElement | null = null
let place: Place = 'menu'
let runActive = false
let showingIntro = false
let introIndex = 0
let storyChapter = 1
let storyIndex = 0
let guideTab = 0
let drill: number | null = null
let preparing = false
let overwriteSlot = 1
let mode: Mode = 'free'
let pendingMode: RaceMode = 'sprint'
let roadHud: RoadHUD | null = null
let raceResult: { report: RaceReport; reward: RaceReward; finish?: PlayerPosition; courseName?: string } | null = null
let currentJobId = ''
let currentSaleId = ''
let currentPart: ComponentKey = 'battery'
let parentRepair: 'tools' | 'engine' = 'tools'
let previewColor: number | null = null
let previewMods: Partial<Car['mods']> = {}
let repairCleanup = () => {}
let lastCoach = ''
let lastGarageSave = 0
let lastStepSound = 0
let lastMap = 0
let lastInteraction = 0
let trip = { distance: 0, damage: 0 }
let tripDamageReported = 0
let tripDistanceReported = 0
let toastTimer = 0
let launchRevision = 0
let enginePromise: Promise<Awaited<ReturnType<typeof makeEngine>>> | undefined

function loading() {
  front.hidden = false
  front.innerHTML = '<div class="loading-screen"><span class="eyebrow">Puerto Umbral</span><h1>Night Garage</h1><div class="loading-line" role="progressbar" aria-label="Cargando juego"></div></div>'
}

function renderTitle() {
  front.hidden = false
  const canContinue = slots.some(Boolean)
  const rain = Array.from({length: 32}, (_, i) => '<i style="left:' + ((i*39)%160) + '%;--delay:' + (-i*.194) + 's;--duration:' + (.47+(i%7)*.089) + 's;--length:' + (47+i%11*6) + 'px"></i>').join('')
  front.innerHTML = '<main class="title-screen"><div class="title-image" style="background-image:url(&quot;' + asset('art/title-scene.png') + '&quot;)"></div><div class="title-rain" aria-hidden="true">' + rain +
    '</div><header class="title-top"><span class="wordmark-small"><i class="mark">' + icon('wrench', 16) + '</i> Puerto Umbral</span><div class="game-buttons">' +
    iconButton(settingsInMenu.music ? 'sound' : 'mute','audio-toggle','Activar o silenciar música') + iconButton('expand','fullscreen','Pantalla completa') +
    '</div></header><section class="title-content"><h1 class="title-logo"><span>Night</span><span>Garage</span></h1><div class="title-actions">' +
    button('Nueva partida','new',{kind:canContinue?'secondary':'primary',icon:'play'}) +
    button('Continuar','continue',{kind:canContinue?'primary':'secondary',icon:'wrench',disabled:!canContinue}) +
    button('Partidas guardadas','open:slots',{kind:'quiet',icon:'folder'}) +
    button('Ajustes','open:settings',{kind:'quiet',icon:'settings'}) +
    '</div></section></main>'
}

function renderIntro() {
  front.hidden = false
  const last = introIndex === storyLength(1)-1
  front.innerHTML = '<main class="intro-screen story-intro">' + storyFrame(1,introIndex,
    button(last ? 'Entrar al taller' : 'Continuar','intro-next',{kind:'primary',icon:'play'}) +
    '<button class="text-button" data-action="intro-skip">Omitir cinemática</button>',true) + '</main>'
  front.querySelector<HTMLButtonElement>('[data-action="intro-next"]')?.focus()
}

function iconButton(name: string, action: string, label: string) {
  return '<button class="icon-button" data-action="' + safe(action) + '" title="' + safe(label) + '" aria-label="' + safe(label) + '">' + icon(name) + '</button>'
}

function hasHardwareWebGL() {
  const probe = document.createElement('canvas')
  try {
    const context = probe.getContext('webgl', { failIfMajorPerformanceCaveat: true })
    if (!context) return false
    const info = context.getExtension('WEBGL_debug_renderer_info')
    const renderer = info ? String(context.getParameter(info.UNMASKED_RENDERER_WEBGL)) : ''
    context.getExtension('WEBGL_lose_context')?.loseContext()
    return !/swiftshader|llvmpipe|software/i.test(renderer)
  } catch {
    return false
  }
}

async function makeEngine() {
  const [{ default: Phaser }, { GarageScene }, { RoadScene }] = await Promise.all([
    import('phaser'), import('./garage'), import('./road'),
  ])
  let booted: () => void = () => {}
  const ready = new Promise<void>(resolve => { booted = resolve })
  class BootScene extends Phaser.Scene {
    constructor() { super('boot') }
    create() { booted() }
  }
  const game = new Phaser.Game({
    type: hasHardwareWebGL() ? Phaser.AUTO : Phaser.CANVAS,
    parent: canvasHost,
    width: 960,
    height: 540,
    backgroundColor: '#0b1019',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    disableContextMenu: true,
    render: { powerPreference: 'high-performance' },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { gamepad: true },
    scene: [BootScene, GarageScene, RoadScene],
  })
  await ready
  return game
}

function resizeStage() {
  const ratio = Math.min(window.innerWidth / 960,window.innerHeight / 540)
  document.documentElement.style.setProperty('--stage-top', Math.round((window.innerHeight-540*ratio)/2)+'px')
  document.documentElement.style.setProperty('--stage-side', Math.round((window.innerWidth-960*ratio)/2)+'px')
}
window.addEventListener('resize', () => {
  resizeStage()
  renderPanelMap()
})
resizeStage()

async function refreshSlots() {
  try { slots = await listSlots() }
  catch { toast('El almacenamiento local no está disponible.', true) }
}

function commit(show = false) {
  if (!runActive) return
  const snapshot = structuredClone(state)
  void saveSlot(selectedSlot, snapshot).then(summary => {
    slots[summary.slot-1] = summary
    if (show) toast('Partida guardada.')
  }).catch(() => toast('No se pudo guardar la partida. Puedes exportarla como JSON.', true))
}

function applied(result: CommandResult, refresh = true) {
  if (result.message) toast(result.message,!result.ok)
  if (!result.ok) return false
  commit()
  refreshWorld()
  if (refresh && panel) renderModal(false)
  return true
}

function refreshWorld() {
  refreshCoach()
  refreshBank()
  if (place === 'garage') bridge.emit('garage:update', garageData())
}

function garageData() {
  const car = activeCar(state)
  const step = TUTORIAL[state.tutorial.step]
  const target = !state.tutorial.skipped && step && 'station' in step ? step.station : undefined
  return {
    spawn: state.position.scene === 'garage' ? { x:state.position.x, y:state.position.y } : GARAGE_SPAWN,
    level:state.level, model:car.model, color:car.color, target,
    style:{ wheels:car.mods.rims,height:car.mods.ride,spoiler:car.mods.wing,bumper:car.mods.bumper,vinyl:car.mods.vinyl,underglow:car.mods.neon,exhaust:car.mods.exhaust },
  }
}

async function startSlot(slot: number, fresh: boolean) {
  if (preparing) return
  preparing = true
  closePanel(false)
  try {
    const loaded = fresh ? newGame() : await loadSlot(slot)
    if (!loaded) { toast('Esa ranura está vacía.', true); return }
    state = loaded
    if (fresh) state.settings = { ...settingsInMenu }
    selectedSlot = slot
    seenStations.clear()
    guideTab = 0
    drill = null
    runActive = true
    audio.levels(state.settings.music,state.settings.sfx)
    bridge.quality = state.settings.quality
    if (fresh) {
      showingIntro = true
      introIndex = 0
      renderIntro()
      commit()
      warmEngine()
    } else {
      showingIntro = false
      await resumeLoaded()
    }
  } catch {
    toast('No se ha podido abrir la partida.', true)
    if (place === 'menu' && !showingIntro) renderTitle()
  } finally { preparing = false }
}

function warmEngine() {
  if (!enginePromise) enginePromise = makeEngine().catch(error => { enginePromise = undefined; throw error })
  void enginePromise.catch(() => {})
  return enginePromise
}

function resumeLoaded() {
  if (state.pendingRace) return launch('race',state.pendingRace.mode)
  if (state.position.scene === 'road') return launch('road','free',state.position)
  return launch('garage')
}

async function launch(next: Exclude<Place,'menu'>, nextMode: Mode = 'free', resume?: PlayerPosition) {
  const revision = ++launchRevision
  showingIntro = false
  closePanel(false)
  bridge.paused = true
  bridge.resetTouch()
  loading()
  let game: Awaited<ReturnType<typeof makeEngine>>
  try { game = await warmEngine() }
  catch {
    place = 'menu'
    renderTitle()
    toast('El motor gráfico no ha podido iniciarse. Recarga para volver a intentarlo.', true)
    return
  }
  if (revision !== launchRevision) return
  game.scene.stop('garage')
  game.scene.stop('road')
  place = next
  mode = nextMode
  roadHud = null
  trip = {distance:0,damage:0}
  tripDamageReported = 0
  tripDistanceReported = 0
  lastCoach = ''
  lastMap = 0
  gameUi.hidden = true
  const sceneReady = new Promise<boolean>(resolve => {
    let timer = 0
    const unsubscribe = bridge.on(next === 'garage' ? 'garage:ready' : 'road-ready', () => {
      clearTimeout(timer)
      unsubscribe()
      resolve(true)
    })
    timer = window.setTimeout(() => {
      unsubscribe()
      resolve(false)
    },20000)
  })
  if (next === 'garage') {
    if (state.position.scene !== 'garage') state.position = {scene:'garage',...GARAGE_SPAWN}
    game.scene.start('garage',garageData())
  } else {
    const initial = resume ? {x:resume.x,y:resume.y,angle:resume.angle} : cityMap.garage
    if (next === 'road') state.position = {scene:'road',...initial}
    game.scene.start('road',{mode,tuning:carTuning(activeCar(state)),resume:next === 'road' ? resume : undefined, routeVariant:next === 'race' ? state.pendingRace?.variant : undefined})
  }
  const sceneLoaded = await sceneReady
  if (revision !== launchRevision) return
  if (!sceneLoaded) {
    showTitle()
    toast('La escena no pudo cargarse. Puedes volver a abrir la partida.',true)
    return
  }
  bridge.paused = false
  audio.scene(next)
  front.hidden = true
  renderHud()
  commit()
}

function showTitle() {
  ++launchRevision
  void enginePromise?.then(game => { game.scene.stop('road'); game.scene.stop('garage') })
  closePanel(false)
  place = 'menu'
  showingIntro = false
  gameUi.hidden = true
  audio.scene('menu')
  audio.levels(settingsInMenu.music,settingsInMenu.sfx)
  renderTitle()
}

function renderHud() {
  gameUi.hidden = false
  gameUi.dataset.place = place
  if (import.meta.env.DEV) Object.assign(gameUi.dataset,{x:state.position.x,y:state.position.y,near:''})
  const isDriving = place === 'road' || place === 'race'
  const raceDatum = (symbol: string, label: string, key: string, value = '—', labelKey?: string) =>
    '<div class="race-datum">' + icon(symbol, 14) + '<small' + (labelKey ? ' data-hud="' + labelKey + '"' : '') + '>' + label +
    '</small><strong data-hud="' + key + '">' + value + '</strong></div>'
  gameUi.innerHTML = '<div class="game-top"><div class="game-location"><i class="mark">' + icon(place === 'race' ? 'flag' : place === 'road' ? 'location' : 'garage',15) +
    '</i><div><strong class="game-label" data-hud="location">' + (place === 'garage' ? 'Night Garage' : place === 'race' ? RACES[mode as RaceMode].subtitle : 'Puerto Umbral') +
    '</strong><small data-hud="detail">' + (place === 'garage' ? LEVELS[state.level-1].name : isDriving ? MODELS[activeCar(state).model].name : '') +
    '</small></div></div><div class="game-bank"><div title="Dinero disponible">' + icon('wallet', 15) + '<strong data-hud="money"></strong></div><div title="Reputación">' + icon('medal', 14) + '<span data-hud="rep"></span></div></div><div class="game-buttons">' +
    iconButton('map','open:map','Mapa (M)') + iconButton('bag','open:inventory','Inventario (I)') +
    iconButton('pause','open:pause','Pausa (Escape)') +
    '</div></div><div id="coach" class="coach" hidden></div><aside class="station-tip" id="station-tip" hidden></aside><div class="prompt" data-hud="prompt" hidden></div>' +
    (isDriving ? '<div class="race-strip" ' + (place === 'race' ? '' : 'hidden') + '>' + raceDatum('clock','Tiempo','time','00:00.00') +
      raceDatum('medal','Puesto','rank') + raceDatum('location','Control','cp') + raceDatum('route','Vuelta','extra','—','extra-label') +
      '</div><div class="countdown" data-hud="countdown" hidden></div><canvas class="minimap" width="180" height="120" aria-label="Minimapa"></canvas>' +
      '<div class="drive-gauges"><div class="dashboard-gauge" data-hud="speed-gauge"><div class="dashboard-readout"><strong class="speed-number"><span data-hud="speed">0</span><small>KM/H</small></strong>' +
      '<span class="drive-gear" data-hud="gear" title="Marcha">N</span></div><div class="dashboard-arc" aria-hidden="true"></div></div>' +
      '<div class="drive-detail" title="Nitro">' + icon('flash', 14) + '<progress data-hud="nitro" max="100" value="100" aria-label="Nitro"></progress></div>' +
      '<div class="drive-detail" title="Daños">' + icon('warning', 14) + '<progress data-hud="damage-meter" max="100" value="0" aria-label="Daños"></progress><span class="visually-hidden" data-hud="damage">Daños 0 %</span></div></div>' : '') +
    '<div class="game-controls"><span class="key">WASD</span>' + (isDriving ? '<span>Conducir</span><span class="key">Espacio</span><span>Derrapar</span><span class="key">Shift</span><span>Nitro</span>' : '<span>Mover</span><span class="key">E</span><span>Interactuar</span>') +
    '</div><div class="touch-controls"><div>' + ['up','left','down','right'].map(direction => '<button class="touch-' + direction + '" data-touch="' + direction + '" aria-label="' + ({up:'Arriba',left:'Izquierda',down:'Abajo',right:'Derecha'})[direction as 'up'] + '">' + icon(direction,16) + '</button>').join('') +
    '</div><div class="touch-actions"><button data-touch="interact" aria-label="Interactuar">E</button>' +
    (isDriving ? '<button data-touch="boost" aria-label="Nitro">' + icon('flash',16) + '</button><button data-touch="handbrake" aria-label="Freno de mano">' + icon('dash',16) + '</button>' : '') + '</div></div>'
  if (isDriving) {
    const map = gameUi.querySelector<HTMLCanvasElement>('.minimap')
    if (map) drawMap(map)
  }
  refreshCoach()
  refreshBank()
}

const hud = (key: string) => gameUi.querySelector<HTMLElement>('[data-hud="' + key + '"]')
function setHud(key: string, value: string) {
  const element = hud(key)
  if (element && element.textContent !== value) element.textContent = value
}

function refreshBank() {
  setHud('money',euro(state.money))
  setHud('rep',String(state.rep))
  hud('rep')?.setAttribute('aria-label',state.rep+' de reputación')
  if (place === 'garage') setHud('detail',LEVELS[state.level-1].name)
}

function refreshCoach() {
  const coach = document.querySelector<HTMLElement>('#coach')
  if (!coach) return
  const practicing = place === 'road' && drill !== null
  const showingStep = !state.tutorial.skipped && !!TUTORIAL[state.tutorial.step] && place !== 'race'
  coach.hidden = !practicing && !showingStep
  if (coach.hidden) return
  const key = practicing ? 'practice:' + drill : String(state.tutorial.step)
  if (key === lastCoach) return
  lastCoach = key
  coach.innerHTML = practicing ? drivingDrill(drill!) : coachStep(state.tutorial.step)
}

function updateDrill(data: RoadHUD) {
  if (drill === null) return
  const done = [
    data.speed >= 25 && data.gear > 0,
    data.gear < 0 && data.speed >= 8,
    data.boosting && data.gear > 0,
    data.handbrake && data.gear > 0 && data.speed > 25 && data.slip > .16,
  ][drill]
  if (!done) return
  drill++
  if (drill === drillCount) {
    drill = null
    audio.play('success')
    toast('Práctica de conducción completada.')
  }
  refreshCoach()
}

function updatePrompt(label?: string) {
  const prompt = hud('prompt')
  if (!prompt) return
  prompt.hidden = !label
  if (label && prompt.dataset.label !== label) {
    prompt.dataset.label = label
    prompt.innerHTML = '<span class="key">E</span>' + safe(label)
  }
}

function updateRoad(data: RoadHUD) {
  if (place !== 'road' && place !== 'race') return
  const previousRoad = roadHud
  roadHud = data
  if (data.zone && place === 'road') setHud('location',data.zone)
  if (data.courseName && place === 'race') setHud('detail',data.courseName)
  updatePrompt(data.prompt)
  setHud('speed',String(Math.round(data.speed)))
  setHud('damage','Daños ' + Math.round(data.damage) + ' %')
  setHud('gear',data.gear > 0 ? 'M' + data.gear : data.gear < 0 ? 'R' : 'N')
  const progress = hud('nitro') as HTMLProgressElement | null
  if (progress) progress.value = data.nitro
  hud('speed-gauge')?.style.setProperty('--speed-fill',Math.min(100,data.speed/2.6)+'%')
  const damage = hud('damage-meter') as HTMLProgressElement | null
  if (damage) damage.value = data.damage
  setHud('time',time(data.time))
  setHud('rank',data.total > 1 ? data.position+'/'+data.total : '—')
  setHud('cp',Math.min(data.checkpoint,data.checkpoints)+'/'+data.checkpoints)
  setHud('extra-label',data.mode === 'drift' ? 'DERRAPE' : 'VUELTA')
  setHud('extra',data.mode === 'drift' ? String(Math.round(data.drift)) : data.lap+'/'+data.laps)
  const count = hud('countdown')
  if (count) {
    count.hidden = !data.countdown || Number(data.countdown) < 0
    const text = typeof data.countdown === 'string' ? (data.countdown === 'GO' ? '¡Sal!' : data.countdown) : String(Math.ceil(data.countdown))
    if (count.textContent !== text) { count.textContent = text; if (!count.hidden) audio.play('start') }
  }
  if (import.meta.env.DEV) {
    const next = data.minimap?.next
    Object.assign(gameUi.dataset,{
      x:data.x,y:data.y,angle:data.angle,targetX:data.minimap?.target?.x ?? '',targetY:data.minimap?.target?.y ?? '',
      nextX:next?.x ?? '',nextY:next?.y ?? '',speed:data.speed,checkpoint:data.checkpoint,countdown:data.countdown,
    })
  }
  const car = activeCar(state)
  audio.boost(data.nitro < (previousRoad?.nitro ?? 0) && data.speed > 10)
  audio.drive(data.speed,data.throttle,data.slip,data.gear,car.model)
  const map = gameUi.querySelector<HTMLCanvasElement>('.minimap')
  if (map && data.minimap && performance.now()-lastMap > 125) {
    lastMap = performance.now()
    drawMap(map,data.minimap)
  }
  if (place === 'road') {
    trip.distance = data.distance !== undefined ? Math.max(0,data.distance-tripDistanceReported) : trip.distance + (previousRoad ? Math.hypot(previousRoad.x-data.x,previousRoad.y-data.y) : 0)
    trip.damage = Math.max(0,data.damage-tripDamageReported)
    state.position = { scene:'road', x:data.x, y:data.y, angle:data.angle }
    updateDrill(data)
    if (data.speed > 8 && advanceTutorial(state,'drive')) { commit(); refreshCoach() }
  }
}

function toast(message: string, error = false) {
  clearTimeout(toastTimer)
  const block = document.createElement('div')
  block.className = 'toast' + (error ? ' error' : '')
  block.textContent = message
  toastRoot.replaceChildren(block)
  toastTimer = window.setTimeout(() => toastRoot.replaceChildren(), 3900)
}

function row(title: string, detail: string, action = '', symbol?: string) {
  return '<div class="row">' + (symbol ? '<span class="row-icon">' + icon(symbol, 19) + '</span>' : '') +
    '<div class="row-label"><strong>' + safe(title) + '</strong>' + (detail ? '<p>' + detail + '</p>' : '') + '</div>' + action + '</div>'
}
function stat(label: string, value: string) {
  return '<div class="stat"><span class="stat-icon">' + statIcon(label) + '</span><div><span class="micro">' + safe(label) +
    '</span><strong>' + safe(value) + '</strong></div></div>'
}
function dialogue(speaker: string, message: string) {
  return '<div class="dialogue"><span class="face">' + icon('user',18) + '</span><div><strong>' + safe(speaker) + '</strong><p>' + safe(message) + '</p></div></div>'
}
const actions = (...controls: string[]) => '<div class="actions">'+controls.join('')+'</div>'
const rows = (content: string[]) => '<div class="rows">'+content.join('')+'</div>'
const currentJob = () => JOBS.find(item => item.id === state.job?.id)

function openPanel(next: Panel) {
  if (!panel) returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  if (panel === 'work') repairCleanup()
  repairCleanup = () => {}
  if (next === 'paint' && panel !== 'paint') {
    previewColor = null
    previewMods = {}
  }
  panel = next
  front.inert = true
  gameUi.inert = true
  bridge.paused = true
  bridge.resetTouch()
  if (place === 'road' || place === 'race') { audio.boost(false); audio.drive(0,0,0,0) }
  renderModal()
}

function closePanel(restore = true) {
  if (panel === 'result' && restore) { void launch('garage'); return }
  repairCleanup()
  repairCleanup = () => {}
  panel = null
  modalRoot.replaceChildren()
  front.inert = false
  gameUi.inert = false
  bridge.paused = false
  if (restore && returnFocus?.isConnected) returnFocus.focus()
  returnFocus = null
}

function renderModal(focus = true) {
  if (!panel) return
  const previousTop = focus ? 0 : modalRoot.querySelector('.sheet-body')?.scrollTop ?? 0
  const previous = !focus && document.activeElement instanceof HTMLElement && modalRoot.contains(document.activeElement) ? document.activeElement : null
  const focusAttribute = previous?.hasAttribute('data-preview') ? 'data-preview' : 'data-action'
  const focusValue = previous?.getAttribute(focusAttribute)
  const {title,category,body,narrow} = panelContent(panel)
  modalRoot.innerHTML = '<div class="modal-backdrop"><section class="sheet' + (narrow ? ' narrow':'') +
    '" role="dialog" aria-modal="true" aria-labelledby="panel-title" tabindex="-1"><header><div><span class="eyebrow">' + safe(category) +
    '</span><h2 id="panel-title">' + safe(title) + '</h2></div>' + iconButton('x','close','Cerrar') + '</header><div class="sheet-body">' +
    body + '</div></section></div>'
  const inner = modalRoot.querySelector<HTMLElement>('.sheet-body')!
  inner.scrollTop = previousTop
  renderPanelMap()
  if (panel === 'work') {
    repairCleanup()
    repairCleanup = mountRepair(inner,currentPart,state.level,quality => {
      const finished = applied(repairCar(state,currentPart,quality),false)
      if (finished) {
        audio.play('success')
        bridge.emit('garage-effect',{id:parentRepair,kind:'repair'})
      }
      openPanel(parentRepair)
    })
  }
  if (focus) modalRoot.querySelector<HTMLElement>('.sheet')?.focus()
  else if (focusValue) modalRoot.querySelector<HTMLElement>('['+focusAttribute+'="'+CSS.escape(focusValue)+'"]:not(:disabled)')?.focus({preventScroll:true})
}

function renderPanelMap() {
  const overview = modalRoot.querySelector<HTMLCanvasElement>('.overview-map')
  if (overview) drawMap(overview,roadHud?.minimap,true)
  const preview = modalRoot.querySelector<HTMLCanvasElement>('.course-preview')
  if (preview) {
    const course = upcomingCourse()
    const [start, next] = course.points
    const angle = Math.atan2(next.y-start.y,next.x-start.x)*180/Math.PI
    drawMap(preview,{...cityMap,player:{...start,angle},rivals:[],course:course.points},true)
  }
}

function upcomingCourse() {
  const variant = state.pendingRace?.mode === pendingMode ? state.pendingRace.variant : state.nextRaceVariants[pendingMode]
  const courses = RACE_COURSES[pendingMode]
  return courses[variant ?? 0] ?? courses[0]
}

function panelContent(target: Panel): {title:string;category:string;body:string;narrow?:boolean} {
  const car = activeCar(state)
  const model = MODELS[car.model]
  const tone = (title:string,category:string,body:string,narrow=false) => ({title,category,body,narrow})
  const open = (label:string, panel: Panel, symbol?:string) => button(label,'open:'+panel,{icon:symbol})
  const inspect = () => '<div class="component-grid">' + COMPONENT_KEYS.map(key => {
    const part = COMPONENTS[key]
    return row(part.name,conditionGauge(car.condition[key],part.name),undefined,componentIcon[key])
  }).join('') + '</div>'
  const stock = (key: ComponentKey) => '<span class="stock-count" title="Recambios en inventario">' + icon('box', 13) + ' × ' + state.parts[key] + '</span>'

  switch (target) {
    case 'slots':
    case 'new-slots':
      return tone(target === 'slots' ? 'Partidas guardadas' : 'Nueva partida','Guardado local',rows(slots.map((save, index) => {
        const id = index+1
        const date = save ? new Date(save.updatedAt).toLocaleString('es-ES',{ dateStyle:'short',timeStyle:'short' }) : ''
        return row('Ranura '+id,save ? safe(MODELS[save.activeModel].name) + ' · Nivel '+save.level+' · '+euro(save.money)+' <span class="micro">'+safe(date)+'</span>' : 'Vacía',
          button(target === 'new-slots' ? (save ? 'Reemplazar' : 'Empezar') : save ? 'Cargar' : 'Empezar', (target === 'new-slots' || !save ? 'new-slot:' : 'load-slot:')+id, {kind:!save?'primary':'secondary'}) +
          (target === 'slots' ? ' ' + button('Importar','import:'+id) : ''))
      })),true)
    case 'overwrite':
      return tone('Reemplazar partida','Ranura '+overwriteSlot,'<p>La partida que ocupa esta ranura se sustituirá por una nueva.</p>' +
        actions(button('Reemplazar','confirm-new',{kind:'danger'}),open('Volver','new-slots')),true)
    case 'settings': {
      const settings = runActive && place !== 'menu' ? state.settings : settingsInMenu
      const slider = (field: 'music' | 'sfx', name: string) => '<label class="settings-line"><span>' + name +
        '</span><input type="range" min="0" max="1" step=".01" data-setting="' + field + '" value="' + settings[field] +
        '"><output>' + Math.round(settings[field]*100) + ' %</output></label>'
      return tone('Ajustes','Audio y pantalla',slider('music','Música')+slider('sfx','Efectos') +
        '<label class="settings-line"><span>Calidad gráfica</span><select class="option-select" data-setting="quality"><option value="high"' +
        (settings.quality === 'high' ? ' selected' : '') + '>Alta</option><option value="low"' + (settings.quality === 'low' ? ' selected' : '') +
        '>Baja</option></select></label><br>' + actions(button('Pantalla completa','fullscreen',{icon:'expand'})),true)
    }
    case 'pause':
      return tone('En pausa', place === 'garage' ? 'Night Garage' : 'Puerto Umbral',
        '<div class="pause-grid">'+button('Reanudar','close',{kind:'primary',icon:'play'})+open('Ajustes','settings','settings')+open('Mapa','map','map')+
        open('Inventario','inventory','bag')+open('Misiones','missions','flag')+open('Estadísticas','statistics','dash')+
        open('Guía de taller','tutorial','wrench')+button('Guardar partida','save',{icon:'folder'})+button('Exportar partida','export',{icon:'folder'})+
        (place === 'race' ? open('Abandonar carrera','abandon','back') : open('Menú principal','menu-confirm','back'))+'</div>',true)
    case 'inventory':
      return tone('Inventario','Recambios y llaves',rows(COMPONENT_KEYS.filter(key => state.parts[key] > 0).map(key => row(COMPONENTS[key].part,
        stock(key),undefined,componentIcon[key]))) + (COMPONENT_KEYS.every(key => !state.parts[key]) ? '<p class="empty-inventory">' + icon('box', 26) + 'Compra recambios en el almacén o en Overdrive.</p>' : '') +
        '<h3>Vehículo activo</h3>'+carImage(car.model,car.color,car.mods)+row(model.name,number(Math.round(car.km))+' km · Depósito '+Math.floor(car.fuel)+' %',undefined,'car'),true)
    case 'map':
      return tone('Puerto Umbral','Mapa de la ciudad','<canvas class="overview-map" width="900" height="570" aria-label="Mapa de Puerto Umbral"></canvas><ul class="city-key">' +
        CITY_LEGEND.map(item => '<li><i style="--pin:'+item.color+'"></i>'+safe(item.name)+'</li>').join('')+'</ul>')
    case 'missions':
      return tone('Misiones','Historia y encargos',storyChapters(state.level) +
        '<div class="card"><h3>Encargo activo</h3><p>' +
        (currentJob() ? safe(currentJob()!.name)+(state.job?.ready?' · Listo para entregar':' · '+safe(COMPONENTS[currentJob()!.component].part)) : 'Consulta los encargos en el ordenador del taller.') +
        '</p></div>' + actions(open('Consultar tutorial','tutorial','wrench')))
    case 'story': {
      const last = storyIndex === storyLength(storyChapter)-1
      return tone(storyTitle(storyChapter),'Capítulo '+storyChapter,storyFrame(storyChapter,storyIndex,
        button(last ? 'Volver a misiones' : 'Siguiente escena',last ? 'open:missions' : 'story-next',{kind:'primary',icon:last?'back':'play'}) +
        (storyIndex > 0 ? button('Escena anterior','story-previous',{icon:'left'}) : '')))
    }
    case 'statistics': {
      const records = Object.values(RACES).flatMap(race => {
        const routes = RACE_COURSES[race.mode].flatMap((course,index) => {
          const best = state.stats.routeRecords[race.mode]?.[index]
          return best ? [row(course.name,safe(race.name)+' · '+time(best.time))] : []
        })
        const legacy = state.stats.records[race.mode]
        return routes.length ? routes : legacy ? [row(race.name,time(legacy.time))] : []
      })
      return tone('Estadísticas','Piloto y taller','<div class="stats-block">'+stat('Reputación',number(state.rep))+stat('Experiencia',number(state.xp))+
        stat('Carreras',number(state.stats.races))+stat('Victorias',number(state.stats.wins))+stat('Reparaciones',number(state.stats.repairs))+
        stat('Kilómetros',number(Math.round(state.stats.distance/100)/10))+stat('Ingresos',euro(state.stats.earned))+
        stat('Gastos',euro(state.stats.spent))+stat('Colección',state.collection.length+' / '+MODELS.length)+'</div><h3>Mejores tiempos</h3>'+
        rows(records.length ? records : [row('Sin tiempos registrados','')])+
        '<br><h3>Logros</h3>'+rows(ACHIEVEMENTS.map(item=>row(item.name,safe(item.description)+(state.achievements.includes(item.id)?' · <span class="highlight">Conseguido</span>':' · '+euro(item.reward))))))
    }
    case 'lift':
      return tone(model.name,'Elevador · '+model.kind,carImage(car.model,car.color,car.mods)+
        '<div class="stats-block">'+stat('Km',number(Math.round(car.km)))+stat('Potencia',model.power+' CV')+stat('Tracción',model.drive)+'</div>'+
        (TUTORIAL[state.tutorial.step]?.event === 'inspect' && !state.tutorial.skipped ?
          dialogue('Mara',STORY[0].line)+actions(button('Inspeccionar el Kairo','inspect',{kind:'primary',icon:'wrench'})) :
          '<h3>Estado de los componentes</h3>'+inspect()))
    case 'diagnostic':
      return tone('Diagnóstico','Escáner electrónico',carImage(car.model,car.color,car.mods)+
        (currentJob() && !state.job?.ready ? '<p>Encargo activo · '+safe(currentJob()!.name)+'</p>' : '') +
        (car.condition.battery < 30 ? dialogue('Mara','El escáner marca menos de 12 V. En el almacén queda una batería compatible.') : '<p>Sistema de arranque en servicio. Revisa el desgaste para planificar la próxima reparación.</p>')+
        actions(button('Ejecutar diagnóstico','diagnose',{kind:'primary',icon:'flash'}))+'<br>'+inspect())
    case 'parts': {
      const keys = [...COMPONENT_KEYS]
      if (TUTORIAL[state.tutorial.step]?.event === 'buy') keys.sort((a,b) => Number(b === 'battery') - Number(a === 'battery'))
      return tone('Recambios','Almacén',rows(keys.map(key => {
        const part = COMPONENTS[key]
        return row(part.part,stock(key),button(state.level < part.minLevel ? 'Nivel '+part.minLevel : euro(part.price),'buy-part:'+key,
          {kind:key === 'battery' && TUTORIAL[state.tutorial.step]?.event === 'buy' ? 'primary':'secondary',
            disabled:state.level < part.minLevel || state.money < part.price,title:'Comprar '+part.part,icon:state.level < part.minLevel ? 'lock' : 'plus'}),componentIcon[key])
      })))
    }
    case 'tools':
    case 'engine': {
      const job = currentJob()
      const allKeys = target === 'engine' ? ['engine','oil','turbo','gearbox','suspension'] as const : COMPONENT_KEYS
      const priority = TUTORIAL[state.tutorial.step]?.event === 'repair' ? 'battery' : job?.component
      const keys = [...allKeys].sort((a,b)=>Number(b===priority)-Number(a===priority))
      return tone(target === 'engine' ? 'Banco de motores' : 'Banco de herramientas','Reparación',
        (job && !state.job?.ready ? dialogue(job.client,job.line) : '')+rows(keys.map(key => {
          const customer = job?.component === key && !state.job?.ready
          return row(COMPONENTS[key].name, '<span class="repair-row-status">' +
            (customer ? 'Coche de '+safe(job!.client) : conditionGauge(car.condition[key],COMPONENTS[key].name)) + stock(key) + '</span>',
            button(state.parts[key] ? 'Montar' : 'Sin recambio','work:'+key,{kind:key === priority ? 'primary':'secondary',
              disabled:!state.parts[key] || (!customer && car.condition[key] >= 100),title:'Reparar '+COMPONENTS[key].name,icon:'wrench'}),componentIcon[key])
        })))
    }
    case 'paint': {
      const proposed = previewColor ?? car.color
      const colorOption = CUSTOMIZATIONS.color.options.find(item => item.value === proposed)
      const swatches = CUSTOMIZATIONS.color.options.map(option => '<button class="swatch" aria-label="'+safe(option.label)+'" aria-pressed="'+(proposed===option.value)+
        '" title="'+safe(option.label)+'" style="--swatch:'+rgb(option.value)+'" data-action="swatch:'+option.value+'"></button>').join('')
      const other = CUSTOMIZATION_KEYS.filter(key => key !== 'color').map(key => {
        const details = CUSTOMIZATIONS[key]
        const proposedMod = previewMods[key] ?? car.mods[key]
        const choice = details.options.find(option => option.value === proposedMod)
        const select = '<select class="option-select" aria-label="'+safe(details.name)+'" data-preview="'+key+'">'+details.options.map(option =>
          '<option value="'+option.value+'"'+(option.value===proposedMod?' selected':'')+(option.minLevel>state.level?' disabled':'')+'>'+safe(option.label)+(option.minLevel>state.level?' · N'+option.minLevel:'')+'</option>').join('')+'</select>'
        return row(details.name,'Instalado · '+safe(details.options.find(option=>option.value===car.mods[key])?.label ?? 'De serie'),select+
          button(choice ? euro(choice.price) : '—','mod:'+key+':'+proposedMod,{disabled:proposedMod===car.mods[key] || !choice || choice.price>state.money,title:'Instalar '+details.name}))
      })
      return tone('Personalización','Cabina de pintura','<div class="design-station"><div class="design-look"><h3>'+safe(model.name)+'</h3>'+
        carImage(car.model,proposed,{...car.mods,...previewMods})+'<div class="swatches">'+swatches+'</div>'+
        button('Aplicar color'+(colorOption ? ' · '+euro(colorOption.price):''),'apply-paint',{kind:'primary',disabled:proposed===car.color || !colorOption || colorOption.price>state.money})+
        '</div>'+rows(other)+'</div>')
    }
    case 'parking':
      return tone('Aparcamiento','Tus vehículos',rows(state.cars.map(owned=>row(MODELS[owned.model].name,
        number(Math.round(owned.km))+' km · '+euro(carValue(owned))+' · Depósito '+Math.floor(owned.fuel)+' %',
        button(owned.id===car.id?'En uso':'Elegir','select-car:'+owned.id,{disabled:owned.id===car.id,kind:'primary'})+' '+
        button('Vender','sell:'+owned.id,{disabled:state.cars.length<=1}))))+
        actions(open('Mercado','market','folder'),open('Repostar','fuel','flash')))
    case 'sell-confirm': {
      const owned = state.cars.find(item => item.id === currentSaleId)
      return tone('Confirmar venta','Aparcamiento',owned ? '<p>Vender <strong>'+safe(MODELS[owned.model].name)+'</strong> por <span class="currency">'+euro(carValue(owned))+'</span>.</p>'+
        actions(button('Vender coche','confirm-sell',{kind:'primary'}),open('Volver','parking')) : '<p>El coche ya no está disponible.</p>',true)
    }
    case 'exit':
      return tone('Portón de salida','Puerto Umbral',dialogue('Mara','Los del sprint se juntan junto al bulevar industrial. Hay sitio para probar el coche antes de correr.')+
        (!canDrive(state).ok?'<p class="highlight">'+safe(canDrive(state).message)+'</p>':'')+
        actions(button('Conducir por la ciudad','drive',{kind:'primary',icon:'dash',disabled:!canDrive(state).ok}),open('Ver carreras','races','flag')),true)
    case 'management': {
      const level = LEVELS[state.level-1]
      const next = LEVELS[state.level]
      const job = currentJob()
      return tone('Gestión del taller','Ordenador de Night Garage',actions(button('Ver capítulo '+state.level,'story:'+state.level,{icon:'play'}))+
        '<div class="stats-block">'+stat('Caja',euro(state.money))+stat('Reputación',number(state.rep))+stat('Nivel',state.level+' / 5')+'</div>'+
        '<div class="split"><div class="card"><h3>'+safe(level.name)+'</h3><p>'+safe(next ? next.description : level.description)+'</p>'+
        (next ? button('Ampliar taller · '+euro(next.cost),'upgrade',{kind:'primary',disabled:state.money<next.cost || state.rep<next.rep,icon:'wrench'})+
          '<p class="how-to" style="margin-top:8px">Requiere '+next.rep+' de reputación</p>' : '<p class="highlight">Nivel máximo</p>')+'</div><div class="card"><h3>Encargos</h3>'+
        (job ? '<p>'+safe(job.client)+' · '+safe(job.name)+'</p>'+ (state.job?.ready ?
          button('Entregar · '+euro(job.pay),'claim-job',{kind:'primary'}) : '<p>Pendiente: '+safe(COMPONENTS[job.component].part)+'</p>') :
          rows(JOBS.filter(item=>item.minLevel<=state.level).map(item=>row(item.client,safe(item.name)+' · '+euro(item.pay),button('Ver','job:'+item.id)))))+
        '</div></div><br>'+actions(open('Mercado','market','folder'),open('Carreras','races','flag'),open('Estadísticas','statistics','dash')))
    }
    case 'job': {
      const job = JOBS.find(item => item.id === currentJobId)
      return tone(job?.name ?? 'Encargo','Cliente',job ? dialogue(job.client,job.line)+
        '<div class="stats-block">'+stat('Premio',euro(job.pay))+stat('Reputación','+'+job.rep)+stat('Pieza',COMPONENTS[job.component].name)+'</div>'+
        actions(button('Aceptar encargo','accept-job:'+job.id,{kind:'primary'}),open('Volver','management')) : '<p>El encargo ya no está disponible.</p>',true)
    }
    case 'market':
      return tone('Mercado de segunda mano','Cobalto Motors','<div class="market-list">'+marketOffers(state).map(offer => {
        const details = MODELS[offer.model]
        const locked = details.minLevel > state.level
        return '<article class="card market-car"><div class="market-look">'+carImage(offer.model,offer.car.color)+
          (offer.special ? '<span class="market-discount" title="Descuento">−'+offer.discount+' %</span>' : '')+'</div><h3>'+safe(details.name)+
          '</h3><p class="micro">'+safe(details.kind)+'</p><div class="market-metrics">'+stat('Km',number(Math.round(offer.car.km)))+
          stat('Tracción',details.drive)+stat('Potencia',details.power+' CV')+stat('Peso',details.weight+' kg')+
          stat('Velocidad',details.maxSpeed+' km/h')+stat('0–100',details.acceleration+' s')+'</div>'+
          '<div class="market-condition"><span>Motor</span>'+conditionGauge(offer.car.condition.engine,'Motor')+'<span>Chapa</span>'+conditionGauge(offer.car.condition.body,'Chapa')+'</div>'+
          '<p class="market-value">Valor <strong>'+euro(carValue(offer.car))+'</strong></p>'+
          button(locked ? 'Nivel '+details.minLevel : 'Comprar · '+euro(offer.price),'buy-car:'+offer.id,
            {kind:'primary',disabled:locked || state.money<offer.price,icon:locked?'lock':'wallet'})+'</article>'
      }).join('')+'</div>')
    case 'fuel':
      return tone('Repostar','Combustibles Nox','<div class="stats-block">'+stat('Depósito',Math.floor(car.fuel)+' %')+stat('Hasta lleno',euro(fuelPrice(state)))+'</div>'+
        actions(button('Llenar depósito','fuel',{kind:'primary',icon:'flash',disabled:fuelPrice(state)===0 || fuelPrice(state)>state.money})),true)
    case 'races': {
      const next = tournamentRace(state)
      return tone('Calendario nocturno','Competiciones',rows(Object.values(RACES).map(race => row(race.subtitle,
        safe(race.name)+' · '+euro(race.fee)+' de entrada · Hasta '+euro(race.prize),button(race.minLevel>state.level?'Nivel '+race.minLevel:'Ver prueba','race:'+race.mode,
          {disabled:race.minLevel>state.level,kind:race.mode==='sprint'?'primary':'secondary'}))))+
        '<br>'+row(TOURNAMENT.name,next ? 'Siguiente ronda · '+safe(RACES[next].subtitle) : 'Tres pruebas · '+euro(TOURNAMENT.fee),
          button(next?'Siguiente ronda':state.level<TOURNAMENT.minLevel?'Nivel '+TOURNAMENT.minLevel:'Inscribirse',next?'race:'+next:'tournament',
            {disabled:!next && state.level<TOURNAMENT.minLevel,icon:'medal'})))
    }
    case 'race-preview': {
      const race = RACES[pendingMode]
      const course = upcomingCourse()
      return tone(race.subtitle,race.name,'<div class="course-header">'+icon('route',22)+'<strong>'+safe(course.name)+'</strong></div>'+
        '<canvas class="course-preview" width="720" height="360" aria-label="Recorrido '+safe(course.name)+'"></canvas><p>'+safe(race.description)+'</p>'+
        '<div class="stats-block">'+stat('Inscripción',tournamentRace(state)===pendingMode?'Incluida':euro(race.fee))+stat('Premio máximo',euro(race.prize))+
        stat('Nivel',String(race.minLevel))+'</div>'+actions(button('Inscribirse y correr','start-race',{kind:'primary',icon:'flag',disabled:race.minLevel>state.level}),
          open('Calendario','races')))
    }
    case 'result': {
      if (!raceResult) return tone('Resultados','Puerto Umbral','',true)
      const { report,reward,courseName } = raceResult
      const race = RACES[report.mode]
      return tone(!reward.completed ? 'Tiempo agotado' : reward.won ? 'Victoria' : 'Meta cruzada',courseName ?? race.subtitle,
        '<div class="result-score"><b>'+report.position+'º</b><div><strong>'+safe(model.name)+'</strong>'+
        (reward.personalBest?'<p>Nuevo mejor resultado</p>':'')+'</div><i class="result-icon">'+icon(reward.won?'trophy':'flag',70)+'</i></div>'+
        '<div class="stats-block">'+stat('Crono',time(report.time))+stat('Premio','+'+euro(reward.payout))+stat('Reputación','+'+reward.rep)+
        stat('Daños',Math.round(report.damage)+' %')+stat('Derrape',number(Math.round(report.drift)))+stat('Saldo',euro(state.money))+'</div>'+
        (reward.tournamentFinished?'<p>Copa de Medianoche completada.</p>':'')+
        (reward.sponsorship?'<p>Patrocinio '+euro(reward.sponsorship)+' · Salarios '+euro(reward.wages)+'</p>':'')+
        actions(button('Volver al taller','result-garage',{kind:'primary',icon:'wrench'}),button('Seguir conduciendo','result-road',{icon:'dash'})),true)
    }
    case 'abandon':
      return tone('Abandonar carrera','Carrera activa','<p>Volverás al taller. La inscripción ya se ha cobrado.</p>'+
        actions(button('Abandonar','abandon',{kind:'danger'}),button('Reanudar','close',{kind:'primary'})),true)
    case 'menu-confirm':
      return tone('Menú principal','Salir al título','<p>Se guardarán tu posición y el progreso de la partida.</p>'+
        actions(button('Guardar y salir','to-menu',{kind:'primary'}),button('Seguir jugando','close')),true)
    case 'work':
      return tone(COMPONENTS[currentPart].name,'Reparación · Estación de trabajo',repairMarkup(currentPart),true)
    case 'tutorial':
      return tone('Guía de taller','Tutorial',guideContent(guideTab,state.tutorial.step,state.tutorial.skipped,place === 'road'))
  }
}

function flushTrip() {
  if (place !== 'road' || (!trip.distance && !trip.damage)) return
  applyDrive(state,trip)
  tripDamageReported += trip.damage
  tripDistanceReported += trip.distance
  trip = {distance:0,damage:0}
}

function startRace() {
  flushTrip()
  if (applied(raceEntry(state,pendingMode),false)) void launch('race',pendingMode)
}

function racePreview(value: string) {
  if (!(value in RACES)) return
  pendingMode = value as RaceMode
  openPanel('race-preview')
}

function storeMenuSettings() {
  try { localStorage.setItem('night-garage-display',JSON.stringify(settingsInMenu)) }
  catch { /* settings remain available for the session */ }
}
function rememberSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('night-garage-display') ?? 'null') as Partial<Settings> | null
    if (!saved || typeof saved !== 'object') return
    if (typeof saved.music === 'number' && saved.music >= 0 && saved.music <= 1) settingsInMenu.music = saved.music
    if (typeof saved.sfx === 'number' && saved.sfx >= 0 && saved.sfx <= 1) settingsInMenu.sfx = saved.sfx
    if (saved.quality === 'low' || saved.quality === 'high') settingsInMenu.quality = saved.quality
  } catch { /* older or unavailable preferences */ }
}

async function transferImport(slot: number, file: File) {
  if (preparing) return
  preparing = true
  try {
    if (file.size > 1024*1024) { toast('El archivo supera 1 MB.',true); return }
    const imported = importSave(await file.text())
    const summary = await saveSlot(slot,imported)
    slots[slot-1] = summary
    renderTitle()
    renderModal(false)
    toast('Partida importada en la ranura '+slot+'.')
  } catch (error) { toast(error instanceof Error ? error.message : 'Archivo de partida no válido.',true) }
  finally { preparing = false }
}

function transferExport() {
  flushTrip()
  const url = URL.createObjectURL(new Blob([exportSave(state)],{type:'application/json'}))
  const link = document.createElement('a')
  link.href = url
  link.download = 'night-garage-ranura-'+selectedSlot+'.json'
  link.click()
  window.setTimeout(()=>URL.revokeObjectURL(url),1000)
  toast('Partida exportada.')
}

function dispatch(action: string) {
  const [what, argument, value] = action.split(':')
  switch (what) {
    case 'open': openPanel(argument as Panel); return
    case 'close': closePanel(); return
    case 'new': {
      if (!slots.some(Boolean)) void startSlot(1,true)
      else openPanel('new-slots')
      return
    }
    case 'new-slot': {
      const id = Number(argument)
      if (slots[id-1]) { overwriteSlot = id; openPanel('overwrite') }
      else void startSlot(id,true)
      return
    }
    case 'confirm-new': void startSlot(overwriteSlot,true); return
    case 'continue': {
      const latest = slots.filter((summary): summary is SlotSummary => !!summary).sort((a,b)=>b.updatedAt-a.updatedAt)[0]
      if (latest) void startSlot(latest.slot,false)
      return
    }
    case 'load-slot': void startSlot(Number(argument),false); return
    case 'intro-next':
      if (introIndex < storyLength(1)-1) { introIndex++; renderIntro() }
      else void launch('garage')
      return
    case 'intro-skip': void launch('garage'); return
    case 'audio-toggle':
      settingsInMenu.music = settingsInMenu.music ? 0 : .55
      audio.levels(settingsInMenu.music,settingsInMenu.sfx)
      storeMenuSettings()
      renderTitle()
      return
    case 'fullscreen': {
      if (document.fullscreenElement) void document.exitFullscreen().catch(()=>toast('No se pudo salir de pantalla completa.',true))
      else if (document.documentElement.requestFullscreen) void document.documentElement.requestFullscreen().catch(()=>toast('Pantalla completa no disponible.',true))
      else toast('Pantalla completa no disponible.',true)
      return
    }
    case 'story': {
      const chapter = Number(argument)
      if (Number.isInteger(chapter) && chapter >= 1 && chapter <= state.level) {
        storyChapter = chapter
        storyIndex = 0
        openPanel('story')
      }
      return
    }
    case 'story-next':
    case 'story-previous':
      storyIndex = Math.max(0,Math.min(storyLength(storyChapter)-1,storyIndex+(what === 'story-next' ? 1 : -1)))
      renderModal()
      return
    case 'guide':
      guideTab = Number(argument)
      renderModal(false)
      return
    case 'guide-practice':
      if (place === 'race') { toast('Puedes practicar en conducción libre.'); return }
      drill = 0
      closePanel()
      refreshCoach()
      if (place === 'garage') toast('Sal por el portón para empezar la práctica.')
      return
    case 'guide-stop':
      drill = null
      refreshCoach()
      return
    case 'skip-tutorial':
      applied(skipTutorial(state))
      if (panel === 'tutorial') renderModal(false)
      return
    case 'resume-tutorial': lastCoach = ''; applied(resumeTutorial(state)); return
    case 'inspect':
      if (advanceTutorial(state,'inspect')) { commit(); refreshWorld() }
      renderModal(false)
      return
    case 'diagnose':
      toast(activeCar(state).condition.battery < 30 ? 'Avería localizada · Batería de 12 V.' : 'Diagnóstico completado.')
      audio.play('tool')
      bridge.emit('garage-effect',{id:'diagnostic',kind:'scan'})
      if (advanceTutorial(state,'diagnose')) { commit(); refreshWorld() }
      return
    case 'buy-part': applied(buyPart(state,argument as ComponentKey)); return
    case 'work':
      currentPart = argument as ComponentKey
      parentRepair = panel === 'engine' ? 'engine' : 'tools'
      openPanel('work')
      return
    case 'end-work': openPanel(parentRepair); return
    case 'work-press': return
    case 'swatch': previewColor = Number(argument); renderModal(false); return
    case 'apply-paint':
      if (previewColor !== null && applied(customizeCar(state,'color',previewColor),false)) {
        previewColor = null
        bridge.emit('garage-effect',{id:'paint',kind:'paint'})
        renderModal(false)
      }
      return
    case 'mod': {
      const key = argument as CustomizationKey
      if (applied(customizeCar(state,key,Number(value)),false)) { delete previewMods[key]; renderModal(false) }
      return
    }
    case 'drive':
      if (applied(canDrive(state),false)) void launch('road')
      return
    case 'race': racePreview(argument); return
    case 'tournament':
      if (applied(startTournament(state),false)) racePreview(tournamentRace(state) ?? 'sprint')
      return
    case 'start-race': startRace(); return
    case 'result-garage': void launch('garage'); return
    case 'result-road': void launch('road','free',raceResult?.finish); return
    case 'abandon':
      applied(abandonRace(state,{distance:roadHud?.distance ?? 0,damage:roadHud?.damage ?? 0}),false)
      void launch('garage')
      return
    case 'save': flushTrip(); commit(true); return
    case 'export': transferExport(); return
    case 'import': {
      const slot = Number(argument)
      if (slots[slot-1] && !window.confirm('¿Reemplazar la partida de la ranura '+slot+' con el archivo importado?')) return
      inputFile.dataset.slot = argument
      inputFile.value = ''
      inputFile.click()
      return
    }
    case 'to-menu': flushTrip(); commit(); showTitle(); return
    case 'buy-car': applied(buyCar(state,argument)); return
    case 'select-car':
      flushTrip()
      if (applied(selectCar(state,argument)) && place === 'road') void launch('road','free',state.position)
      return
    case 'sell': currentSaleId = argument; openPanel('sell-confirm'); return
    case 'confirm-sell':
      flushTrip()
      if (applied(sellCar(state,currentSaleId),false)) {
        if (place === 'road') void launch('road','free',state.position)
        else openPanel('parking')
      }
      return
    case 'fuel': flushTrip(); applied(refuel(state)); return
    case 'upgrade':
      if (applied(upgradeWorkshop(state))) audio.play('success')
      return
    case 'job': currentJobId = argument; openPanel('job'); return
    case 'accept-job':
      if (applied(acceptJob(state,argument),false)) openPanel('management')
      return
    case 'claim-job': applied(claimJob(state)); return
  }
}

app.addEventListener('click',event => {
  const clicked = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-action]') : null
  if (!clicked || clicked.disabled || !clicked.dataset.action) return
  if (clicked.dataset.action !== 'work-press') audio.play('ui')
  dispatch(clicked.dataset.action)
})
app.addEventListener('change',event => {
  const target = event.target
  if (target instanceof HTMLSelectElement && target.dataset.preview) {
    previewMods[target.dataset.preview as CustomizationKey] = Number(target.value)
    renderModal(false)
  }
})
app.addEventListener('input',event => {
  const target = event.target
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement) || !target.dataset.setting) return
  const title = place === 'menu'
  const settings = title ? settingsInMenu : state.settings
  const key = target.dataset.setting
  if (key === 'quality') { settings.quality = target.value === 'low' ? 'low' : 'high'; bridge.quality = settings.quality }
  if (key === 'music' || key === 'sfx') {
    settings[key] = Number(target.value)
    const out = target.parentElement?.querySelector('output')
    if (out) out.value = Math.round(settings[key]*100)+' %'
    audio.levels(settings.music,settings.sfx)
  }
  if (title) storeMenuSettings()
  else commit()
})
inputFile.addEventListener('change',() => {
  const file = inputFile.files?.[0]
  if (file) void transferImport(Number(inputFile.dataset.slot),file)
})

function unlockAudio() {
  void audio.unlock()
}
document.addEventListener('pointerdown',unlockAudio,true)
document.addEventListener('keydown',unlockAudio,true)
document.addEventListener('keydown',event => {
  if (event.repeat || (place !== 'menu' && !front.hidden)) return
  if (event.code === 'Escape') {
    event.preventDefault()
    if (panel) closePanel()
    else if (showingIntro) void launch('garage')
    else if (place !== 'menu') openPanel('pause')
  }
  if (place === 'menu' || panel || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return
  if (event.code === 'KeyM') { event.preventDefault(); openPanel('map') }
  if (event.code === 'KeyI') { event.preventDefault(); openPanel('inventory') }
})

const touchPointers = new Map<number,keyof typeof bridge.touch>()
gameUi.addEventListener('pointerdown',event => {
  const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-touch]') : null
  if (!target || bridge.paused || !target.dataset.touch) return
  event.preventDefault()
  const key = target.dataset.touch as keyof typeof bridge.touch
  target.setPointerCapture(event.pointerId)
  touchPointers.set(event.pointerId,key)
  bridge.touch[key] = true
  if (key === 'interact') bridge.emit('interact:press')
})
function releaseTouch(event: PointerEvent) {
  const key = touchPointers.get(event.pointerId)
  touchPointers.delete(event.pointerId)
  if (key && !Array.from(touchPointers.values()).includes(key)) bridge.touch[key] = false
}
gameUi.addEventListener('pointerup',releaseTouch)
gameUi.addEventListener('pointercancel',releaseTouch)
gameUi.addEventListener('lostpointercapture',releaseTouch)
window.addEventListener('blur',() => { touchPointers.clear(); bridge.resetTouch() })
window.addEventListener('pagehide',() => { flushTrip(); commit() })
document.addEventListener('visibilitychange',() => {
  if (document.hidden && runActive && place !== 'menu') {
    flushTrip()
    commit()
    if (!panel && front.hidden) openPanel('pause')
  }
})
window.setInterval(()=>{ if (place === 'road') { flushTrip(); commit() } },15000)

bridge.on('garage:ready',() => { if (place === 'garage') refreshWorld() })
if (import.meta.env.DEV) {
  bridge.on('garage-coordinates',({x,y}:{x:number;y:number}) => {
    if (place === 'garage') Object.assign(gameUi.dataset,{x,y})
  })
}
bridge.on('move',({x,y}:{x:number;y:number}) => {
  if (place !== 'garage') return
  state.position = {scene:'garage',x,y}
  if (import.meta.env.DEV) Object.assign(gameUi.dataset,{x,y})
  if (advanceTutorial(state,'move')) { commit(); refreshWorld() }
  if (performance.now()-lastGarageSave > 1250) { lastGarageSave = performance.now(); commit() }
})
bridge.on('footstep', () => {
  if (performance.now()-lastStepSound > 125) { audio.play('step'); lastStepSound = performance.now() }
})
bridge.on('near',({id,label}:{id?:Station;label?:string}) => {
  if (place !== 'garage') return
  if (import.meta.env.DEV) gameUi.dataset.near = id ?? ''
  updatePrompt(label)
  if (!id || seenStations.has(id) || state.tutorial.skipped) return
  seenStations.add(id)
  const tip = gameUi.querySelector<HTMLElement>('#station-tip')
  if (!tip) return
  const station = STATIONS[id]
  tip.innerHTML = '<strong>'+safe(station.name)+'</strong><span>'+safe(station.hint)+'</span>'
  tip.hidden = false
  clearTimeout(stationTipTimer)
  stationTipTimer = window.setTimeout(() => { tip.hidden = true },3600)
})
bridge.on('station',({id}:{id:Station}) => {
  if (place !== 'garage' || panel || performance.now()-lastInteraction < 160) return
  lastInteraction = performance.now()
  if (id === 'lift' && advanceTutorial(state,'interact')) { commit(); refreshWorld() }
  if (id === 'pc' && advanceTutorial(state,'manage')) { commit(); refreshWorld() }
  audio.play(id === 'exit' ? 'door' : 'ui')
  openPanel(id === 'pc' ? 'management' : id)
})
bridge.on('road-hud',updateRoad)
bridge.on('road-exit',() => { if (place === 'road') { flushTrip(); void launch('garage') } })
bridge.on('road-race',({mode:next}:{mode:RaceMode}) => { if (place === 'road') racePreview(next) })
bridge.on('road-service',({service}:{service:string}) => {
  if (place !== 'road') return
  const panels: Record<string,Panel> = {fuel:'fuel',market:'market',parts:'parts',scrap:'parts',rivals:'races',parking:'parking'}
  if (panels[service]) openPanel(panels[service])
})
bridge.on('road-hit',() => audio.play('collision'))
bridge.on('road-checkpoint',() => audio.play('ui'))
bridge.on('race-result',(report:RaceReport) => {
  if (place !== 'race' || panel === 'result') return
  const reward = settleRace(state,report)
  const finish: PlayerPosition | undefined = roadHud ? {scene:'road', x:roadHud.x, y:roadHud.y, angle:roadHud.angle} : undefined
  raceResult = {report,reward,finish,courseName:roadHud?.courseName}
  if (reward.won) audio.play('success')
  state.position = {scene:'garage',...GARAGE_SPAWN}
  commit()
  refreshWorld()
  openPanel('result')
})

rememberSettings()
audio.scene('menu')
audio.levels(settingsInMenu.music,settingsInMenu.sfx)
loading()
void refreshSlots().then(() => renderTitle())
