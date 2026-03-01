import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

const profilePath = join(app.getPath('userData'), 'profile.json')

const defaultProfile = {
  meta: {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sources: [],
    completeness: {}
  },
  personal: {},
  summary: { default: '', variants: [] },
  workExperience: [],
  education: [],
  certifications: [],
  skills: { technical: [], domains: [], tools: [] },
  portfolio: [],
  languages: [],
  softSkills: [],
  references: [],
  extras: {}
}

export function readProfile(): object {
  if (!existsSync(profilePath)) {
    writeFileSync(profilePath, JSON.stringify(defaultProfile, null, 2), 'utf-8')
    return defaultProfile
  }
  return JSON.parse(readFileSync(profilePath, 'utf-8'))
}

export function writeProfile(data: object): void {
  const updated = { ...data, meta: { ...(data as any).meta, updatedAt: new Date().toISOString() } }
  writeFileSync(profilePath, JSON.stringify(updated, null, 2), 'utf-8')
}
