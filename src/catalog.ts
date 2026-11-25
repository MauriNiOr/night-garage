export const COMPONENTS = {
  tires: { name: 'Neumáticos', part: 'Juego de neumáticos', price: 210, minLevel: 1, description: 'Conservan agarre al girar y recortan la frenada.' },
  engine: { name: 'Motor', part: 'Kit de juntas y bujías', price: 320, minLevel: 1, description: 'Recupera la respuesta del acelerador y la velocidad punta.' },
  oil: { name: 'Aceite', part: 'Aceite sintético', price: 85, minLevel: 1, description: 'Reduce la pérdida de potencia por fricción.' },
  battery: { name: 'Batería', part: 'Batería de 12 V', price: 150, minLevel: 1, description: 'Da corriente al arranque y a la electrónica.' },
  brakes: { name: 'Frenos', part: 'Discos y pastillas', price: 205, minLevel: 1, description: 'Aumenta la deceleración en asfalto mojado.' },
  suspension: { name: 'Suspensión', part: 'Amortiguadores', price: 260, minLevel: 1, description: 'Estabiliza el coche al salir de un derrape.' },
  turbo: { name: 'Turbo', part: 'Cartucho de turbo', price: 340, minLevel: 2, description: 'Recupera presión de sobrealimentación y empuje.' },
  body: { name: 'Carrocería', part: 'Juego de paneles', price: 220, minLevel: 1, description: 'Restituye paneles abollados y mejora el valor de venta.' },
  paint: { name: 'Pintura', part: 'Esmalte y barniz', price: 95, minLevel: 1, description: 'Recupera el acabado antes de entregar o vender el coche.' },
  gearbox: { name: 'Caja de cambios', part: 'Juego de sincronizadores', price: 290, minLevel: 2, description: 'Mejora la respuesta en marchas cortas.' },
} as const;

export type ComponentKey = keyof typeof COMPONENTS;
export type Condition = Record<ComponentKey, number>;

export const COMPONENT_KEYS = Object.keys(COMPONENTS) as ComponentKey[];

export interface Model {
  index: number;
  name: string;
  kind: string;
  price: number;
  km: number;
  power: number;
  weight: number;
  maxSpeed: number;
  acceleration: number;
  drive: 'FWD' | 'RWD' | 'AWD';
  color: number;
  minLevel: number;
  condition: Condition;
}

function model(index: number, name: string, kind: string, price: number, km: number, power: number, weight: number, maxSpeed: number, acceleration: number, drive: Model['drive'], color: number, minLevel: number, wear: Partial<Condition> = {}): Model {
  return {
    index, name, kind, price, km, power, weight, maxSpeed, acceleration, drive, color, minLevel,
    condition: { tires: 75, engine: 76, oil: 68, battery: 86, brakes: 75, suspension: 79, turbo: 90, body: 80, paint: 78, gearbox: 82, ...wear },
  };
}

export const MODELS: readonly Model[] = [
  model(0, 'Kairo 86', 'Coupé clásico', 2650, 186430, 118, 1020, 171, 9.2, 'RWD', 0xb74435, 1, { battery: 18, body: 66, paint: 58, engine: 83, tires: 82, brakes: 83 }),
  model(1, 'Mako Sport', 'Compacto urbano', 2180, 155500, 101, 960, 159, 9.9, 'FWD', 0x428f8a, 1, { brakes: 44, paint: 51 }),
  model(2, 'Vanta R2', 'Berlina deportiva', 3450, 128200, 152, 1175, 190, 8.4, 'RWD', 0x7787a2, 1, { engine: 61, gearbox: 63 }),
  model(3, 'Kestrel Touring', 'Familiar deportivo', 4200, 107700, 166, 1350, 191, 8.3, 'AWD', 0xac7f44, 2, { suspension: 51, tires: 57 }),
  model(4, 'Forge D4', 'Pickup deportiva', 5700, 100900, 213, 1565, 192, 7.8, 'AWD', 0x7c6698, 2, { suspension: 43, body: 54 }),
  model(5, 'Senda MX', 'Roadster biplaza', 4750, 92400, 142, 970, 193, 7.7, 'RWD', 0x4c805f, 2, { oil: 46, body: 55, turbo: 48 }),
  model(6, 'Astrail RS', 'Homologación de rally', 10200, 65200, 272, 1250, 225, 5.7, 'AWD', 0x5777b5, 3, { turbo: 56, oil: 61 }),
  model(7, 'Bulwark V8', 'Muscle de tracción trasera', 8600, 71200, 302, 1610, 227, 6.1, 'RWD', 0xc46139, 3, { brakes: 56, tires: 57 }),
  model(8, 'Cinder GT', 'Superdeportivo central', 18200, 31100, 378, 1300, 268, 4.6, 'RWD', 0x904a9a, 4, { engine: 71, suspension: 74, paint: 87 }),
  model(9, 'Rook Silex', 'Preparación de circuito', 12800, 48600, 327, 1190, 245, 5.5, 'AWD', 0x46967f, 3, { gearbox: 55, suspension: 63 }),
  model(10, 'Nocturne LX', 'Gran turismo', 15300, 45900, 348, 1560, 254, 5.1, 'RWD', 0xb04f58, 4, { gearbox: 72, suspension: 66 }),
  model(11, 'Obsidian LM', 'Prototipo de resistencia', 26500, 17400, 430, 1080, 287, 3.9, 'AWD', 0xaf9b69, 5, { engine: 87, turbo: 85, gearbox: 86, paint: 91, body: 92 }),
];

