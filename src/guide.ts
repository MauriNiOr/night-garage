import { RACES, TUTORIAL } from './catalog'
import { button, icon, safe } from './ui'

const stepIcons = ['move','garage','car','battery','box','wrench','paint','dash','flag','desktop','plus']
const stepKeys = [['WASD','↑ ↓ ← →'],['E'],[],[],[],[],[],['WASD','↑ ↓ ← →'],[],['E'],[]]

const lessons = [
  { label: 'Primer turno', icon: 'wrench', cards: [] },
  { label: 'Taller', icon: 'garage', cards: [
    { icon: 'garage', title: 'Encuentra cada estación', text: 'Camina con WASD, flechas o la cruceta. Pulsa E, A en mando o el botón de interacción junto al icono iluminado.' },
    { icon: 'battery', title: 'Inspecciona y diagnostica', text: 'El elevador muestra el estado del coche. Usa el escáner para localizar averías. Compra el recambio en el almacén u Overdrive.' },
    { icon: 'wrench', title: 'Tres formas de montar', text: 'Pulsa los puntos iluminados en orden, sincroniza la aguja con la franja verde o mantén pulsado y suelta dentro de ella. El banco de motores agrupa las piezas mecánicas.' },
    { icon: 'paint', title: 'Personaliza y mejora', text: 'En pintura puedes previsualizar colores, llantas, altura, alerón, parachoques, vinilos y neón. También puedes instalar escape, motor, turbo, frenos, neumáticos y transmisión.' },
  ] },
  { label: 'Conducción', icon: 'dash', cards: [
    { icon: 'move', title: 'Acelera, frena y gira', keys: ['W A S D', '↑ ↓ ← →'], text: 'Mantén S o ↓ al detenerte para dar marcha atrás. En mando usa RT/LT y la palanca izquierda, o los botones de dirección en táctil.' },
    { icon: 'flash', title: 'Dosifica el nitro', keys: ['Mayús', 'B'], text: 'Acelera y activa el nitro en una recta. La barra se recupera al dejar de usarlo.' },
    { icon: 'tire', title: 'Derrapa en una curva', keys: ['Espacio', 'X'], text: 'Gira en marcha, da un toque de freno de mano y suéltalo al apuntar hacia la salida.' },
    { icon: 'map', title: 'Explora Puerto Umbral', keys: ['M','E'], text: 'El mapa indica carreras, comercios y el taller. Reduce la velocidad antes de interactuar. Puedes repostar en Nox y volver al taller por el portón.' },
  ] },
  { label: 'Carreras', icon: 'flag', cards: [
    { icon: 'flag', title: RACES.sprint.name, text: 'Cruza los controles en orden y llega antes que tus rivales.' },
    { icon: 'route', title: RACES.circuit.name, text: 'Completa dos vueltas. El minimapa muestra la ruta de esa inscripción.' },
    { icon: 'clock', title: RACES.time.name, text: 'Supera el tiempo objetivo pasando por todos los controles.' },
    { icon: 'tire', title: RACES.drift.name, text: 'Encadena derrapes sobre el asfalto y acumula puntos antes de la meta.' },
    { icon: 'flash', title: RACES.drag.name, text: 'Acelera en línea recta y aprovecha el nitro.' },
    { icon: 'trophy', title: 'Copa de Medianoche', text: 'Al nivel 4, inscríbete en la Copa y completa sus tres rondas. Cada inscripción cambia el recorrido de la modalidad.' },
  ] },
  { label: 'Negocio', icon: 'wallet', cards: [
    { icon: 'desktop', title: 'Encargos', text: 'Acepta un trabajo en el ordenador, instala la pieza solicitada y vuelve para entregar el coche y cobrar.' },
    { icon: 'garage', title: 'Amplía el taller', text: 'Gana dinero y reputación con encargos y carreras. Invierte desde el ordenador para desbloquear piezas, coches y eventos.' },
    { icon: 'car', title: 'Compra, cambia o vende', text: 'Compara prestaciones y desgaste en Cobalto Motors. Selecciona o vende un vehículo desde el aparcamiento.' },
    { icon: 'trophy', title: 'Estadísticas e historia', text: 'Consulta récords, logros y colección en Estadísticas. En Misiones puedes volver a ver las escenas desbloqueadas.' },
  ] },
  { label: 'Menús', icon: 'settings', cards: [
    { icon: 'map', title: 'Mapa e inventario', keys: ['M','I'], text: 'Revisa servicios, carreras, recambios y el coche activo. También están en la barra superior.' },
    { icon: 'pause', title: 'Pausa y ajustes', keys: ['Esc'], text: 'Abre el menú para ajustar el audio, la calidad gráfica y la pantalla completa. Desde aquí puedes consultar u ocultar la guía.' },
    { icon: 'folder', title: 'Guarda y transfiere', text: 'El juego guarda el progreso localmente. Desde pausa puedes guardar o exportar un JSON e importarlo en una ranura del menú principal.' },
  ] },
] satisfies { label: string; icon: string; cards: { icon: string; title: string; text: string; keys?: string[] }[] }[]

