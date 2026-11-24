import { audio } from './audio'
import { COMPONENTS } from './catalog'
import type { ComponentKey } from './catalog'
import { button, icon } from './ui'

const tasks: Record<ComponentKey, { mode: 'timing' | 'sequence' | 'hold'; title: string; instruction: string; verb: string }> = {
  battery: { mode: 'sequence', title: 'Conecta el circuito', instruction: 'Conecta los bornes y fija la batería. Sigue el orden de las piezas iluminadas.', verb: 'Conectar' },
  tires: { mode: 'sequence', title: 'Apriete en cruz', instruction: 'Aprieta las tuercas de la rueda en el orden que marca el banco.', verb: 'Apretar' },
  engine: { mode: 'timing', title: 'Ajuste de encendido', instruction: 'Pulsa Espacio o Ajustar cuando la aguja entre en la zona verde.', verb: 'Ajustar' },
  oil: { mode: 'hold', title: 'Llena el cárter', instruction: 'Mantén pulsado Espacio o Llenar y suelta al entrar en la zona verde.', verb: 'Llenar' },
  brakes: { mode: 'sequence', title: 'Purga y presión', instruction: 'Purga los puntos del circuito según el orden marcado.', verb: 'Purgar' },
  suspension: { mode: 'timing', title: 'Calibra el recorrido', instruction: 'Pulsa Espacio o Calibrar cuando la aguja entre en la zona verde.', verb: 'Calibrar' },
  turbo: { mode: 'hold', title: 'Presión de admisión', instruction: 'Mantén pulsado Espacio o Cargar y suelta en la franja verde.', verb: 'Cargar' },
  body: { mode: 'timing', title: 'Endereza la chapa', instruction: 'Cada golpe cuenta. Usa Espacio o Golpear al entrar en la franja verde.', verb: 'Golpear' },
  paint: { mode: 'hold', title: 'Aplica el acabado', instruction: 'Mantén pulsado Espacio o Pintar y suelta con el medidor en verde.', verb: 'Pintar' },
  gearbox: { mode: 'sequence', title: 'Sincroniza las marchas', instruction: 'Asienta las piezas del selector siguiendo el orden iluminado.', verb: 'Asentar' },
}

export function repairMarkup(key: ComponentKey) {
  const task = tasks[key]
  return '<h3>' + task.title + '</h3><p>' + task.instruction + '</p><div class="repair-workbench"><canvas class="repair-part" width="70" height="70" aria-label="' +
    COMPONENTS[key].name + '"></canvas></div>' + (task.mode === 'sequence'
    ? '<div class="repair-nodes">' + [1, 2, 3, 4].map(number => '<button data-node="' + number + '" aria-label="' + task.verb + ' ' + number + '">' + number + '</button>').join('') + '</div>'
    : '<div class="repair-meter"><div class="target"></div><div class="' + (task.mode === 'hold' ? 'fill' : 'cursor') + '"></div></div>') +
    '<p class="repair-feedback" aria-live="polite"></p><div class="actions">' + (task.mode === 'sequence' ? '' : button(task.verb, 'work-press', {kind:'primary',icon:'wrench'})) +
    button('Volver al banco', 'end-work') + '</div>'
}