export const COLORS = [
  { name: 'Rojo brasa', value: 0xc94b40 },
  { name: 'Blanco glaciar', value: 0xc7d5dd },
  { name: 'Turquesa puerto', value: 0x4db3ad },
  { name: 'Ámbar sodio', value: 0xe3ac55 },
  { name: 'Morado medianoche', value: 0x7867b2 },
  { name: 'Azul cobalto', value: 0x4279bf },
  { name: 'Verde pino', value: 0x58936e },
  { name: 'Gris grafito', value: 0x49566c },
] as const;

export interface CustomOption {
  value: number;
  label: string;
  price: number;
  minLevel: number;
}

interface Customization {
  name: string;
  options: readonly CustomOption[];
}

function options(second: string, price: number, third: string, extra: number, minLevel = 1, extraLevel = 3): readonly CustomOption[] {
  return [
    { value: 0, label: 'De serie', price: 0, minLevel: 1 },
    { value: 1, label: second, price, minLevel },
    { value: 2, label: third, price: extra, minLevel: extraLevel },
  ];
}

export const CUSTOMIZATIONS = {
  color: { name: 'Color', options: COLORS.map(({ name, value }) => ({ label: name, value, price: 115, minLevel: 1 })) },
  rims: { name: 'Llantas', options: options('Malla pulida', 260, 'Forjadas', 570) },
  ride: { name: 'Altura', options: options('Chasis rebajado', 390, 'Roscas de pista', 870, 2) },
  wing: { name: 'Alerón', options: options('Plano discreto', 180, 'Doble plano GT', 410, 1, 2) },
  bumper: { name: 'Parachoques', options: options('Faldón urbano', 185, 'Separador de pista', 390, 1, 2) },
  vinyl: { name: 'Vinilos', options: options('Franjas de rally', 135, 'Patrón de competición', 255, 1, 2) },
  neon: { name: 'Neón', options: options('Cian', 165, 'Magenta', 195, 1, 2) },
  exhaust: { name: 'Escape', options: options('Salida deportiva', 335, 'Dos salidas libres', 780, 2) },
  engine: { name: 'Motor', options: options('Centralita de calle', 680, 'Bloque forjado', 1620, 2, 4) },
  turbo: { name: 'Turbo', options: options('Turbina rápida', 730, 'Doble turbina', 1720, 2, 4) },
  brakes: { name: 'Frenos', options: options('Disco ventilado', 410, 'Kit de seis pistones', 860, 2) },
  tires: { name: 'Neumáticos', options: options('Compuesto deportivo', 385, 'Semislick de lluvia', 850) },
  gearbox: { name: 'Caja de cambios', options: options('Grupo corto', 560, 'Secuencial', 1320, 2, 4) },
} satisfies Record<string, Customization>;

export type CustomizationKey = keyof typeof CUSTOMIZATIONS;
export const CUSTOMIZATION_KEYS = Object.keys(CUSTOMIZATIONS) as CustomizationKey[];

