import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function walk(page: Page, axis: 'x' | 'y', goal: number) {
  const hud = page.locator('#game-ui')
  const read = () => hud.getAttribute('data-'+axis).then(Number)
  const opening = await read()
  if (Math.abs(goal-opening) < 7) return
  const positive = goal > opening
  const key = axis === 'x' ? (positive ? 'ArrowRight' : 'ArrowLeft') : (positive ? 'ArrowDown' : 'ArrowUp')
  await page.keyboard.down(key)
  try {
    await expect.poll(async () => positive ? (await read()) >= goal-4 : (await read()) <= goal+4,
      {intervals:[35,40,50,70],timeout:12000,message:'Walking along '+axis+' from '+Math.round(opening)+' to '+goal}).toBeTruthy()
  } finally { await page.keyboard.up(key) }
}

async function station(page: Page, id: string, heading: string) {
  await expect(page.locator('#game-ui')).toHaveAttribute('data-near',id)
  await page.keyboard.press('KeyE')
  await expect(page.getByRole('dialog').getByRole('heading',{name:heading,exact:true})).toBeVisible()
}

test('tutorial inicia, repara el Kairo, personaliza y vuelve a guardar',async ({page},testInfo) => {
  test.setTimeout(120_000)
  const pageErrors: string[] = []
  page.on('pageerror',error => pageErrors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('button',{name:'Continuar',exact:true})).toBeDisabled()
  await page.screenshot({path:testInfo.outputPath('01-portada.png')})
  await page.getByRole('button',{name:'Nueva partida',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Puerto Umbral',exact:true})).toBeVisible()
  await expect(page.locator('.story-plate')).toHaveCSS('animation-name','story-camera')
  await page.getByRole('button',{name:'Continuar',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Las llaves',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Continuar',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Arranque en frío',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Entrar al taller'}).click()
  await expect(page.locator('#game-ui')).toHaveAttribute('data-place','garage')
  await expect(page.locator('#coach')).toContainText('Vuelve la corriente')
  await expect(page.locator('#canvas-host canvas')).toBeVisible()
  await page.screenshot({path:testInfo.outputPath('02-taller.png')})

  await walk(page,'x',440)
  await walk(page,'y',246)
  await walk(page,'x',529)
  await station(page,'lift','Kairo 86')
  await page.getByRole('button',{name:'Inspeccionar el Kairo'}).click()
  await expect(page.getByRole('dialog')).toContainText('Estado de los componentes')
  await page.keyboard.press('Escape')

  await walk(page,'y',327)
  await walk(page,'x',529)
  await station(page,'diagnostic','Diagnóstico')
  await page.getByRole('button',{name:'Ejecutar diagnóstico'}).click()
  await expect(page.getByText('Avería localizada · Batería de 12 V.')).toBeVisible()
  await page.keyboard.press('Escape')

  await walk(page,'y',247)
  await walk(page,'x',752)
  await walk(page,'y',175)
  await walk(page,'x',792)
  await station(page,'parts','Recambios')
  await page.getByTitle('Comprar Batería de 12 V').click()
  await expect(page.getByText('Comprado: Batería de 12 V.')).toBeVisible()
  await page.keyboard.press('Escape')

  await walk(page,'x',740)
  await walk(page,'y',244)
  await walk(page,'x',238)
  await station(page,'tools','Banco de herramientas')
  await page.getByTitle('Reparar Batería').click()
  await expect(page.getByRole('heading',{name:'Conecta el circuito'})).toBeVisible()
  await page.screenshot({path:testInfo.outputPath('03-reparacion.png')})
  for (const step of [1,3,2,4]) await page.getByRole('button',{name:'Conectar '+step}).click()
  await expect(page.getByText('Batería al 100 %.')).toBeVisible()
  await page.keyboard.press('Escape')

  await walk(page,'x',749)
  await walk(page,'y',289)
  await walk(page,'x',784)
  await station(page,'paint','Personalización')
  await page.getByRole('button',{name:'Turquesa puerto',exact:true}).click()
  await expect(page.getByRole('button',{name:'Turquesa puerto',exact:true})).toHaveAttribute('aria-pressed','true')
  await page.getByRole('button',{name:/Aplicar color/}).click()
  await expect(page.getByText('Color: Turquesa puerto.')).toBeVisible()
  await page.screenshot({path:testInfo.outputPath('04-personalizacion.png')})
  await page.keyboard.press('Escape')

  await page.keyboard.press('KeyM')
  await expect(page.getByRole('dialog').getByRole('heading',{name:'Puerto Umbral'})).toBeVisible()
  await expect(page.getByLabel('Mapa de Puerto Umbral')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'Guardar partida',exact:true}).click()
  await expect(page.getByText('Partida guardada.',{exact:true})).toBeVisible()
  const savedFile = page.waitForEvent('download')
  await page.getByRole('button',{name:'Exportar partida'}).click()
  const downloaded = await savedFile
  await expect(downloaded.suggestedFilename()).toBe('night-garage-ranura-1.json')
  const actualFile = await downloaded.path()
  await expect(actualFile).toBeTruthy()

  await page.reload()
  await page.getByRole('button',{name:'Partidas guardadas'}).click()
  await page.locator('#import-file').evaluate(element => (element as HTMLElement).dataset.slot = '2')
  await page.locator('#import-file').setInputFiles(actualFile!)
  await expect(page.getByText('Partida importada en la ranura 2.')).toBeVisible()
  await page.getByRole('button',{name:'Cerrar'}).click()
  await page.getByRole('button',{name:'Continuar',exact:true}).click()
  await expect(page.locator('#coach')).toContainText('Asfalto mojado')
  await page.keyboard.press('KeyI')
  await expect(page.getByRole('dialog').getByRole('heading',{name:'Inventario'})).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText('Kairo 86')
  await page.keyboard.press('Escape')

  await walk(page,'x',702)
  await walk(page,'y',435)
  await walk(page,'x',493)
  await station(page,'exit','Portón de salida')
  await page.getByRole('button',{name:'Conducir por la ciudad'}).click()
  await expect(page.locator('#game-ui')).toHaveAttribute('data-place','road',{timeout:20_000})
  await page.keyboard.down('ArrowUp')
  try {
    await expect(page.locator('#coach')).toContainText('La línea de sal')
    await expect.poll(async () => Number(await page.locator('[data-hud="speed"]').textContent())).toBeGreaterThan(10)
  } finally { await page.keyboard.up('ArrowUp') }
  await page.screenshot({path:testInfo.outputPath('05-puerto-umbral.png')})
  await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'Misiones',exact:true}).click()
  await page.getByRole('button',{name:/Capítulo 1/}).click()
  await expect(page.getByRole('heading',{name:'Puerto Umbral',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Siguiente escena'}).click()
  await expect(page.getByRole('heading',{name:'Las llaves',exact:true})).toBeVisible()
  await page.keyboard.press('Escape')

  await page.locator('#coach').getByRole('button',{name:'Ver guía'}).click()
  await page.getByRole('button',{name:'Conducción',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Dosifica el nitro'})).toBeVisible()
  await page.getByRole('button',{name:'Practicar ahora'}).click()
  await expect(page.locator('#coach')).toContainText('Acelera hasta 25 km/h')
  await page.keyboard.down('ArrowUp')
  try {
    await expect(page.locator('#coach')).toContainText('Da marcha atrás')
  } finally { await page.keyboard.up('ArrowUp') }
  await page.keyboard.down('ArrowDown')
  try {
    await expect(page.locator('#coach')).toContainText('Usa el nitro al acelerar')
  } finally { await page.keyboard.up('ArrowDown') }
  await page.keyboard.down('ArrowUp')
  try {
    await page.keyboard.down('Shift')
    try {
      await expect(page.locator('#coach')).toContainText('Derrapa en una curva')
      await expect.poll(async () => Number(await page.locator('[data-hud="speed"]').textContent())).toBeGreaterThan(55)
    } finally { await page.keyboard.up('Shift') }
    await page.keyboard.down('Space')
    await page.keyboard.down('ArrowLeft')
    try {
      await expect(page.getByText('Práctica de conducción completada.')).toBeVisible()
    } finally {
      await page.keyboard.up('ArrowLeft')
      await page.keyboard.up('Space')
    }
  } finally { await page.keyboard.up('ArrowUp') }
  await expect(page.locator('#coach')).toContainText('La línea de sal')
  expect(pageErrors).toEqual([])
})