const keysMarkup = (keys: readonly string[] = []) => keys.length
  ? '<span class="guide-keys">' + keys.map(key => '<kbd>' + safe(key) + '</kbd>').join('') + '</span>'
  : ''

export function coachStep(index: number) {
  const step = TUTORIAL[index]
  return '<progress class="coach-progress" value="' + index + '" max="' + TUTORIAL.length + '" aria-label="Progreso del primer turno"></progress>' +
    '<div class="coach-step"><i>' + icon(stepIcons[index], 21) + '</i><div><strong>' + step.title + '</strong>' + keysMarkup(stepKeys[index]) + '</div></div>' +
    '<p>' + step.text + '</p><div class="coach-actions">' +
    '<button class="text-button" data-action="open:tutorial">Ver guía</button><button class="text-button" data-action="skip-tutorial">Omitir tutorial</button></div>'
}

export function guideContent(tab: number, step: number, skipped: boolean, driving: boolean) {
  const selected = lessons[tab]
  const tabs = '<nav class="guide-tabs" aria-label="Temas de la guía">' + lessons.map((lesson, index) =>
    '<button data-action="guide:' + index + '" aria-pressed="' + (tab === index) + '">' + icon(lesson.icon, 19) + '<span>' + lesson.label + '</span></button>').join('') + '</nav>'
  if (tab === 0) {
    return tabs + '<ol class="todos">' + TUTORIAL.map((item, index) =>
      '<li class="' + (index < step ? 'done' : index === step ? 'current' : '') + '">' + icon(index < step ? 'check' : stepIcons[index], 18) +
      '<div><strong>' + item.title + '</strong>' + keysMarkup(stepKeys[index]) + '<div class="how-to">' + item.text + '</div></div></li>').join('') +
      '</ol><div class="actions">' + button(skipped ? 'Activar guía' : 'Ocultar guía', skipped ? 'resume-tutorial' : 'skip-tutorial', {icon:'wrench'}) + '</div>'
  }
  const cards = selected.cards.map(card =>
    '<article class="guide-card"><i>' + icon(card.icon, 24) + '</i><div><h3>' + card.title + '</h3>' + keysMarkup(card.keys) + '<p>' + card.text + '</p></div></article>').join('')
  const practice = tab === 2 ? '<div class="actions">' +
    button(driving ? 'Practicar ahora' : 'Practicar al salir a la ciudad', 'guide-practice', {kind:'primary',icon:'dash'}) + '</div>' : ''
  return tabs + practice + '<div class="guide-grid">' + cards + '</div>'
}

const drills = [
  { icon:'dash', title:'Acelera hasta 25 km/h', keys:['W','↑'] },
  { icon:'back', title:'Da marcha atrás', keys:['S','↓'] },
  { icon:'flash', title:'Usa el nitro al acelerar', keys:['Mayús','B'] },
  { icon:'tire', title:'Derrapa en una curva', keys:['Espacio','X'] },
]

export const drillCount = drills.length

export function drivingDrill(index: number) {
  const drill = drills[index]
  return '<progress class="coach-progress" value="' + index + '" max="' + drillCount + '" aria-label="Progreso de la práctica"></progress>' +
    '<div class="coach-step"><i>' + icon(drill.icon, 21) + '</i><div><strong>' + drill.title + '</strong>' + keysMarkup(drill.keys) + '</div></div>' +
    '<button class="text-button" data-action="guide-stop">Terminar práctica</button>'
}