export const LEVELS = [
  { level: 1, name: 'Garaje abandonado', rep: 0, cost: 0, description: 'Levanta la persiana, diagnostica el Kairo y sal a la primera carrera del puerto.' },
  { level: 2, name: 'Taller de barrio', rep: 10, cost: 1250, description: 'Renueva la iluminación, incorpora clientes habituales y desbloquea el circuito urbano.' },
  { level: 3, name: 'Taller de preparación deportiva', rep: 70, cost: 3400, description: 'Añade preparación de pista, compuestos deportivos y pruebas de drift y aceleración.' },
  { level: 4, name: 'Taller de competición', rep: 160, cost: 7900, description: 'Amplía el taller, accede a superdeportivos y recibe ofertas de patrocinio.' },
  { level: 5, name: 'Imperio automovilístico', rep: 310, cost: 15400, description: 'Especialízate en restauraciones y accede al prototipo Obsidian LM.' },
] as const;

export type RaceMode = 'sprint' | 'circuit' | 'time' | 'drift' | 'drag';

export interface Race {
  mode: RaceMode;
  name: string;
  subtitle: string;
  fee: number;
  prize: number;
  rep: number;
  minLevel: number;
  target?: number;
  description: string;
}

export const RACES: Record<RaceMode, Race> = {
  sprint: { mode: 'sprint', name: 'Sprint', subtitle: 'La línea de sal', fee: 80, prize: 1020, rep: 12, minLevel: 1, description: 'Cruza todos los controles en orden. Mara y Damián salen contigo.' },
  circuit: { mode: 'circuit', name: 'Circuito', subtitle: 'Anillo de medianoche', fee: 210, prize: 1860, rep: 19, minLevel: 2, description: 'Completa dos vueltas y cuida la trazada en las curvas.' },
  time: { mode: 'time', name: 'Contrarreloj', subtitle: 'Turno de noche', fee: 130, prize: 1390, rep: 16, minLevel: 2, target: 32, description: 'Pasa todos los controles en 32 segundos. Cada curva cuenta.' },
  drift: { mode: 'drift', name: 'Drift', subtitle: 'Humo en los muelles', fee: 185, prize: 2110, rep: 21, minLevel: 3, target: 1150, description: 'Usa el freno de mano y suma 1.150 puntos de derrape antes de la última puerta.' },
  drag: { mode: 'drag', name: 'Drag', subtitle: 'Recta de carga', fee: 235, prize: 2420, rep: 24, minLevel: 3, description: 'Acelera sin perder el carril y dosifica el nitro en la recta.' },
};

export const TOURNAMENT = { name: 'Copa de Medianoche', modes: ['sprint', 'circuit', 'drift'] as const, minLevel: 4, fee: 530, prize: 3400, rep: 38 };

export interface Job {
  id: string;
  client: string;
  name: string;
  model: number;
  component: ComponentKey;
  pay: number;
  rep: number;
  minLevel: number;
  line: string;
}

export const JOBS: readonly Job[] = [
  { id: 'mara-oil', client: 'Mara', name: 'Turno de aceite', model: 1, component: 'oil', pay: 345, rep: 5, minLevel: 1, line: 'Se enciende el piloto después de dar un par de vueltas. Mira el aceite antes de que me vuelva a dejar tirada.' },
  { id: 'lia-brakes', client: 'Lía', name: 'Frenos para el reparto', model: 3, component: 'brakes', pay: 555, rep: 7, minLevel: 1, line: 'Mañana salgo con el primer reparto. El pedal se va abajo cuando llevo carga.' },
  { id: 'damian-body', client: 'Damián', name: 'Una aleta contra el muelle', model: 2, component: 'body', pay: 680, rep: 9, minLevel: 2, line: 'El bordillo del puerto ganó esta vez. Prefiero que lo vea alguien que conozca el coche.' },
  { id: 'ines-turbo', client: 'Inés', name: 'Presión perdida', model: 5, component: 'turbo', pay: 920, rep: 12, minLevel: 2, line: 'La presión cae en tercera. Tengo una salida el viernes y me urge recuperar el empuje.' },
  { id: 'noa-suspension', client: 'Noa', name: 'Puesta a punto de rally', model: 6, component: 'suspension', pay: 1160, rep: 14, minLevel: 3, line: 'En el primer apoyo rebota demasiado. Lo necesito estable cuando enlace curvas.' },
  { id: 'irene-engine', client: 'Irene', name: 'Recuperar el Cinder', model: 8, component: 'engine', pay: 1560, rep: 17, minLevel: 4, line: 'Lleva dos temporadas parado. Quiero volver a oírlo en la parrilla.' },
  { id: 'leo-gearbox', client: 'Leo', name: 'Restauración de resistencia', model: 11, component: 'gearbox', pay: 2050, rep: 22, minLevel: 5, line: 'La tercera sigue raspando después de reconstruirlo. Dame una caja que aguante toda la noche.' },
];

