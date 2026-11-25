import { LEVELS, STORY } from './catalog'
import { asset, icon, safe } from './ui'

type Shot = { art: string; title: string; caption: string; effect: 'rain' | 'lights' | 'ignition'; position?: string; speaker?: string }

const prologue: Shot[] = [
  { art: 'title-scene', title: 'Puerto Umbral', caption: 'Cuando acaba el turno del puerto, rugen los motores.', effect: 'rain', position: '67% center' },
  { art: 'story-approach', title: 'Las llaves', caption: 'Tu tío te dejó un taller cerrado, 2.500 € y un Kairo que no arranca.', effect: 'lights' },
  { art: 'story-discovery', title: 'Arranque en frío', caption: 'La persiana sube. El Kairo sigue en el elevador.', effect: 'ignition' },
]

const chapterShots: Shot[][] = [
  prologue,
  [
    { art: 'story-approach', title: 'Vuelve la luz', caption: 'Por primera vez en meses, el letrero se enciende antes de que anochezca.', effect: 'lights' },
    { art: 'story-discovery', title: 'El primer cliente', caption: STORY[1].line, speaker: STORY[1].speaker, effect: 'ignition' },
  ],
  [
    { art: 'story-discovery', title: 'Puesta a punto', caption: 'En el banco quedan las marcas del primer montaje. Ahora hay sitio para preparar un coche de pista.', effect: 'ignition' },
    { art: 'title-scene', title: 'La recta de carga', caption: STORY[2].line, speaker: STORY[2].speaker, effect: 'rain', position: '62% center' },
  ],
  [
    { art: 'story-approach', title: 'El sobre', caption: 'Al cerrar el portón encuentras un sobre bajo la persiana. Lleva el sello de la Copa.', effect: 'lights' },
    { art: 'title-scene', title: 'Copa de Medianoche', caption: STORY[3].line, speaker: STORY[3].speaker, effect: 'rain', position: '70% center' },
  ],
  [
    { art: 'story-discovery', title: 'El último hueco', caption: STORY[4].line, speaker: STORY[4].speaker, effect: 'ignition' },
    { art: 'story-approach', title: 'El próximo turno', caption: 'Colocas las llaves junto a las de tu tío. Al otro lado del portón, el puerto sigue despierto.', effect: 'lights' },
  ],
]

export function storyLength(chapter: number) {
  return chapterShots[chapter - 1].length
}

export function storyTitle(chapter: number) {
  return chapter === 1 ? 'Una noche en Puerto Umbral' : LEVELS[chapter - 1].name
}

export function storyFrame(chapter: number, index: number, controls: string, intro = false) {
  const shots = chapterShots[chapter - 1]
  const shot = shots[index]
  const heading = intro ? 'h1' : 'h3'
  const rain = shot.effect === 'rain'
    ? Array.from({length: 24}, (_, i) => '<i style="--left:' + ((i * 43) % 124) + '%;--delay:' + (-i * .141) + 's;--duration:' + (.55 + (i % 6) * .11) + 's"></i>').join('')
    : ''
  const beats = shots.map((_, i) => '<i' + (i <= index ? ' class="lit"' : '') + '></i>').join('')
  return '<section class="story-frame story-' + shot.effect + '"><div class="story-visual" aria-hidden="true">' +
    '<div class="story-plate" style="--story-art:url(&quot;' + asset('art/' + shot.art + '.png') + '&quot;);--story-focus:' + (shot.position ?? 'center') + '"></div>' +
    '<div class="story-motion">' + rain + '</div><div class="story-matte"></div></div>' +
    '<div class="story-caption"><div class="story-beats" aria-label="Escena ' + (index + 1) + ' de ' + shots.length + '">' + beats + '</div>' +
    (intro ? '<span class="eyebrow">' + storyTitle(1) + '</span>' : '') +
    '<' + heading + '>' + safe(shot.title) + '</' + heading + '>' +
    '<p>' + (shot.speaker ? '<strong>' + safe(shot.speaker) + '</strong> ' : '') + safe(shot.caption) + '</p>' +
    '<div class="story-actions">' + controls + '</div></div></section>'
}

export function storyChapters(level: number) {
  return '<ul class="story-chapters">' + chapterShots.map((_, index) => {
    const chapter = index + 1
    const unlocked = chapter <= level
    return '<li><button class="chapter-card" data-action="story:' + chapter + '"' + (unlocked
      ? ' style="--chapter-art:url(&quot;' + asset('art/' + chapterShots[index][0].art + '.png') + '&quot;)"'
      : ' disabled') + '>' +
      '<span class="chapter-symbol">' + icon(unlocked ? 'play' : 'lock', 24) + '</span><span><small>Capítulo ' + chapter +
      '</small><strong>' + safe(storyTitle(chapter)) + '</strong></span></button></li>'
  }).join('') + '</ul>'
}
