import { ipcMain, app, dialog } from 'electron'
import { join } from 'path'
import { readFileSync, existsSync, unlinkSync, writeFileSync } from 'fs'
import { createRequire } from 'module'
import { readProfile, writeProfile } from './profile'
import { runInterviewer, generateSectionQuestions } from '../../agents/interviewer'
import { runImporter } from '../../agents/importer'
import { deduplicateProfile, cleanProfile } from '../../agents/deduplicator'
import { runGapAnalyser, runGapAnalyserChat } from '../../agents/gap-analyser'
import type { GapAnalysis } from '../../schema/profile.schema'
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

ipcMain.handle('profile:dedupe', async () => {
  const current = readProfile() as Record<string, unknown>
  const cleaned = await cleanProfile(current)
  writeProfile(cleaned)
  return cleaned
})

ipcMain.handle('profile:export', async () => {
  const profile = readProfile()
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: 'Export Profile',
    defaultPath: 'profile.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (canceled || !filePath) return { success: false }
  writeFileSync(filePath, JSON.stringify(profile, null, 2), 'utf-8')
  return { success: true, filePath }
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
  const merged = await deduplicateProfile(currentProfile, extracted)

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

ipcMain.handle('job:analyse', async (_event, payload: { jobText: string; profile: Record<string, unknown> }) => {
  return runGapAnalyser(payload)
})

ipcMain.handle('job:chat', async (event, payload: {
  message: string
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  jobText: string
  analysis: GapAnalysis
  profile: Record<string, unknown>
}) => {
  const { message, conversationHistory, jobText, analysis, profile } = payload

  try {
    const agentResponse = await runGapAnalyserChat({
      userMessage: message,
      conversationHistory,
      jobText,
      analysis,
      profile,
      onChunk: (chunk: string) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('job:stream', chunk)
        }
      }
    })

    if (event.sender.isDestroyed()) return

    if (agentResponse.profileUpdates && Object.keys(agentResponse.profileUpdates).length > 0) {
      const updatedProfile = { ...profile, ...agentResponse.profileUpdates }
      writeProfile(updatedProfile)
      event.sender.send('job:done', { agentResponse, updatedProfile })
    } else {
      event.sender.send('job:done', { agentResponse, updatedProfile: profile })
    }
  } catch (err: unknown) {
    if (event.sender.isDestroyed()) return
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
    event.sender.send('job:error', { error: errorMessage })
  }
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
