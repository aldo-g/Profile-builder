import React, { useEffect, useRef, useState } from 'react'
import type { JobSession } from '../store'

export function JobListSidebar({
  sessions, activeJobId, onSelect, onNew, onDelete, onRename, embedded
}: {
  sessions: JobSession[]
  activeJobId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
  embedded?: boolean
}): React.JSX.Element {
  return (
    <div className={embedded ? 'border-b border-gray-200 dark:border-gray-800' : 'border-r border-gray-200 dark:border-gray-800 w-72 flex-shrink-0'}>
      <div className="px-4 py-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Jobs</span>
        <button
          onClick={onNew}
          className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors font-medium"
        >
          + New
        </button>
      </div>
      <div className="pb-2 max-h-[260px] overflow-y-auto">
        {sessions.length === 0 && (
          <p className="px-4 py-2 text-xs text-gray-400">No saved jobs yet</p>
        )}
        {sessions.map(job => (
          <JobListItem
            key={job.id}
            job={job}
            isActive={job.id === activeJobId}
            onSelect={() => onSelect(job.id)}
            onDelete={() => onDelete(job.id)}
            onRename={(name) => onRename(job.id, name)}
          />
        ))}
      </div>
    </div>
  )
}

function JobListItem({
  job, isActive, onSelect, onDelete, onRename
}: {
  job: JobSession
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
  onRename: (name: string) => void
}): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(job.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      setEditValue(job.name)
      setTimeout(() => inputRef.current?.select(), 0)
    }
  }, [editing])

  function commitRename(): void {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== job.name) onRename(trimmed)
    setEditing(false)
  }

  const progress = job.analysis
    ? Math.round(((job.answered.length) / Math.max(1, job.analysis.missingSkills.length)) * 100)
    : null

  return (
    <div
      onClick={onSelect}
      className={`group mx-2 mb-0.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        isActive
          ? 'bg-blue-50 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-700/40'
          : 'hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent'
      }`}
    >
      <div className="flex items-start gap-1 min-w-0">
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') setEditing(false)
                e.stopPropagation()
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full text-xs bg-gray-100 dark:bg-gray-800 border border-blue-400 dark:border-blue-500 rounded px-1.5 py-0.5 text-gray-900 dark:text-white focus:outline-none"
            />
          ) : (
            <p className={`text-xs font-medium truncate ${isActive ? 'text-blue-700 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
              {job.name}
            </p>
          )}
          {job.analysis && !editing && (
            <p className="text-xs text-gray-400 mt-0.5">
              {job.analysis.score}/100 fit
              {progress !== null && progress > 0 && ` · ${progress}% done`}
            </p>
          )}
          {job.analysing && !editing && (
            <p className="text-xs text-gray-400 mt-0.5">Analysing…</p>
          )}
        </div>
        {/* Actions — shown on hover */}
        {!editing && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); setEditing(true) }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Rename"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="text-gray-400 hover:text-red-400 transition-colors"
              title="Delete"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