function paint(ctx: CanvasRenderingContext2D, key: ComponentKey, progress: number, effect: number) {
  ctx.clearRect(0, 0, 70, 70)
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color
    ctx.fillRect(x, y, w, h)
  }
  const path = (points: number[], color: string, width = 1) => {
    ctx.beginPath()
    ctx.moveTo(points[0], points[1])
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1])
    ctx.lineWidth = width
    ctx.strokeStyle = color
    ctx.stroke()
  }
  rect(12, 58, 48, 3, '#080d15')
  if (key === 'battery' || key === 'oil' || key === 'paint') {
    const fluid = key === 'oil' ? '#d6a853' : key === 'paint' ? '#7fbcba' : '#e8a053'
    rect(15, 28, 41, 28, '#10151c')
    rect(14, 27, 43, 6, '#90a1aa')
    rect(17, 32, 39, 22, '#465462')
    rect(19, 34, 35, 15, '#29343f')
    rect(17, 51, 39, 3, '#758491')
    rect(23, 23, 6, 6, '#d2b69c')
    rect(44, 23, 6, 6, '#d2b69c')
    rect(24, 37, 22, 9, '#151e28')
    rect(25, 38, 20, 7, fluid)
    rect(29, 41, 4, 1, '#222833')
    rect(38, 40, 1, 3, '#222833')
    rect(37, 41, 3, 1, '#222833')
    path([26,23,26,13,10,13,10,20], '#dd615c', 2)
    path([47,23,47,10,63,10,63,22], '#67a8b4', 2)
    path([55,32,55,52], '#a4adb2')
  } else if (key === 'tires' || key === 'brakes' || key === 'turbo') {
    for (const [radius, color] of [[25,'#10151c'],[23,'#334151'],[19,'#202833'],[14,'#82939b'],[12,'#526771'],[8,'#b8c4c4'],[4,'#28323c']] as const) {
      ctx.beginPath(); ctx.arc(35,34,radius,0,2*Math.PI); ctx.fillStyle=color; ctx.fill()
    }
    for (let i=0; i<12; i++) {
      const angle = i * Math.PI / 6
      rect(Math.round(35 + 20*Math.cos(angle)), Math.round(34+20*Math.sin(angle)), 2, 2, '#738089')
      if (i%2 === 0) rect(Math.round(35 + 10*Math.cos(angle)), Math.round(34+10*Math.sin(angle)), 2, 2, '#1a252e')
    }
    if(key === 'brakes') { rect(49,24,10,21,'#a84843');rect(50,25,7,4,'#e78765') }
    if(key === 'turbo') { rect(36,10,23,8,'#8aa0a9');rect(53,11,6,6,'#293846') }
  } else if (key === 'body') {
    path([13,46,19,27,46,20,58,34,56,49,36,55,13,46], '#111823', 12)
    path([13,46,19,27,46,20,58,34,56,49,36,55,13,46], '#9e5448', 8)
    path([18,43,23,30,44,25,53,37,50,46,34,50,18,43], '#e68661', 2)
    path([22,39,37,33,47,39], '#613e48', 3)
  } else {
    rect(15,26,40,28,'#10151c')
    rect(17,25,37,25,'#566875')
    rect(20,22,30,10,'#8b9ca0')
    for (let i = 0;i<4;i++) {
      rect(22+i*7,19,4,8,'#c7beb0')
      rect(22+i*7,34,3,12,'#35414d')
      rect(22+i*7,38,4,2,'#a2adb0')
    }
    rect(18,48,35,5,'#748796')
    path([20,30,12,30,12,13,29,13,29,20], '#bb6a56', 3)
    path([48,27,60,27,60,41,52,41], '#4a9aa0', 3)
  }
  if (progress > 0) {
    rect(19,62,32,2,'#3b4852')
    rect(19,62,Math.round(32*progress),2,'#8dcbc2')
  }
  if (effect > 0) {
    for(let i=0;i<10;i++){
      const a=i*2.39
      const r=(1-effect)*18+5+i%4*2
      rect(35 + Math.round(Math.cos(a)*r), 30+Math.round(Math.sin(a)*r),i%2+1,1,i%2?'#ef9d58':'#ffe2a0')
    }
  }
}

