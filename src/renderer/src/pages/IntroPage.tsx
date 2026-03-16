import React, { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'

interface IntroPageProps {
  onContinue: () => void
}

export default function IntroPage({ onContinue }: IntroPageProps): React.JSX.Element {
  const [step, setStep] = useState<'api-key' | 'import'>('api-key')
  const [apiKey, setApiKey] = useState('')
  const [apiKeyError, setApiKeyError] = useState('')
  const [apiKeySaving, setApiKeySaving] = useState(false)
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [isDraggingCv, setIsDraggingCv] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const cvInputRef = useRef<HTMLInputElement>(null)
  const apiKeyInputRef = useRef<HTMLInputElement>(null)
  const setProfile = useStore((s) => s.setProfile)

  // Load saved key on mount; if already set, skip to import step
  useEffect(() => {
    const api = (window as any).api
    api.settings?.getApiKey().then((key: string | null) => {
      if (key) {
        setApiKey(key)
        setStep('import')
      }
    }).catch(() => {})
  }, [])

  const hasBaseline = cvFile !== null

  async function handleSaveApiKey(): Promise<void> {
    const trimmed = apiKey.trim()
    if (!trimmed.startsWith('sk-ant-')) {
      setApiKeyError('Key must start with sk-ant-')
      apiKeyInputRef.current?.focus()
      return
    }
    setApiKeyError('')
    setApiKeySaving(true)
    try {
      const api = (window as any).api
      await api.settings.setApiKey(trimmed)
      setStep('import')
    } catch (err: unknown) {
      setApiKeyError(err instanceof Error ? err.message : 'Failed to save key. Please try again.')
    } finally {
      setApiKeySaving(false)
    }
  }

  function handleCvDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault()
    setIsDraggingCv(false)
    const file = e.dataTransfer.files[0]
    if (file?.type === 'application/pdf') setCvFile(file)
  }

  async function handleContinue(): Promise<void> {
    if (!hasBaseline) {
      onContinue()
      return
    }

    setIsImporting(true)
    setImportError(null)

    try {
      const api = (window as any).api
      const webUtils = (window as any).electron?.webUtils
      const cvPath: string | undefined = cvFile
        ? (webUtils?.getPathForFile(cvFile) || (cvFile as any).path || undefined)
        : undefined

      console.log('[IntroPage] cvFile:', cvFile?.name, 'cvPath:', cvPath)

      const updatedProfile = await api.imports.baseline({ cvPath })
      setProfile(updatedProfile)
      onContinue()
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Import failed. Please try again.')
      setIsImporting(false)
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden">

      {/* Full-page importing overlay */}
      {isImporting && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-5">
            <svg className="w-10 h-10 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <div className="text-center">
              <p className="text-gray-900 dark:text-white font-semibold text-base">Reading your CV…</p>
              <p className="text-gray-500 text-sm mt-1">Claude is extracting your career history</p>
            </div>
          </div>
        </div>
      )}

      {/* Left panel — hero */}
      <div className="relative flex flex-col justify-between w-[52%] flex-shrink-0 px-14 py-12 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,rgba(59,130,246,0.06),transparent_70%)]" />

        {/* Wordmark */}
        <div className="flex items-center gap-2.5 relative z-10">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-white tracking-wide">Profile Builder</span>
          <span className="text-xs text-gray-400 ml-1">by Claude</span>
        </div>

        {/* Hero */}
        <div className="relative z-10">
          <p className="text-xs font-semibold text-blue-500 dark:text-blue-400 tracking-widest uppercase mb-4">AI-powered career mapping</p>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white leading-[1.15] mb-5">
            Every role.<br />Every skill.<br />Nothing left out.
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed max-w-sm mb-10">
            Profile Builder interviews you to build a complete, structured record of your career — then uses it to tailor CVs and cover letters to any job, automatically.
          </p>

          <div className="space-y-6">
            <Step
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>}
              title="Deep interview"
              description="Claude goes section by section — work, education, skills, projects. Nothing is skipped."
            />
            <Step
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>}
              title="Gap analysis"
              description="Drop in any job listing and Claude finds what's missing, then asks targeted questions."
            />
            <Step
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
              title="Tailored documents"
              description="Get a CV and cover letter written for that exact role — not a template, your actual experience."
            />
          </div>
        </div>

        {/* Privacy */}
        <div className="relative z-10 flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-xs text-gray-400">
            Stored locally as <code className="text-gray-500">profile.json</code> — never uploaded anywhere.
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="w-px bg-gray-200 dark:bg-gray-800 flex-shrink-0" />

      {/* Right panel */}
      <div className="flex-1 flex flex-col justify-center px-12 py-12 overflow-y-auto">
        <div className="max-w-sm w-full mx-auto">

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            <StepDot active={step === 'api-key'} done={step === 'import'} label="1" />
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
            <StepDot active={step === 'import'} done={false} label="2" />
          </div>

          {step === 'api-key' ? (
            <>
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Add your API key</h2>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Profile Builder uses the Claude API. Your key is stored locally and never leaves your device.
                </p>
              </div>

              <div className="mb-2">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Claude API key
                </label>
                <input
                  ref={apiKeyInputRef}
                  type="password"
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setApiKeyError('') }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveApiKey() }}
                  placeholder="sk-ant-api03-…"
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-lg text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                />
                {apiKeyError && (
                  <p className="mt-1.5 text-xs text-red-500">{apiKeyError}</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => (window as any).api?.shell?.openExternal('https://console.anthropic.com/settings/keys')}
                className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400 mb-8 transition-colors"
              >
                Get a key at console.anthropic.com
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>

              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 mb-8">
                <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Saved to your local system keychain. Never sent to any server other than Anthropic's API.
                </p>
              </div>

              <button
                onClick={handleSaveApiKey}
                disabled={apiKeySaving || !apiKey.trim()}
                className="w-full py-3 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {apiKeySaving ? 'Saving…' : 'Continue'}
              </button>
            </>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Give Claude a head start</h2>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Import your CV so Claude can pre-fill your history. Or skip and start fresh.
                </p>
              </div>

              <div className="mb-8">
                <DropZone
                  label="CV / résumé"
                  hint="PDF"
                  accept=".pdf"
                  file={cvFile}
                  isDragging={isDraggingCv}
                  inputRef={cvInputRef}
                  onDragOver={() => setIsDraggingCv(true)}
                  onDragLeave={() => setIsDraggingCv(false)}
                  onDrop={handleCvDrop}
                  onSelect={(f) => setCvFile(f)}
                  onClear={() => setCvFile(null)}
                  icon={
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  }
                />
              </div>

              {importError && (
                <div className="mb-4 px-3 py-2.5 bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-900 rounded-lg">
                  <p className="text-xs text-red-500 dark:text-red-400">{importError}</p>
                </div>
              )}

              <div className="space-y-2.5">
                <button
                  onClick={handleContinue}
                  disabled={isImporting}
                  className="w-full py-3 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {hasBaseline ? 'Import and build my profile' : 'Start from scratch'}
                </button>
                {hasBaseline && !isImporting && (
                  <button
                    onClick={onContinue}
                    className="w-full py-2.5 rounded-lg text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-400 transition-colors"
                  >
                    Skip and start fresh
                  </button>
                )}
                <button
                  onClick={() => setStep('api-key')}
                  className="w-full py-2 rounded-lg text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
                >
                  ← Change API key
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}

