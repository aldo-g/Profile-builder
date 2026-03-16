import React, { useState, useEffect, useRef } from 'react'
import { useStore, WIZARD_SECTIONS } from './store'
import InterviewPage from './pages/InterviewPage'
import IntroPage from './pages/IntroPage'
import ImportPage from './pages/ImportPage'
import JobMatchPage from './pages/JobMatchPage'
import GeneratePage from './pages/GeneratePage'
import WelcomeModal from './components/WelcomeModal'
import HistoryPage from './pages/HistoryPage'

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

  // Version history
  type SnapshotMeta = { id: string; label: string; savedAt: string; size: number }
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([])
  const [loadingSnapshots, setLoadingSnapshots] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [savingSnapshot, setSavingSnapshot] = useState(false)
  const [snapshotMsg, setSnapshotMsg] = useState('')

  const [apiKey, setApiKeyState] = useState('')
  const [apiKeySaved, setApiKeySaved] = useState(false)
  const [apiKeyError, setApiKeyError] = useState('')
  const setProfile = useStore((s) => s.setProfile)
  const [dark, toggleDark] = useDarkMode()
  const [showWelcome, setShowWelcome] = useState(false)

  // Template state
  const [templateStatus, setTemplateStatus] = useState<{ cv: boolean; coverLetter: boolean }>({ cv: false, coverLetter: false })
  const cvInputRef = useRef<HTMLInputElement>(null)
  const clInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const api = (window as any).api
    api.templates?.check().then(setTemplateStatus)
    api.settings?.getApiKey().then((key: string | null) => {
      if (key) setApiKeyState(key)
    })
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
    // Show welcome modal on first launch
    if (!localStorage.getItem('welcome-seen')) {
      setShowWelcome(true)
    }
  }, [setProfile, setPage])

  function handleWelcomeDismiss(): void {
    localStorage.setItem('welcome-seen', '1')
    setShowWelcome(false)
  }

  function handleWelcomeGetStarted(): void {
    localStorage.setItem('welcome-seen', '1')
    setShowWelcome(false)
    setPage('interview' as const)
  }

  async function loadSnapshots(): Promise<void> {
    setLoadingSnapshots(true)
    const api = (window as any).api
    const list = await api.versions.list()
    setSnapshots(list)
    setLoadingSnapshots(false)
  }

  async function handleRestoreSnapshot(id: string): Promise<void> {
    setRestoringId(id)
    setSnapshotMsg('')
    const api = (window as any).api
    const restored = await api.versions.restore(id)
    setProfile(restored)
    setSnapshotMsg('Profile restored.')
    await loadSnapshots()
    setRestoringId(null)
    setTimeout(() => setSnapshotMsg(''), 3000)
  }

  async function handleDeleteSnapshot(id: string): Promise<void> {
    setDeletingId(id)
    const api = (window as any).api
    await api.versions.delete(id)
    setSnapshots(prev => prev.filter(s => s.id !== id))
    setDeletingId(null)
  }

  async function handleSaveManualSnapshot(): Promise<void> {
    setSavingSnapshot(true)
    setSnapshotMsg('')
    const api = (window as any).api
    await api.versions.saveManual('Manual snapshot')
    await loadSnapshots()
    setSavingSnapshot(false)
    setSnapshotMsg('Snapshot saved.')
    setTimeout(() => setSnapshotMsg(''), 3000)
  }

  async function handleSaveApiKey(): Promise<void> {
    const trimmed = apiKey.trim()
    if (!trimmed.startsWith('sk-ant-')) {
      setApiKeyError('Key should start with sk-ant-')
      return
    }
    setApiKeyError('')
    const api = (window as any).api
    await api.settings.setApiKey(trimmed)
    setApiKeySaved(true)
    setTimeout(() => setApiKeySaved(false), 2000)
  }

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
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans">
      {/* Sidebar + main content */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
          <div className="px-5 py-6 border-b border-gray-200 dark:border-gray-800 flex items-start justify-between">
            <div>
              <h1 className="text-sm font-semibold text-gray-900 dark:text-white tracking-wide">Profile Builder</h1>
              <p className="text-xs text-gray-400 mt-0.5">Powered by Claude</p>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              {/* Settings */}
              <button
                onClick={() => {
                  setDedupeError('')
                  setDedupeMessage('')
                  setSnapshotMsg('')
                  setShowSettings(true)
                  loadSnapshots()
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
            <NavItem label="History" active={page === 'history'} onClick={() => setPage('history' as const)} />
          </nav>
          <ProfileCompletenessWidget onNavigate={() => setPage('interview' as const)} />

          <div className="flex-1" />

          {/* Template upload — always visible */}
          <div className="px-3 pb-2 flex flex-col gap-3">
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
              onClick={() => setShowWelcome(true)}
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
          {page === 'generate' && <GeneratePage templateStatus={templateStatus} />}
          {page === 'import' && <ImportPage />}
          {page === 'history' && <HistoryPage />}
        </main>
      </div>

      {/* Full-width GitHub footer */}
      <footer className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-2.5 flex items-center justify-center gap-2">
        <button
          onClick={() => (window as any).api?.shell?.openExternal('https://github.com/aldo-g/Profile-builder')}
          className="flex items-center gap-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors group"
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
          <span className="text-xs">Open source on GitHub</span>
          <span className="text-xs text-gray-300 dark:text-gray-600">·</span>
          <span className="text-xs">Contributions & feature requests welcome</span>
        </button>
      </footer>

      {/* Welcome / About modal */}
      {showWelcome && (
        <WelcomeModal
          onGetStarted={handleWelcomeGetStarted}
          onClose={handleWelcomeDismiss}
        />
      )}

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl w-96 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Settings</h2>
            <p className="text-xs text-gray-500 mb-6">Manage your profile data</p>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Claude API key</p>
              <p className="text-xs text-gray-500 mb-3">Your key is saved locally and never leaves your device.</p>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => { setApiKeyState(e.target.value); setApiKeySaved(false); setApiKeyError('') }}
                placeholder="sk-ant-…"
                className="w-full px-3 py-2 rounded-md text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 mb-2"
              />
              {apiKeyError && <p className="text-xs text-red-500 mb-2">{apiKeyError}</p>}
              <button
                onClick={handleSaveApiKey}
                className="w-full px-3 py-2 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                {apiKeySaved ? 'Saved!' : 'Save key'}
              </button>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">Appearance</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{dark ? 'Dark mode' : 'Light mode'}</span>
                <button
                  onClick={toggleDark}
                  title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white transition-colors"
                >
                  {dark ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  )}
                  {dark ? 'Light' : 'Dark'}
                </button>
              </div>
            </div>

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

            {/* ── Version history ─────────────────────────────── */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Profile history</p>
                <button
                  onClick={handleSaveManualSnapshot}
                  disabled={savingSnapshot}
                  className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-700 dark:text-white transition-colors"
                >
                  {savingSnapshot ? 'Saving…' : 'Save snapshot'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-3">Automatic snapshots are saved before every profile update. Click Restore to roll back.</p>
              {snapshotMsg && (
                <p className="text-xs text-green-600 dark:text-green-400 mb-2">{snapshotMsg}</p>
              )}
              {loadingSnapshots ? (
                <p className="text-xs text-gray-400">Loading…</p>
              ) : snapshots.length === 0 ? (
                <p className="text-xs text-gray-400">No snapshots yet.</p>
              ) : (
                <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {snapshots.map(s => (
                    <li key={s.id} className="flex items-center gap-2 text-xs">
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-gray-700 dark:text-gray-300 font-medium">{s.label}</p>
                        <p className="text-gray-400">
                          {new Date(s.savedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          {' · '}{(s.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <button
                        onClick={() => handleRestoreSnapshot(s.id)}
                        disabled={restoringId === s.id}
                        className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/60 disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        {restoringId === s.id ? '…' : 'Restore'}
                      </button>
                      <button
                        onClick={() => handleDeleteSnapshot(s.id)}
                        disabled={deletingId === s.id}
                        className="px-1.5 py-0.5 rounded text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors"
                        title="Delete snapshot"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
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

function ProfileCompletenessWidget({ onNavigate }: { onNavigate: () => void }): React.JSX.Element {
  const profile = useStore((s) => s.profile)
  const [expanded, setExpanded] = useState(false)
  const completedCount = WIZARD_SECTIONS.filter(s => s.completionCheck(profile)).length
  const pct = Math.round((completedCount / WIZARD_SECTIONS.length) * 100)

  return (
    <div className="mx-3 mb-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Profile</span>
            <span className="text-xs text-gray-400">{pct}%</span>
          </div>
          <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                backgroundColor: pct === 100 ? '#22c55e' : pct >= 60 ? '#3b82f6' : '#f59e0b'
              }}
            />
          </div>
        </div>
        <svg
          className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-2 space-y-1">
          {WIZARD_SECTIONS.map((section) => {
            const done = section.completionCheck(profile)
            return (
              <button
                key={section.id}
                onClick={onNavigate}
                className="w-full flex items-center gap-2 py-0.5 text-left group"
              >
                {done ? (
                  <svg className="w-3 h-3 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="w-3 h-3 flex-shrink-0 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
                  </span>
                )}
                <span className={`text-xs truncate ${done ? 'text-gray-500 dark:text-gray-400' : 'text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400'}`}>
                  {section.label}
                </span>
              </button>
            )
          })}
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
