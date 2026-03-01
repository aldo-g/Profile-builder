import { ipcMain, app } from 'electron'
import { join } from 'path'
import { readFileSync, existsSync, unlinkSync } from 'fs'
import { createRequire } from 'module'
import { readProfile, writeProfile } from './profile'
import { runInterviewer, generateSectionQuestions } from '../../agents/interviewer'
import { runImporter } from '../../agents/importer'
import { parseLinkedInZip, linkedInDataToText } from '../linkedin-parser'
import { linkedInOAuth } from '../linkedin-oauth'

const require = createRequire(import.meta.url)

// LinkedIn OAuth — opens system browser, spins up local callback server, returns userinfo
ipcMain.handle('linkedin:oauth', async () => {
  return linkedInOAuth()
})

ipcMain.handle('profile:read', readProfile)
ipcMain.handle('profile:write', (_event, data) => writeProfile(data))
ipcMain.handle('profile:reset', () => {
  const profilePath = join(app.getPath('userData'), 'profile.json')
  if (existsSync(profilePath)) {
    unlinkSync(profilePath)
  }
  return readProfile()
})

// Import handler: parse CV PDF and/or LinkedIn ZIP, extract profile data via Claude
ipcMain.handle('import:baseline', async (_event, payload: { cvPath?: string; linkedinZipPath?: string; rawText?: string }) => {
  console.log('[import:baseline] payload:', payload)
  let cvText: string | undefined
  let linkedinText: string | undefined

  if (payload.cvPath) {
    const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
    const buffer = readFileSync(payload.cvPath)
    const parsed = await pdfParse(buffer)
    cvText = parsed.text
    console.log('[import:baseline] CV text length:', cvText?.length)
  }

  if (payload.linkedinZipPath) {
    const data = parseLinkedInZip(payload.linkedinZipPath)
    linkedinText = linkedInDataToText(data)
    console.log('[import:baseline] LinkedIn text length:', linkedinText?.length)
  }

  if (payload.rawText) {
    cvText = (cvText ? cvText + '\n\n' : '') + payload.rawText
    console.log('[import:baseline] raw text appended, cvText length:', cvText?.length)
  }

  console.log('[import:baseline] calling runImporter, cvText?', !!cvText, 'linkedinText?', !!linkedinText)
  const extracted = await runImporter({ cvText, linkedinText })
  console.log('[import:baseline] extracted keys:', Object.keys(extracted))

  const currentProfile = readProfile() as Record<string, unknown>

  // Deep merge: append top-level arrays, deep-merge objects, scalar fields only overwrite if current is empty
  const merged: Record<string, unknown> = { ...currentProfile }
  for (const [key, value] of Object.entries(extracted)) {
    if (value === null || value === undefined) continue

    if (Array.isArray(value)) {
      // Append to existing arrays (workExperience, education, certifications, portfolio, languages, softSkills)
      merged[key] = Array.isArray(currentProfile[key])
        ? [...(currentProfile[key] as unknown[]), ...value]
        : value
    } else if (typeof value === 'object') {
      // Merge nested objects (personal, skills, summary) — only fill in missing fields
      const current = (currentProfile[key] ?? {}) as Record<string, unknown>
      const incoming = value as Record<string, unknown>
      const mergedObj: Record<string, unknown> = { ...current }
      for (const [subKey, subVal] of Object.entries(incoming)) {
        if (subVal === null || subVal === undefined) continue
        if (Array.isArray(subVal)) {
          // e.g. skills.technical — append
          mergedObj[subKey] = Array.isArray(current[subKey])
            ? [...(current[subKey] as unknown[]), ...(subVal as unknown[])]
            : subVal
        } else if (!current[subKey]) {
          // Only fill in scalar sub-fields if not already set
          mergedObj[subKey] = subVal
        }
      }
      merged[key] = mergedObj
    } else if (!currentProfile[key]) {
      // Only overwrite scalar top-level fields if empty
      merged[key] = value
    }
  }

  writeProfile(merged)

  // Return merged profile plus a summary of what was extracted for the UI
  const extractedKeys = Object.keys(extracted).filter(k => {
    const v = extracted[k]
    if (Array.isArray(v)) return v.length > 0
    if (typeof v === 'object' && v !== null) return Object.keys(v as object).length > 0
    return Boolean(v)
  })

  return { ...merged, _importedSections: extractedKeys }
})

ipcMain.handle('questions:generate', async (_event, payload: { section: string; profile: object }) => {
  return generateSectionQuestions(payload.profile, payload.section)
})

ipcMain.handle('chat:send', async (event, payload) => {
  const { message, section, conversationHistory, profile } = payload

  try {
    const agentResponse = await runInterviewer({
      userMessage: message,
      conversationHistory,
      profile,
      section,
      onChunk: (chunk: string) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('chat:stream', chunk)
        }
      }
    })

    if (event.sender.isDestroyed()) return

    // Merge profileUpdates into current profile and save if there are updates
    if (agentResponse.profileUpdates && Object.keys(agentResponse.profileUpdates).length > 0) {
      const updatedProfile = { ...profile, ...agentResponse.profileUpdates }
      writeProfile(updatedProfile)
      event.sender.send('chat:done', { agentResponse, updatedProfile })
    } else {
      event.sender.send('chat:done', { agentResponse, updatedProfile: profile })
    }
  } catch (err: unknown) {
    if (event.sender.isDestroyed()) return
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
    event.sender.send('chat:error', { error: errorMessage })
  }
})