export const TUTORIAL = [
  { event: 'move', title: 'Vuelve la corriente', text: 'Camina con WASD o las flechas para explorar el taller que acabas de heredar.' },
  { event: 'interact', title: 'El primer contacto', text: 'Acércate al elevador y pulsa E cuando se ilumine el indicador.', station: 'lift' },
  { event: 'inspect', title: 'El Kairo de tu tío', text: 'Inspecciona el Kairo en el elevador y fíjate en el desgaste de sus piezas.', station: 'lift' },
  { event: 'diagnose', title: 'El piloto apagado', text: 'Ve a la máquina de diagnóstico y comprueba por qué falla el arranque.', station: 'diagnostic' },
  { event: 'buy', title: 'Doce voltios', text: 'Compra una batería de 12 V en el almacén de recambios.', station: 'parts' },
  { event: 'repair', title: 'Arranque en frío', text: 'Usa el banco de herramientas y completa el montaje de la batería.', station: 'tools' },
  { event: 'customize', title: 'Firma propia', text: 'Aplica un color nuevo desde la cabina de pintura.', station: 'paint' },
  { event: 'drive', title: 'Asfalto mojado', text: 'Sal por el portón y conduce el Kairo con WASD o las flechas.', station: 'exit' },
  { event: 'race', title: 'La línea de sal', text: 'Inscríbete en el sprint del puerto y cruza todos los puntos de control.' },
  { event: 'manage', title: 'Cierra la caja', text: 'Vuelve al taller y revisa las cuentas en el ordenador.', station: 'pc' },
  { event: 'upgrade', title: 'A pie de calle', text: 'Invierte el dinero del premio en convertir el garaje en un taller de barrio.', station: 'pc' },
] as const;

export type TutorialEvent = (typeof TUTORIAL)[number]['event'];

export const ACHIEVEMENTS = [
  { id: 'first-repair', name: 'Vuelve a latir', description: 'Instala tu primer recambio.', reward: 85 },
  { id: 'first-race', name: 'Bajo las farolas', description: 'Completa tu primera carrera.', reward: 150 },
  { id: 'first-win', name: 'Línea limpia', description: 'Gana tu primera prueba.', reward: 240 },
  { id: 'three-jobs', name: 'Cliente habitual', description: 'Entrega tres encargos.', reward: 285 },
  { id: 'three-models', name: 'Llaves en el bolsillo', description: 'Adquiere tres modelos distintos.', reward: 320 },
  { id: 'first-sale', name: 'Cambio de manos', description: 'Vende tu primer vehículo.', reward: 175 },
  { id: 'economy', name: 'Caja fuerte', description: 'Reúne 10.000 €.', reward: 500 },
  { id: 'tournament', name: 'Corona de neón', description: 'Completa la Copa de Medianoche.', reward: 750 },
  { id: 'maximum-level', name: 'Las llaves de la ciudad', description: 'Alcanza el quinto nivel del taller.', reward: 1350 },
] as const;

export const STORY = [
  { level: 1, speaker: 'Mara', line: 'La persiana lleva meses cerrada. Tu tío decía que el Kairo arrancaría otra vez si alguien le cambiaba la batería.' },
  { level: 2, speaker: 'Lía', line: 'Desde que encendiste el letrero veo coches esperando al cerrar. Pásame tu horario y te mando a los del reparto.' },
  { level: 3, speaker: 'Damián', line: 'El circuito te queda pequeño. Los del muelle abrieron la recta de carga y llevan toda la noche preguntando por el Kairo.' },
  { level: 4, speaker: 'Inés', line: 'La Copa de Medianoche busca taller. Te pagan por los resultados y la inscripción viene en el mismo sobre.' },
  { level: 5, speaker: 'Mara', line: 'Encontré un Obsidian entre las piezas del desguace. Tu tío siempre decía que había que dejar sitio para un coche más.' },
] as const;
