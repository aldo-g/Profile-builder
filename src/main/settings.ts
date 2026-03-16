import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

const settingsPath = join(app.getPath('userData'), 'settings.json')

interface Settings {
  apiKey?: string
}

function readSettings(): Settings {
  if (!existsSync(settingsPath)) return {}
  try {
    return JSON.parse(readFileSync(settingsPath, 'utf-8'))
  } catch {
    return {}
  }
}

function writeSettings(settings: Settings): void {
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
}

export function getApiKey(): string | null {
  return readSettings().apiKey ?? null
}

export function setApiKey(key: string): void {
  const settings = readSettings()
  settings.apiKey = key
  writeSettings(settings)
  process.env.ANTHROPIC_API_KEY = key
}

/** Call once at startup to load any persisted key into the environment. */
export function loadSavedApiKey(): void {
  const key = getApiKey()
  if (key) {
    process.env.ANTHROPIC_API_KEY = key
  }
}
