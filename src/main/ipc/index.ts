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
ipcMain.handle('import:baseline', async (_event, payload: { cvPath?: string; linkedinZipPath?: string }) => {
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

  console.log('[import:baseline] calling runImporter, cvText?', !!cvText, 'linkedinText?', !!linkedinText)
  const extracted = await runImporter({ cvText, linkedinText })
  console.log('[import:baseline] extracted keys:', Object.keys(extracted))

  const currentProfile = readProfile() as Record<string, unknown>
  const merged = { ...currentProfile, ...extracted }
  writeProfile(merged)

  return merged
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
