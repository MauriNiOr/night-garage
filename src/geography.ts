import type { RaceMode } from './catalog';

export type Service = 'fuel' | 'market' | 'parts' | 'scrap' | 'rivals' | 'parking';
export type Zone = {
  x: number;
  y: number;
  name: string;
  short: string;
  accent: number;
  garage?: true;
  race?: RaceMode;
  service?: Service;
};

export const VERTICALS = [400, 1130, 1890, 2660, 3260];
export const HORIZONTALS = [420, 1030, 1680, 2160];

const roads = [
  ...HORIZONTALS.map(y => ({ x: 150, y: y - 93, width: 3270, height: 186 })),
  ...VERTICALS.map(x => ({ x: x - 87, y: 240, width: 174, height: 2055 })),
];

const zones: Zone[] = [
  { x: 535, y: 475, name: 'Night Garage', short: 'Taller', accent: 0xff773c, garage: true },
  { x: 870, y: 475, name: 'Boulevard Industrial', short: 'Sprint', accent: 0xff733a, race: 'sprint' },
  { x: 1080, y: 997, name: 'Combustibles Nox', short: 'Gasolinera', accent: 0x65d7cd, service: 'fuel' },
  { x: 1947, y: 1085, name: 'Cobalto Motors', short: 'Mercado', accent: 0xcba4ff, service: 'market' },
  { x: 2615, y: 998, name: 'Overdrive', short: 'Componentes', accent: 0xffb15f, service: 'parts' },
  { x: 450, y: 1729, name: 'Recambios Faro', short: 'Desguace', accent: 0xfac275, service: 'scrap' },
  { x: 1875, y: 1740, name: 'Circuito Bajo Puente', short: 'Circuito', accent: 0xff7954, race: 'circuit' },
  { x: 3220, y: 1745, name: 'Dársena 9', short: 'Contrarreloj', accent: 0x78dcd4, race: 'time' },
  { x: 2675, y: 2100, name: 'Montes del Este', short: 'Drift', accent: 0xb591fd, race: 'drift' },
  { x: 3085, y: 475, name: 'Recta del Puerto', short: 'Drag', accent: 0xff9559, race: 'drag' },
  { x: 734, y: 980, name: 'Taller Voltio', short: 'Rivales', accent: 0xc59efe, service: 'rivals' },
  { x: 1885, y: 470, name: 'Estacionamiento Sur', short: 'Aparcamiento', accent: 0x8ba8bc, service: 'parking' },
];

export const cityMap = { width: 3660, height: 2440, roads, zones, garage: { x: 542, y: 454, angle: 0 } };