interface DropZoneProps {
  label: string
  hint: string
  accept: string
  file: File | null
  isDragging: boolean
  inputRef: React.RefObject<HTMLInputElement>
  onDragOver: () => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void
  onSelect: (file: File) => void
  onClear: () => void
  icon: React.ReactNode
}

function DropZone({ label, hint, accept, file, isDragging, inputRef, onDragOver, onDragLeave, onDrop, onSelect, onClear, icon }: DropZoneProps): React.JSX.Element {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">{label}</label>
      <div
        onDragOver={(e) => { e.preventDefault(); onDragOver() }}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !file && inputRef.current?.click()}
        className={`relative rounded-lg border-2 border-dashed transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-500/5'
            : file
            ? 'border-green-500 dark:border-green-800 bg-green-50 dark:bg-green-950/30 cursor-default'
            : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-100/50 dark:hover:bg-gray-900/40 cursor-pointer'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onSelect(f) }}
        />

        {file ? (
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="w-8 h-8 rounded-md bg-green-100 dark:bg-green-900/50 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-green-600 dark:text-green-400 font-medium truncate">{file.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onClear() }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0 p-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-4">
            <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-center flex-shrink-0">
              {icon}
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Drop here or <span className="text-blue-500 dark:text-blue-400">browse</span></p>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{hint}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }): React.JSX.Element {
  return (
    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 transition-colors ${
      done
        ? 'bg-green-500 text-white'
        : active
        ? 'bg-blue-600 text-white'
        : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
    }`}>
      {done ? (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : label}
    </div>
  )
}

function Step({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }): React.JSX.Element {
  return (
    <div className="flex gap-3.5">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-center text-blue-500 dark:text-blue-400">
        {icon}
      </div>
      <div className="pt-0.5">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-0.5">{title}</h4>
        <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}
