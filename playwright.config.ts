import { existsSync } from 'node:fs'
import { defineConfig, devices, type Project } from '@playwright/test'

const chromiumPath = process.env.NIGHT_GARAGE_CHROMIUM_PATH
  ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined)
const projects: Project[] = [{
  name: 'chromium',
  use: {
    ...devices['Desktop Chrome'],
    launchOptions: { executablePath: chromiumPath },
  },
}]

const chromePath = process.env.NIGHT_GARAGE_CHROME_PATH
if (chromePath) {
  projects.push({
    name: 'chrome',
    use: { ...devices['Desktop Chrome'], launchOptions: { executablePath: chromePath } },
  })
}

const edgePath = process.env.NIGHT_GARAGE_EDGE_PATH
if (edgePath) {
  projects.push({
    name: 'edge',
    use: { ...devices['Desktop Edge'], launchOptions: { executablePath: edgePath } },
  })
}

if (process.env.NIGHT_GARAGE_FIREFOX === '1') {
  projects.push({ name: 'firefox', use: devices['Desktop Firefox'] })
}

const previewUrl = process.env.NIGHT_GARAGE_TEST_URL
const baseURL = previewUrl || 'http://127.0.0.1:4173'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.e2e.ts',
  timeout: 45_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects,
  webServer: previewUrl ? undefined : {
    command: 'npm run dev -- --port 4173 --strictPort --mode qa',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
