import React, { useState, useEffect } from 'react'
import { useStore } from './store'
import InterviewPage from './pages/InterviewPage'
import IntroPage from './pages/IntroPage'
import ImportPage from './pages/ImportPage'

type Page = 'intro' | 'interview' | 'job-match' | 'generate' | 'import'

export default function App(): React.JSX.Element {
  const [page, setPage] = useState<Page>('intro')
  const [showSettings, setShowSettings] = useState(false)
  const [resetting, setResetting] = useState(false)
  const setProfile = useStore((s) => s.setProfile)

  // Load profile from disk on app start; skip intro if profile already exists
  useEffect(() => {
    const api = (window as any).api
    api.profile.read().then((profile: Record<string, unknown>) => {
      setProfile(profile)
      const personal = profile.personal as Record<string, unknown> | undefined
      const hasProfile = Boolean(personal?.fullName)
      if (hasProfile) {
        setPage('interview')
      }
    })
  }, [setProfile])

  async function handleReset(): Promise<void> {
    setResetting(true)
    const api = (window as any).api
    const fresh = await api.profile.reset()
    setProfile(fresh)
    setResetting(false)
    setShowSettings(false)
    setPage('intro')
  }

  // Show intro page fullscreen (no sidebar)
  if (page === 'intro') {
    return <IntroPage onContinue={() => setPage('interview')} />
  }

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 font-sans">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="px-5 py-6 border-b border-gray-800 flex items-start justify-between">
          <div>
            <h1 className="text-sm font-semibold text-white tracking-wide">Profile Builder</h1>
            <p className="text-xs text-gray-500 mt-0.5">Powered by Claude</p>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            title="Settings"
            className="mt-0.5 text-gray-600 hover:text-gray-300 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavItem label="Build Profile" active={page === 'interview'} onClick={() => setPage('interview')} />
          <NavItem label="Job Match" active={page === 'job-match'} onClick={() => setPage('job-match')} />
          <NavItem label="Generate Docs" active={page === 'generate'} onClick={() => setPage('generate')} />
        </nav>
        <div className="px-3 py-4 border-t border-gray-800 space-y-1">
          <button
            onClick={() => setPage('import')}
            className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
              page === 'import'
                ? 'bg-blue-600/20 text-blue-300 border border-blue-700/40'
                : 'text-gray-300 hover:text-white hover:bg-gray-800 border border-transparent'
            }`}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import documents
          </button>
          <button
            onClick={() => setPage('intro')}
            className="w-full text-left px-3 py-2 rounded-md text-xs text-gray-600 hover:text-gray-400 hover:bg-gray-800 transition-colors"
          >
            About this app
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {page === 'interview' && <InterviewPage />}
        {page === 'job-match' && <PlaceholderPage title="Job Match" description="Paste a job listing here to get a gap analysis." />}
        {page === 'generate' && <PlaceholderPage title="Generate Docs" description="Generate a tailored CV and cover letter." />}
        {page === 'import' && <ImportPage />}
      </main>

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-80 p-6 shadow-2xl">
            <h2 className="text-sm font-semibold text-white mb-1">Settings</h2>
            <p className="text-xs text-gray-500 mb-6">Manage your profile data</p>

            <div className="border border-red-900/50 rounded-lg p-4 mb-6">
              <p className="text-xs font-medium text-red-400 mb-1">Reset profile</p>
              <p className="text-xs text-gray-500 mb-3">Permanently deletes all saved profile data and returns to the start.</p>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="w-full px-3 py-2 rounded-md text-xs font-medium bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white transition-colors"
              >
                {resetting ? 'Resetting…' : 'Wipe profile & start over'}
              </button>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="w-full px-3 py-2 rounded-md text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
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
          : 'text-gray-400 hover:text-white hover:bg-gray-800'
      }`}
    >
      {label}
    </button>
  )
}

function PlaceholderPage({ title, description }: { title: string; description: string }): React.JSX.Element {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-white mb-2">{title}</h2>
        <p className="text-gray-400 text-sm">{description}</p>
      </div>
    </div>
  )
}
