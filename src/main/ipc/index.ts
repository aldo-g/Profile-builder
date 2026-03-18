import { ipcMain, app, dialog, BrowserWindow, shell } from 'electron'
import { join, extname } from 'path'
import { readFileSync, existsSync, unlinkSync, writeFileSync, copyFileSync } from 'fs'
import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import mammoth from 'mammoth'
import { readProfile, writeProfile } from './profile'
import { saveSnapshot, listSnapshots, loadSnapshot, deleteSnapshot } from './versions'
import { getApiKey, setApiKey } from '../settings'
import { runInterviewer, generateSectionQuestions } from '../../agents/interviewer'
import { runImporter } from '../../agents/importer'
import { deduplicateProfile, cleanProfile } from '../../agents/deduplicator'
import { runGapAnalyser, runGapAnalyserChat } from '../../agents/gap-analyser'
import { runGenerator } from '../../agents/generator'
import { runResearcher } from '../../agents/researcher'
import { runOverseer } from '../../agents/overseer'
import { runEditor } from '../../agents/editor'
import type { GapAnalysis, OverseerResult } from '../../schema/profile.schema'
import { parseLinkedInZip, linkedInDataToText } from '../linkedin-parser'
import { linkedInOAuth } from '../linkedin-oauth'
import { markdownToHtml } from '../markdownToHtml'
import { withRetry, friendlyErrorMessage } from '../../agents/utils'

// Deep merge profileUpdates into the current saved profile.
// Arrays are replaced at the top level (the agent returns the full updated array),
// objects are merged recursively, scalars are overwritten.
function deepMergeProfile(
  base: Record<string, unknown>,
  updates: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...base }
  for (const [key, value] of Object.entries(updates)) {
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof base[key] === 'object' &&
      base[key] !== null &&
      !Array.isArray(base[key])
    ) {
      result[key] = deepMergeProfile(
        base[key] as Record<string, unknown>,
        value as Record<string, unknown>
      )
    } else {
      result[key] = value
    }
  }
  return result
}

// ── Shell ─────────────────────────────────────────────────────────────────────

ipcMain.handle('shell:openExternal', (_event, url: string) => {
  shell.openExternal(url)
})

// ── API key management ────────────────────────────────────────────────────────

ipcMain.handle('settings:getApiKey', () => getApiKey())
ipcMain.handle('settings:setApiKey', (_event, key: string) => {
  setApiKey(key)
})

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
  saveSnapshot(current, 'Before deduplication')
  const cleaned = await cleanProfile(current)
  writeProfile(cleaned)
  return cleaned
})

// ── Profile versioning ────────────────────────────────────────────────────────

ipcMain.handle('versions:list', () => listSnapshots())

ipcMain.handle('versions:restore', (_event, id: string) => {
  const snapshot = loadSnapshot(id)
  const current = readProfile() as Record<string, unknown>
  saveSnapshot(current, 'Before restore')
  writeProfile(snapshot)
  return snapshot
})

ipcMain.handle('versions:delete', (_event, id: string) => {
  deleteSnapshot(id)
})

ipcMain.handle('versions:saveManual', (_event, label: string) => {
  const current = readProfile() as Record<string, unknown>
  return saveSnapshot(current, label)
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
  saveSnapshot(currentProfile, 'Before document import')
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
    const agentResponse = await withRetry(() => runGapAnalyserChat({
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
    }))

    if (event.sender.isDestroyed()) return

    // Never auto-write — send proposed updates back to UI for user confirmation
    event.sender.send('job:done', {
      agentResponse,
      proposedUpdates: agentResponse.profileUpdates && Object.keys(agentResponse.profileUpdates).length > 0
        ? agentResponse.profileUpdates
        : null
    })
  } catch (err: unknown) {
    if (event.sender.isDestroyed()) return
    event.sender.send('job:error', { error: friendlyErrorMessage(err) })
  }
})

ipcMain.handle('job:confirmUpdate', (_event, updates: Record<string, unknown>) => {
  const currentProfile = readProfile() as Record<string, unknown>
  saveSnapshot(currentProfile, 'Before job match update')
  const updatedProfile = deepMergeProfile(currentProfile, updates)
  writeProfile(updatedProfile)
  return updatedProfile
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

    if (agentResponse.profileUpdates && Object.keys(agentResponse.profileUpdates).length > 0) {
      const currentProfile = readProfile() as Record<string, unknown>
      saveSnapshot(currentProfile, `Before interview update (${section})`)
      const updatedProfile = deepMergeProfile(currentProfile, agentResponse.profileUpdates)
      writeProfile(updatedProfile)
      event.sender.send('chat:done', { agentResponse, updatedProfile })
    } else {
      event.sender.send('chat:done', { agentResponse, updatedProfile: profile })
    }
  } catch (err: unknown) {
    if (event.sender.isDestroyed()) return
    const errorMessage = friendlyErrorMessage(err)
    event.sender.send('chat:error', { error: errorMessage })
  }
})

// ── Template management ──────────────────────────────────────────────────────

