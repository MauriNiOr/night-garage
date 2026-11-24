# Hoja de ruta

La versión 0.1 conecta la llegada a Puerto Umbral, el diagnóstico del Kairo, la compra y el montaje de una batería, la pintura, la conducción, el primer Sprint y la ampliación del taller con el premio.

| Fase | Alcance | Estado |
| --- | --- | --- |
| 1 | Phaser 3, TypeScript, Vite, diseño visual y sonido original | Implementada |
| 2 | Taller cenital con nueve estaciones, animación y cinco estados visuales | Implementada |
| 3 | Tutorial guiado de once pasos, diagnóstico y diez reparaciones con tres tipos de minijuego | Implementada |
| 4 | Conducción arcade, ciudad transitable, tráfico, colisiones, nitro y daños | Implementada |
| 5 | Mercado de 12 modelos, recambios, encargos, personalización, cinco niveles y logros | Implementada |
| 6 | Cinemática en tres escenas, cinco capítulos breves y encargos con diálogo | Implementada en su primera versión |
| 7 | Sprites propios, reflejos, luces, lluvia, chispas y música reactiva | Implementada |
| 8 | Pruebas de dominio, pruebas de navegador y capturas de regresión | Primera ronda completa |
| 9 | Repositorio público y despliegue automatizado en GitHub Actions | Configurado |

## Verificación

- Siete pruebas de dominio cubren economía, encargos, modificaciones, torneo, liquidación de carreras, migraciones y guardados concurrentes.
- Playwright verifica la introducción, el recorrido entre las estaciones, el diagnóstico y la batería, la pintura, el mapa, la exportación e importación de partidas y la salida a conducir en Chromium.
- Cinco pruebas recorren con teclado todos los puntos de control de Sprint, Circuito, Contrarreloj, Drift y Drag. Circuito completa sus dos vueltas. En Sprint se cobra el premio y se amplía el taller después de caminar hasta el ordenador. La Copa se cubre en pruebas de dominio.
- Chrome 158, Edge 158 y Firefox 159 superaron el inicio de partida, el movimiento por el taller, el mapa, el guardado y la recuperación después de recargar.
- La emulación táctil en 390 × 844 confirmó el movimiento y la alineación de la interfaz. El mando estándar se comprobó mediante una entrada simulada. Quedan por probar móviles y mandos físicos.

## Incidencias corregidas

- En navegadores con WebGL por software, la actualización de los gráficos retrasaba la simulación. El motor detecta estas condiciones, usa Canvas y calcula el movimiento con pasos de tiempo acotados.
- En orientación vertical, el lienzo y los controles podían quedar desalineados. Se comprobó su posición mediante una prueba táctil de navegador.
- GitHub Pages podía servir la versión de rama por encima del artefacto de Vite. El workflow comprueba la fuente y espera a la publicación de rama antes de desplegar la compilación.

## Por ampliar

- Añadir trazados independientes, zonas con geografía más variada, más eventos de historia y encargos de varios pasos. Los Montes del Este forman parte de la cuadrícula de la ciudad actual.
- Ampliar la dificultad configurable, la variedad de rivales y los efectos de sus mejoras. El Drag usa cambio automático.
- Diseñar minijuegos propios para cada pieza y ampliar la profundidad de los contratos, patrocinios y restauraciones.
- Medir el objetivo de 60 FPS en varios equipos. El juego activa Canvas si el navegador detecta WebGL por software.
