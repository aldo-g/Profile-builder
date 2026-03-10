import React, { useState, useEffect, useRef } from 'react'
import { useStore } from './store'
import InterviewPage from './pages/InterviewPage'
import IntroPage from './pages/IntroPage'
import ImportPage from './pages/ImportPage'
import JobMatchPage from './pages/JobMatchPage'

function useDarkMode(): [boolean, () => void] {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return [dark, () => setDark(d => !d)]
}

export default function App(): React.JSX.Element {
  const page = useStore((s) => s.page)
  const setPage = useStore((s) => s.setPage)
  const [showSettings, setShowSettings] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [deduping, setDeduping] = useState(false)
  const [dedupeMessage, setDedupeMessage] = useState('')
  const [dedupeError, setDedupeError] = useState('')
  const setProfile = useStore((s) => s.setProfile)
  const [dark, toggleDark] = useDarkMode()

  // Template state
  const [templateStatus, setTemplateStatus] = useState<{ cv: boolean; coverLetter: boolean }>({ cv: false, coverLetter: false })
  const cvInputRef = useRef<HTMLInputElement>(null)
  const clInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const api = (window as any).api
    api.templates?.check().then(setTemplateStatus)
  }, [])

  async function handleTemplateUpload(file: File, type: 'cv' | 'coverLetter'): Promise<void> {
    const webUtils = (window as any).electron?.webUtils
    const filePath: string = webUtils?.getPathForFile(file) ?? (file as any).path ?? ''
    if (!filePath) return
    const api = (window as any).api
    await api.templates?.save({ filePath, type })
    setTemplateStatus(prev => ({ ...prev, [type]: true }))
  }

  // Load profile from disk on app start; skip intro if profile already exists
  useEffect(() => {
    const api = (window as any).api
    api.profile.read().then((profile: Record<string, unknown>) => {
      setProfile(profile)
      const personal = profile.personal as Record<string, unknown> | undefined
      const hasProfile = Boolean(personal?.fullName)
      if (hasProfile) {
        setPage('interview' as const)
      }
    })
  }, [setProfile, setPage])

  async function handleDedupe(): Promise<void> {
    setDeduping(true)
    setDedupeError('')
    setDedupeMessage('')
    try {
      const api = (window as any).api
      const cleaned = await api.profile.dedupe()
      setProfile(cleaned)
      setDedupeMessage('Profile cleaned successfully.')
    } catch (err: unknown) {
      setDedupeError(err instanceof Error ? err.message : 'Deduplication failed. Please try again.')
    } finally {
      setDeduping(false)
    }
  }

  async function handleExport(): Promise<void> {
    setExporting(true)
    const api = (window as any).api
    await api.profile.export()
    setExporting(false)
  }

  async function handleReset(): Promise<void> {
    setResetting(true)
    const api = (window as any).api
    const fresh = await api.profile.reset()
    setProfile(fresh)
    setResetting(false)
    setShowSettings(false)
    setPage('intro' as const)
  }

  // Show intro page fullscreen (no sidebar)
  if (page === 'intro') {
    return <IntroPage onContinue={() => setPage('interview' as const)} />
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        <div className="px-5 py-6 border-b border-gray-200 dark:border-gray-800 flex items-start justify-between">
          <div>
            <h1 className="text-sm font-semibold text-gray-900 dark:text-white tracking-wide">Profile Builder</h1>
            <p className="text-xs text-gray-400 mt-0.5">Powered by Claude</p>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            {/* Theme toggle */}
            <button
              onClick={toggleDark}
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              {dark ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
            {/* Settings */}
            <button
              onClick={() => {
                setDedupeError('')
                setDedupeMessage('')
                setShowSettings(true)
              }}
              title="Settings"
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>
        <nav className="px-3 py-4 space-y-1">
          <NavItem label="Build Profile" active={page === 'interview'} onClick={() => setPage('interview' as const)} />
          <NavItem label="Job Match" active={page === 'job-match'} onClick={() => setPage('job-match' as const)} />
        </nav>

        {/* Template upload — always visible */}
        <div className="flex-1 px-3 pb-2 flex flex-col gap-3">
          <div className="border-t border-gray-200 dark:border-gray-800 pt-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-2">Templates</p>
            <SidebarTemplateCard
              label="CV Template"
              isReady={templateStatus.cv}
              inputRef={cvInputRef}
              onUpload={(file) => handleTemplateUpload(file, 'cv')}
            />
          </div>
          <SidebarTemplateCard
            label="Cover Letter"
            sublabel="optional"
            isReady={templateStatus.coverLetter}
            inputRef={clInputRef}
            onUpload={(file) => handleTemplateUpload(file, 'coverLetter')}
          />
        </div>
        <div className="px-3 py-4 border-t border-gray-200 dark:border-gray-800 space-y-1">
          <button
            onClick={() => setPage('import' as const)}
            className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
              page === 'import'
                ? 'bg-blue-600/20 text-blue-600 dark:text-blue-300 border border-blue-300 dark:border-blue-700/40'
                : 'text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent'
            }`}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import documents
          </button>
          <button
            onClick={() => setPage('intro' as const)}
            className="w-full text-left px-3 py-2 rounded-md text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            About this app
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {page === 'interview' && <InterviewPage />}
        {page === 'job-match' && <JobMatchPage />}
        {page === 'import' && <ImportPage />}
      </main>

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl w-80 p-6 shadow-2xl">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Settings</h2>
            <p className="text-xs text-gray-500 mb-6">Manage your profile data</p>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Export profile</p>
              <p className="text-xs text-gray-500 mb-3">Save your profile as a JSON file to your computer.</p>
              <div className="flex gap-2">
                <button
                  onClick={handleDedupe}
                  disabled={deduping}
                  className="flex-1 px-3 py-2 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-800 dark:text-white transition-colors"
                >
                  {deduping ? 'Cleaning…' : 'Deduplicate'}
                </button>
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="flex-1 px-3 py-2 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-800 dark:text-white transition-colors"
                >
                  {exporting ? 'Saving…' : 'Export JSON'}
                </button>
              </div>
              {dedupeMessage && (
                <p className="mt-3 text-xs text-green-600 dark:text-green-400">{dedupeMessage}</p>
              )}
              {dedupeError && (
                <p className="mt-3 text-xs text-red-500 dark:text-red-400">{dedupeError}</p>
              )}
            </div>

            <div className="border border-red-200 dark:border-red-900/50 rounded-lg p-4 mb-6">
              <p className="text-xs font-medium text-red-500 dark:text-red-400 mb-1">Reset profile</p>
              <p className="text-xs text-gray-500 mb-3">Permanently deletes all saved profile data and returns to the start.</p>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="w-full px-3 py-2 rounded-md text-xs font-medium bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white transition-colors"
              >
                {resetting ? 'Resetting…' : 'Wipe profile & start over'}
              </button>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="w-full px-3 py-2 rounded-md text-xs text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function NavItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      {label}
    </button>
  )
}

function SidebarTemplateCard({ label, sublabel, isReady, inputRef, onUpload }: {
  label: string
  sublabel?: string
  isReady: boolean
  inputRef: React.RefObject<HTMLInputElement>
  onUpload: (file: File) => void
}): React.JSX.Element {
  function handleDrop(e: React.DragEvent): void {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) onUpload(file)
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className={`rounded-lg border cursor-pointer transition-colors px-3 py-2 ${
        isReady
          ? 'border-green-400/60 dark:border-green-700/50 bg-green-50 dark:bg-green-900/10 hover:border-green-500 dark:hover:border-green-600/60'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/40'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".docx,.doc,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onUpload(f)
          e.target.value = ''
        }}
      />
      <div className="flex items-center gap-1.5">
        {isReady ? (
          <svg className="w-3 h-3 text-green-500 dark:text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 8l5-5m0 0l5 5m-5-5v12" />
          </svg>
        )}
        <span className="text-xs text-gray-800 dark:text-white">{label}</span>
        {sublabel && <span className="text-xs text-gray-400">({sublabel})</span>}
      </div>
      <p className="text-xs text-gray-400 pl-4.5 mt-0.5">
        {isReady ? 'Ready · click to replace' : 'Drop or click to upload'}
      </p>
    </div>
  )
}