ipcMain.handle('template:save', async (_event, payload: { filePath: string; type: 'cv' | 'coverLetter' }) => {
  const ext = extname(payload.filePath).toLowerCase()
  const baseName = payload.type === 'cv' ? 'cv-template' : 'cover-letter-template'
  const destPath = join(app.getPath('userData'), `${baseName}${ext}`)
  copyFileSync(payload.filePath, destPath)
  return { success: true, destPath }
})

ipcMain.handle('template:check', async () => {
  const userData = app.getPath('userData')
  const exts = ['.docx', '.pdf', '.doc']
  const has = (base: string): boolean =>
    exts.some(e => existsSync(join(userData, `${base}${e}`)))
  return {
    cv: has('cv-template'),
    coverLetter: has('cover-letter-template')
  }
})

ipcMain.handle('template:read', async (_event, payload: { type: 'cv' | 'coverLetter' }) => {
  const userData = app.getPath('userData')
  const baseName = payload.type === 'cv' ? 'cv-template' : 'cover-letter-template'
  const exts = ['.docx', '.doc', '.pdf']
  let foundPath: string | null = null
  let foundExt = ''
  for (const e of exts) {
    const p = join(userData, `${baseName}${e}`)
    if (existsSync(p)) { foundPath = p; foundExt = e; break }
  }
  if (!foundPath) throw new Error(`Template not found: ${baseName}`)

  if (foundExt === '.docx' || foundExt === '.doc') {
    const result = await mammoth.extractRawText({ path: foundPath })
    return { text: result.value }
  } else {
    // PDF
    const buffer = readFileSync(foundPath)
    const parsed = await pdfParse(buffer)
    return { text: parsed.text }
  }
})

// ── Company research ─────────────────────────────────────────────────────────

ipcMain.handle('research:company', async (event, payload: { company: string }) => {
  try {
    const result = await runResearcher({
      company: payload.company,
      onChunk: (chunk: string) => {
        if (!event.sender.isDestroyed()) event.sender.send('research:stream', chunk)
      }
    })
    if (!event.sender.isDestroyed()) event.sender.send('research:done', result)
  } catch (err: unknown) {
    if (!event.sender.isDestroyed()) {
      const errorMessage = friendlyErrorMessage(err)
      event.sender.send('research:error', { error: errorMessage })
    }
  }
})

// ── Document generation ──────────────────────────────────────────────────────

ipcMain.handle('generate:docs', async (event, payload: {
  profile: Record<string, unknown>
  analysis: GapAnalysis
  cvTemplateText: string
  coverLetterTemplateText?: string
  gapAnswers?: Record<string, string>
  companySummary?: string
  applicationOverrides?: { location: string; phone: string; hasRightToWork: boolean }
}) => {
  const send = (channel: string, data: unknown): void => {
    if (!event.sender.isDestroyed()) event.sender.send(channel, data)
  }

  try {
    // ── Phase 1: Generate ───────────────────────────────────────────────────
    let generated = await runGenerator({
      profile: payload.profile,
      analysis: payload.analysis,
      cvTemplateText: payload.cvTemplateText,
      coverLetterTemplateText: payload.coverLetterTemplateText,
      gapAnswers: payload.gapAnswers,
      companySummary: payload.companySummary,
      applicationOverrides: payload.applicationOverrides,
      onChunk: (chunk: string) => send('generate:stream', chunk)
    })

    // ── Phase 2: Overseer review ────────────────────────────────────────────
    send('generate:stream', '\n\n[Overseer] Reviewing documents…')

    const overseerResult: OverseerResult = await runOverseer({
      cvMarkdown: generated.cvMarkdown,
      coverLetterMarkdown: generated.coverLetterMarkdown,
      analysis: payload.analysis,
      companySummary: payload.companySummary
    })

    send('generate:stream', ` Score: ${overseerResult.score}/10`)

    // ── Phase 3: Edit if needed (max 1 iteration) ───────────────────────────
    if (!overseerResult.pass) {
      const failCount = overseerResult.feedback.cv.length + overseerResult.feedback.coverLetter.length
      send('generate:stream', `\n[Editor] Refining ${failCount} section${failCount !== 1 ? 's' : ''}…`)

      const edited = await runEditor({
        cvMarkdown: generated.cvMarkdown,
        coverLetterMarkdown: generated.coverLetterMarkdown,
        overseerResult,
        roleType: payload.analysis.roleType,
        narrativeAngle: payload.analysis.narrativeAngle,
        onChunk: (chunk: string) => send('generate:stream', chunk)
      })

      generated = { ...generated, cvMarkdown: edited.cvMarkdown, coverLetterMarkdown: edited.coverLetterMarkdown }
    }

    send('generate:done', { ...generated, overseerResult })
  } catch (err: unknown) {
    if (event.sender.isDestroyed()) return
    const errorMessage = friendlyErrorMessage(err)
    send('generate:error', { error: errorMessage })
  }
})


// Cached hidden window used for printToPDF — created on first use, reused
// across subsequent PDF exports to avoid spawning a new BrowserWindow each time.
// Destroyed when the app quits (Electron handles this automatically).
let _pdfWindow: BrowserWindow | null = null