export function mountRepair(root: HTMLElement, key: ComponentKey, level: number, complete: (quality: number) => void) {
  const task = tasks[key]
  const context = root.querySelector<HTMLCanvasElement>('.repair-part')?.getContext('2d')
  const feedback = root.querySelector<HTMLElement>('.repair-feedback')!
  const meter = root.querySelector<HTMLElement>('.repair-meter')
  const target = root.querySelector<HTMLElement>('.target')
  const cursor = root.querySelector<HTMLElement>('.cursor')
  const fill = root.querySelector<HTMLElement>('.fill')
  const trigger = root.querySelector<HTMLButtonElement>('[data-action="work-press"]')
  const nodes = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-node]'))
  const sequence = key === 'battery' ? [1,3,2,4] : [1,4,2,3]
  const total = task.mode === 'sequence' ? sequence.length : task.mode === 'timing' ? 3 : 2
  let progress = 0
  let errors = 0
  let position = 0
  let holdAt = 0
  let start = performance.now()
  let lastEffect = -1_000
  let frame = 0
  let wait = 0
  let done = false
  const width = Math.max(.22, .37 - (level - 1) * .025)
  const left = () => [0.34, 0.56, 0.22][progress % 3]
  if (target) target.style.setProperty('--width', width*100+'%')
  const updateNodes = () => {
    for (const node of nodes) {
      const index = sequence.indexOf(Number(node.dataset.node))
      node.classList.toggle('next', index === progress)
      node.classList.toggle('done', index < progress)
      node.disabled = done || index < progress
    }
  }
  const success = () => {
    progress++
    lastEffect = performance.now()
    audio.play('tool')
    feedback.textContent = progress + ' / ' + total + ' · ' + (progress === total ? 'Montaje completo' : 'Bien')
    if (progress === total) {
      done = true
      if (trigger) trigger.disabled = true
      wait = window.setTimeout(() => complete(Math.max(.72,1-errors*.055)), 390)
    }
    updateNodes()
    start = performance.now()
    position = 0
  }
  const fail = () => {
    errors++
    feedback.textContent = task.mode === 'sequence' ? 'Sigue el siguiente punto marcado.' : 'Fuera de la zona. Prueba otra vez.'
    position = 0
    start = performance.now()
    audio.play('ui')
  }
  const execute = () => {
    if (done) return
    if (position >= left() && position <= left()+width) success()
    else fail()
  }
  const begin = () => {
    if (done) return
    if (task.mode === 'timing') execute()
    if (task.mode === 'hold' && !holdAt) holdAt = performance.now()
  }
  const end = () => {
    if (task.mode === 'hold' && holdAt) {
      holdAt = 0
      execute()
    }
  }
  for (const node of nodes) node.addEventListener('click', () => {
    if (done) return
    if (Number(node.dataset.node) === sequence[progress]) success()
    else fail()
  })
  const keydown = (event: KeyboardEvent) => {
    if (event.code !== 'Space' || event.repeat || task.mode === 'sequence') return
    event.preventDefault()
    if (event.target === trigger || !(event.target instanceof HTMLButtonElement)) begin()
  }
  const keyup = (event: KeyboardEvent) => {
    if (event.code === 'Space' && task.mode !== 'sequence') { event.preventDefault(); end() }
  }
  trigger?.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary) return
    trigger.setPointerCapture(event.pointerId)
    begin()
  })
  trigger?.addEventListener('pointerup', end)
  trigger?.addEventListener('pointercancel', () => { holdAt = 0; position = 0 })
  trigger?.addEventListener('click', (event) => {
    if (event.detail === 0 && task.mode === 'timing') execute()
  })
  document.addEventListener('keydown', keydown)
  document.addEventListener('keyup', keyup)
  const draw = (now: number) => {
    if (!done && task.mode === 'timing') {
      const cycle = (now-start)*(0.00042+level*.00005)%2
      position = cycle < 1 ? cycle : 2-cycle
    }
    if (!done && task.mode === 'hold' && holdAt) position = Math.min(1, (now-holdAt)/1350)
    if (meter && target) target.style.setProperty('--left', left()*100+'%')
    if (cursor) cursor.style.left = 'calc(' + (position*100) + '% - 2px)'
    if (fill) fill.style.width = position*100+'%'
    if (context) paint(context,key,progress/total,Math.max(0,1-(now-lastEffect)/450))
    frame = requestAnimationFrame(draw)
  }
  updateNodes()
  frame = requestAnimationFrame(draw)
  return () => {
    cancelAnimationFrame(frame)
    clearTimeout(wait)
    document.removeEventListener('keydown', keydown)
    document.removeEventListener('keyup', keyup)
  }
}
