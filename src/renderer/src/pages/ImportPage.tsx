import React, { useRef, useState } from 'react'
import { useStore } from '../store'

type Status = 'idle' | 'loading' | 'done' | 'error'

export default function ImportPage(): React.JSX.Element {
  const setProfile = useStore((s) => s.setProfile)
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File): Promise<void> {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'pdf' && ext !== 'zip') {
      setStatus('error')
      setMessage('Unsupported file type. Please drop a PDF or LinkedIn ZIP export.')
      return
    }

    setStatus('loading')
    setMessage('')

    try {
      const api = (window as any).api
      const webUtils = (window as any).electron?.webUtils
      const filePath: string = webUtils?.getPathForFile(file) ?? (file as any).path ?? ''

      const payload = ext === 'zip'
        ? { linkedinZipPath: filePath }
        : { cvPath: filePath }

      const updated = await api.imports.baseline(payload)
      setProfile(updated)
      await api.profile.write(updated)
      setStatus('done')
      setMessage('Profile updated successfully.')
    } catch (err: unknown) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Import failed. Please try again.')
    }
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

  return (
    <div className="flex flex-col h-full overflow-y-auto px-8 py-8 max-w-xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">Import documents</h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          Drop a CV (PDF) or LinkedIn data export (ZIP) to extract and merge information into your profile. Existing data is kept — Claude only adds what's missing.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => status !== 'loading' && inputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed transition-all cursor-pointer mb-4 ${
          isDragging
            ? 'border-blue-500 bg-blue-500/5'
            : status === 'loading'
            ? 'border-gray-700 bg-gray-900/40 cursor-not-allowed'
            : 'border-gray-700 hover:border-gray-600 hover:bg-gray-900/40'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.zip"
          className="hidden"
          onChange={onSelect}
        />
        <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
          {status === 'loading' ? (
            <>
              <svg className="w-8 h-8 animate-spin text-blue-500 mb-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-gray-400">Claude is reading your document…</p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <p className="text-sm text-gray-300 mb-1">Drop a file or <span className="text-blue-400">browse</span></p>
              <p className="text-xs text-gray-600">PDF (CV / résumé) or ZIP (LinkedIn data export)</p>
            </>
          )}
        </div>
      </div>

      {/* Status message */}
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

      {/* Tips */}
      {status === 'idle' && (
        <div className="mt-6 space-y-2">
          <p className="text-[11px] font-medium text-gray-600 uppercase tracking-wider">What gets extracted</p>
          {[
            'Work experience — roles, companies, dates, achievements',
            'Education — degrees, institutions, qualifications',
            'Skills — technical skills, tools, and domains',
            'Certifications and credentials',
            'Portfolio projects and languages',
          ].map((tip) => (
            <div key={tip} className="flex items-start gap-2">
              <span className="text-gray-700 mt-0.5 flex-shrink-0">•</span>
              <p className="text-xs text-gray-600">{tip}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
