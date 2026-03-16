import React, { useState } from 'react'
import { useStore } from '../store'
import type { JobSession } from '../store'
import type { GeneratedDocs } from '../../../schema/profile.schema'
import DocumentViewer from '../components/DocumentViewer'

export default function HistoryPage(): React.JSX.Element {
  const { jobSessions, setPage, setActiveJobId } = useStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const withDocs = jobSessions
    .filter((j): j is JobSession & { generatedDocs: GeneratedDocs } => j.generatedDocs !== null)
    .sort((a, b) => b.generatedDocs.generatedAt - a.generatedDocs.generatedAt)

  const selected = withDocs.find(j => j.id === selectedId) ?? null

  async function handleExportPdf(tab: 'cv' | 'cover-letter', markdown: string): Promise<void> {
    if (!selected) return
    const api = (window as any).api
    const company = selected.generatedDocs.company || selected.analysis?.company || 'application'
    const filename = tab === 'cv' ? `CV - ${company}.pdf` : `Cover Letter - ${company}.pdf`
    await api.generate.pdf({ markdown, filename })
  }

  async function handleExportDocx(tab: 'cv' | 'cover-letter', markdown: string): Promise<void> {
    if (!selected) return
    const api = (window as any).api
    const company = selected.generatedDocs.company || selected.analysis?.company || 'application'
    const filename = tab === 'cv' ? `CV - ${company}.docx` : `Cover Letter - ${company}.docx`
    await api.generate.docx({ markdown, filename })
  }

  function handleRegenerate(session: JobSession): void {
    setActiveJobId(session.id)
    setPage('generate')
  }

  if (withDocs.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3">
        <p className="text-sm text-gray-400 dark:text-gray-600">No exports yet.</p>
        <p className="text-xs text-gray-400 dark:text-gray-600">
          Generate a CV and cover letter from the{' '}
          <button
            onClick={() => setPage('job-match')}
            className="text-blue-500 hover:text-blue-400 underline"
          >
            Job Match
          </button>{' '}
          page to see it here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* List panel */}
      <div className="w-64 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-y-auto">
        <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Export history</h2>
          <p className="text-xs text-gray-400 mt-0.5">{withDocs.length} application{withDocs.length !== 1 ? 's' : ''}</p>
        </div>
        <ul className="flex-1 py-2">
          {withDocs.map(session => (
            <HistoryListItem
              key={session.id}
              session={session}
              active={session.id === selectedId}
              onClick={() => setSelectedId(session.id)}
            />
          ))}
        </ul>
      </div>

      {/* Detail panel */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden px-6 py-5 gap-4">
        {selected ? (
          <>
            {/* Header */}
            <div className="flex items-start justify-between shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {selected.generatedDocs.jobTitle || 'Untitled role'}
                  {selected.generatedDocs.company && (
                    <span className="text-gray-400 dark:text-gray-500 font-normal"> · {selected.generatedDocs.company}</span>
                  )}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Generated {formatDate(selected.generatedDocs.generatedAt)}
                  {selected.overseerResult && (
                    <span className={`ml-2 font-medium ${
                      selected.overseerResult.score >= 8 ? 'text-green-600 dark:text-green-400' :
                      selected.overseerResult.score >= 6 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500 dark:text-red-400'
                    }`}>
                      {selected.overseerResult.score.toFixed(1)}/10
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => handleRegenerate(selected)}
                className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-700/60 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors shrink-0"
              >
                Regenerate
              </button>
            </div>

            {/* Document viewer */}
            <DocumentViewer
              docs={selected.generatedDocs}
              onExportPdf={handleExportPdf}
              onExportDocx={handleExportDocx}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-gray-400 dark:text-gray-600">Select an application to view its documents.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function HistoryListItem({
  session,
  active,
  onClick
}: {
  session: JobSession & { generatedDocs: GeneratedDocs }
  active: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <li>
      <button
        onClick={onClick}
        className={`w-full text-left px-4 py-3 transition-colors border-l-2 ${
          active
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50'
        }`}
      >
        <p className={`text-xs font-medium truncate ${active ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}>
          {session.generatedDocs.jobTitle || session.name || 'Untitled role'}
        </p>
        {session.generatedDocs.company && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{session.generatedDocs.company}</p>
        )}
        <p className="text-xs text-gray-400 mt-1">{formatDate(session.generatedDocs.generatedAt)}</p>
        {session.overseerResult && (
          <span className={`inline-block mt-1 text-xs font-medium ${
            session.overseerResult.score >= 8 ? 'text-green-600 dark:text-green-400' :
            session.overseerResult.score >= 6 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500 dark:text-red-400'
          }`}>
            {session.overseerResult.score.toFixed(1)}/10
          </span>
        )}
      </button>
    </li>
  )
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: diffDays > 365 ? 'numeric' : undefined })
}