function getPdfWindow(): BrowserWindow {
  if (_pdfWindow && !_pdfWindow.isDestroyed()) return _pdfWindow
  _pdfWindow = new BrowserWindow({ show: false, width: 794, height: 1123, webPreferences: { sandbox: true } })
  _pdfWindow.on('closed', () => { _pdfWindow = null })
  return _pdfWindow
}

ipcMain.handle('generate:pdf', async (_event, payload: { markdown: string; filename: string }) => {
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: 'Save PDF',
    defaultPath: payload.filename,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (canceled || !filePath) return { success: false }

  const html = markdownToHtml(payload.markdown)
  const styledHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 10.5pt;
    line-height: 1.55;
    color: #111;
    padding: 44px 52px;
    background: #fff;
  }
  /* Name at the top */
  h1 {
    font-family: -apple-system, Helvetica, Arial, sans-serif;
    font-size: 22pt;
    font-weight: 700;
    color: #111;
    margin: 0 0 3px;
    letter-spacing: -0.01em;
  }
  /* Section headings */
  h2 {
    font-family: -apple-system, Helvetica, Arial, sans-serif;
    font-size: 7.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #444;
    border-bottom: 1.5px solid #222;
    padding-bottom: 2px;
    margin: 16px 0 6px;
  }
  /* Role / employer */
  h3 {
    font-family: -apple-system, Helvetica, Arial, sans-serif;
    font-size: 10.5pt;
    font-weight: 600;
    color: #111;
    margin: 9px 0 2px;
  }
  p  { margin: 2px 0; color: #222; }
  ul { padding-left: 15px; margin: 3px 0 5px; }
  li { margin: 1px 0; color: #222; }
  strong { font-weight: 600; color: #111; }
  em     { font-style: italic; }
  hr     { border: none; border-top: 1px solid #ddd; margin: 10px 0; }
</style>
</head>
<body>${html}</body>
</html>`

  const win = getPdfWindow()
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(styledHtml)}`)

  const pdfBuffer = await win.webContents.printToPDF({ pageSize: 'A4' })

  writeFileSync(filePath, pdfBuffer)
  return { success: true, filePath }
})

// ── DOCX export ───────────────────────────────────────────────────────────────

ipcMain.handle('generate:docx', async (_event, payload: { markdown: string; filename: string }) => {
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: 'Save DOCX',
    defaultPath: payload.filename,
    filters: [{ name: 'Word Document', extensions: ['docx'] }]
  })
  if (canceled || !filePath) return { success: false }

  // Dynamic import so Electron's ESM loader picks up docx's .mjs entry directly
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } = await import('docx')

  function parseInlineRuns(text: string): InstanceType<typeof TextRun>[] {
    const runs: InstanceType<typeof TextRun>[] = []
    const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*)/g
    let lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        runs.push(new TextRun({ text: text.slice(lastIndex, match.index) }))
      }
      if (match[2]) runs.push(new TextRun({ text: match[2], bold: true, italics: true }))
      else if (match[3]) runs.push(new TextRun({ text: match[3], bold: true }))
      else if (match[4]) runs.push(new TextRun({ text: match[4], italics: true }))
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < text.length) runs.push(new TextRun({ text: text.slice(lastIndex) }))
    return runs.length > 0 ? runs : [new TextRun({ text })]
  }

  const paragraphs: InstanceType<typeof Paragraph>[] = []
  for (const line of payload.markdown.split('\n')) {
    if (/^### (.+)$/.test(line)) {
      paragraphs.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: parseInlineRuns(line.slice(4)) }))
    } else if (/^## (.+)$/.test(line)) {
      paragraphs.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: parseInlineRuns(line.slice(3)) }))
    } else if (/^# (.+)$/.test(line)) {
      paragraphs.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: parseInlineRuns(line.slice(2)) }))
    } else if (/^[-*] (.+)$/.test(line)) {
      paragraphs.push(new Paragraph({ bullet: { level: 0 }, children: parseInlineRuns(line.replace(/^[-*] /, '')) }))
    } else if (/^---+$/.test(line.trim())) {
      paragraphs.push(new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 1 } },
        children: []
      }))
    } else if (line.trim() === '') {
      paragraphs.push(new Paragraph({ children: [] }))
    } else {
      paragraphs.push(new Paragraph({ children: parseInlineRuns(line) }))
    }
  }

  const doc = new Document({
    styles: {
      paragraphStyles: [
        {
          id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', quickFormat: true,
          run: { size: 40, bold: true, color: '111111' },
          paragraph: { spacing: { after: 80 } }
        },
        {
          id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', quickFormat: true,
          run: { size: 26, bold: true, color: '222222' },
          paragraph: { spacing: { before: 360, after: 120 } }
        },
        {
          id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', quickFormat: true,
          run: { size: 22, bold: true, color: '333333' },
          paragraph: { spacing: { before: 240, after: 80 } }
        }
      ]
    },
    sections: [{ properties: {}, children: paragraphs }]
  })

  const buffer = await Packer.toBuffer(doc)
  writeFileSync(filePath, buffer)
  return { success: true, filePath }
})
