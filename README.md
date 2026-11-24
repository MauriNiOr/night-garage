# NIGHT GARAGE

Hereda un taller abandonado, 2.500 € y un coche que apenas funciona. Recorre el taller a pie, consigue piezas, repara tu coche y sal a competir por las calles mojadas de la ciudad. Los premios y los encargos de los clientes financian el siguiente turno de trabajo.

Juego de conducción arcade y gestión de taller en pixel art. Funciona en el navegador con Phaser 3, TypeScript y Vite. Las partidas se guardan en IndexedDB y el audio se genera en el navegador.

**[Jugar a NIGHT GARAGE en el navegador](https://maurinior.github.io/night-garage/)**

## Jugar en local

Para trabajar con el código fuente necesitas Node.js 22 o posterior y npm.

```sh
npm ci
npm run dev
```

Abre la dirección que imprime Vite. El código, las tipografías y los gráficos se sirven con el juego. Una vez alojado en un servidor web estático, el jugador solo necesita el navegador.

## Controles

| Tecla | A pie | Al volante |
| --- | --- | --- |
| WASD o flechas | Caminar | Acelerar, frenar, dar marcha atrás y girar |
| E | Interactuar con una estación | Interactuar con un punto de la ciudad |
| Espacio | | Freno de mano |
| Mayús | | Nitro |
| M | Mapa | Mapa |
| I | Inventario | Inventario |
| Escape | Pausa o cerrar panel | Pausa o cerrar panel |

En pantallas táctiles aparecen controles de dirección, interacción, nitro y freno de mano según la escena. El mando estándar admite la cruceta o la palanca izquierda y el botón A para interactuar. El tutorial se puede omitir y volver a consultar desde pausa. Las opciones de partida permiten guardar en el navegador, exportar un archivo JSON e importar una partida en otro dispositivo.

## Compilación y pruebas

```sh
npm test
npm run build
npm run preview
```

`npm run build` comprueba TypeScript y deja el juego compilado en `dist/`. Para ejecutar las pruebas de navegador de Playwright, instala sus navegadores con `npx playwright install` y ejecuta `npm run test:e2e`.

## GitHub Pages

El flujo [Publicar en GitHub Pages](.github/workflows/pages.yml) prueba, compila y publica el contenido de `dist/` con cada actualización de `main`. En **Settings → Pages**, la fuente **GitHub Actions** publica directamente la compilación. Si la fuente está configurada como rama, el flujo espera a que termine la publicación de esa rama antes de desplegar el juego compilado. También se puede iniciar el flujo desde **Actions**. Su ejecución indica la dirección publicada en el entorno `github-pages`.

## Estado y créditos

Consulta [ROADMAP.md](ROADMAP.md) para conocer el alcance y las verificaciones de esta versión. Los recursos y dependencias se documentan en [CREDITS.md](CREDITS.md).

## Capturas de pruebas

[Portada](docs/capturas/portada.png) · [Taller inicial](docs/capturas/taller.png) · [Puerto Umbral](docs/capturas/puerto-umbral.png) · [Resultado del Sprint](docs/capturas/sprint.png) · [Taller ampliado](docs/capturas/taller-ampliado.png)
