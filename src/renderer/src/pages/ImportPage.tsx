import React, { useRef, useState } from 'react'
import { useStore } from '../store'

type Status = 'idle' | 'loading' | 'done' | 'error'

export default function ImportPage(): React.JSX.Element {
  const setProfile = useStore((s) => s.setProfile)
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [rawText, setRawText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function runImport(payload: { cvPath?: string; linkedinZipPath?: string; rawText?: string }): Promise<void> {
    setStatus('loading')
    setMessage('')
    try {
      const api = (window as any).api
      const result = await api.imports.baseline(payload)
      const importedSections: string[] = result._importedSections ?? []
      const { _importedSections: _, ...profileData } = result
      setProfile(profileData)
      await api.profile.write(profileData)
      setStatus('done')
      if (importedSections.length === 0) {
        setMessage("Nothing could be extracted — Claude didn't find any recognisable profile data in the text.")
      } else {
        const labels: Record<string, string> = {
          personal: 'personal info', workExperience: 'work experience', education: 'education',
          certifications: 'certifications', skills: 'skills', portfolio: 'portfolio',
          languages: 'languages', softSkills: 'soft skills', summary: 'summary'
        }
        const readable = importedSections.map(k => labels[k] ?? k).join(', ')
        setMessage(`Updated: ${readable}.`)
      }
    } catch (err: unknown) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Import failed. Please try again.')
    }
  }

  async function handleFile(file: File): Promise<void> {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'pdf' && ext !== 'zip') {
      setStatus('error')
      setMessage('Unsupported file type. Please drop a PDF or LinkedIn ZIP export.')
      return
    }
    const webUtils = (window as any).electron?.webUtils
    const filePath: string = webUtils?.getPathForFile(file) ?? (file as any).path ?? ''
    const payload = ext === 'zip' ? { linkedinZipPath: filePath } : { cvPath: filePath }
    await runImport(payload)
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function onSelect(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  async function handleTextSubmit(): Promise<void> {
    const trimmed = rawText.trim()
    if (!trimmed) return
    await runImport({ rawText: trimmed })
    setRawText('')
  }

  const isLoading = status === 'loading'

  return (
    <div className="flex flex-col h-full overflow-y-auto px-8 py-8 max-w-xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">Import documents</h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          Add a CV, LinkedIn export, or paste any text — Claude will extract and merge it into your profile without overwriting existing data.
        </p>
      </div>

      {/* File drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => !isLoading && inputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed transition-all cursor-pointer mb-5 ${
          isDragging
            ? 'border-blue-500 bg-blue-500/5'
            : isLoading
            ? 'border-gray-700 bg-gray-900/40 cursor-not-allowed'
            : 'border-gray-700 hover:border-gray-600 hover:bg-gray-900/40'
        }`}
      >
        <input ref={inputRef} type="file" accept=".pdf,.zip" className="hidden" onChange={onSelect} />
        <div className="flex flex-col items-center justify-center py-8 px-6 text-center">
          {isLoading ? (
            <>
              <svg className="w-7 h-7 animate-spin text-blue-500 mb-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-gray-400">Claude is reading your document…</p>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center mb-2.5">
                <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <p className="text-sm text-gray-300 mb-0.5">Drop a file or <span className="text-blue-400">browse</span></p>
              <p className="text-xs text-gray-600">PDF (CV / résumé) · ZIP (LinkedIn data export)</p>
            </>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-gray-800" />
        <span className="text-xs text-gray-600">or paste text</span>
        <div className="flex-1 h-px bg-gray-800" />
      </div>

      {/* Text paste area */}
      <div className="mb-4">
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          disabled={isLoading}
          placeholder="Paste anything — a job history, LinkedIn About section, bio, old CV text…"
          rows={6}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors resize-none disabled:opacity-50"
        />
        <button
          onClick={handleTextSubmit}
          disabled={isLoading || !rawText.trim()}
          className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
        >
          {isLoading ? 'Importing…' : 'Import text'}
        </button>
      </div>

      {/* Status feedback */}
      {status === 'done' && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-green-950/50 border border-green-900 rounded-lg">
          <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-xs text-green-400">{message}</p>
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-red-950/50 border border-red-900 rounded-lg">
          <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <p className="text-xs text-red-400">{message}</p>
        </div>
      )}
    </div>
  )
}
