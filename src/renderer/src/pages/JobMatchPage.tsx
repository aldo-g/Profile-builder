import React, { useEffect, useRef, useState } from 'react'
import { useStore, JobSession } from '../store'
import type { GapAnalysis } from '../../../../schema/profile.schema'

export default function JobMatchPage(): React.JSX.Element {
  const {
    setProfile,
    jobSessions,
    activeJobId,
    createJobSession,
    deleteJobSession,
    setActiveJobId,
    updateJobSession,
    setPage
  } = useStore()

  const activeJob = jobSessions.find(j => j.id === activeJobId) ?? null

  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Per-card UI state (local — doesn't need to persist across navigation for now)
  const [answerValue, setAnswerValue] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function showToast(message: string): void {
    setToast(message)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 4000)
  }

  // Reset answer when switching jobs or cards
  useEffect(() => {
    setAnswerValue('')
  }, [activeJobId, activeJob?.cardIndex])

  // Register job IPC listeners — re-register when active job's cardIndex changes
  useEffect(() => {
    const api = (window as any).api
    if (!api?.job || !activeJobId) return

    const removeDone = api.job.onDone((payload: any) => {
      setSubmitting(false)
      if (payload.updatedProfile) {
        setProfile(payload.updatedProfile)
        const updates = payload.agentResponse?.profileUpdates
        if (updates && typeof updates === 'object' && Object.keys(updates).length > 0) {
          const labels: Record<string, string> = {
            personal: 'Personal info', workExperience: 'Work experience',
            education: 'Education', certifications: 'Certifications',
            skills: 'Skills', portfolio: 'Portfolio',
            languages: 'Languages', softSkills: 'Soft skills', summary: 'Summary'
          }
          showToast(`Saved to profile: ${Object.keys(updates).map(k => labels[k] ?? k).join(', ')}`)
        }
      }
      // Mark current card answered, advance
      const job = useStore.getState().jobSessions.find(j => j.id === activeJobId)
      if (job) {
        updateJobSession(activeJobId, {
          answered: [...job.answered, job.cardIndex],
          cardIndex: job.cardIndex + 1
        })
      }
      setAnswerValue('')
    })

    const removeError = api.job.onError((_payload: any) => {
      setSubmitting(false)
    })

    return () => { removeDone(); removeError() }
  }, [activeJobId, activeJob?.cardIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAnalyse(jobId: string): Promise<void> {
    const job = useStore.getState().jobSessions.find(j => j.id === jobId)
    if (!job?.jobText.trim()) return
    updateJobSession(jobId, { analysing: true, analysis: null, cardIndex: 0, answered: [], skipped: [] })
    try {
      const api = (window as any).api
      const result = await api.job.analyse({
        jobText: job.jobText,
        profile: useStore.getState().profile
      })
      const analysis: GapAnalysis = result.analysis
      // Auto-name from extracted title/company
      const autoName = [analysis.jobTitle, analysis.company].filter(Boolean).join(' · ') || 'Untitled role'
      updateJobSession(jobId, { analysis, name: autoName, analysing: false })
    } catch (err: unknown) {
      updateJobSession(jobId, { analysing: false })
    }
  }

  async function handleSubmitAnswer(): Promise<void> {
    if (!activeJob || !activeJob.analysis) return
    const text = answerValue.trim()
    if (!text || submitting) return
    setSubmitting(true)
    const api = (window as any).api
    const state = useStore.getState()
    const cards = buildCards(activeJob.analysis)
    const card = cards[activeJob.cardIndex]
    await api.job.chat({
      message: `${card.question}\n\nMy answer: ${text}`,
      conversationHistory: [],
      jobText: activeJob.jobText,
      analysis: activeJob.analysis,
      profile: state.profile
    })
  }

  function handleSkip(): void {
    if (!activeJob) return
    updateJobSession(activeJob.id, {
      skipped: [...activeJob.skipped, activeJob.cardIndex],
      cardIndex: activeJob.cardIndex + 1
    })
    setAnswerValue('')
  }

  function handleNewJob(): void {
    createJobSession()
    setAnswerValue('')
  }

  // ── No active job — empty state ─────────────────────────────────────────────
  if (!activeJob) {
    return (
      <div className="flex h-full">
        <JobListSidebar
          sessions={jobSessions}
          activeJobId={activeJobId}
          onSelect={setActiveJobId}
          onNew={handleNewJob}
          onDelete={deleteJobSession}
          onRename={(id, name) => updateJobSession(id, { name })}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 text-sm mb-4">No job selected</p>
            <button
              onClick={handleNewJob}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors"
            >
              + New job listing
            </button>
          </div>
        </div>
      </div>
    )
  }

  const cards = activeJob.analysis ? buildCards(activeJob.analysis) : []
  const allDone = cards.length > 0 && activeJob.cardIndex >= cards.length
  const answeredSet = new Set(activeJob.answered)
  const skippedSet = new Set(activeJob.skipped)

  // ── Input phase (no analysis yet) ──────────────────────────────────────────
  if (!activeJob.analysis) {
    return (
      <div className="flex h-full">
        <JobListSidebar
          sessions={jobSessions}
          activeJobId={activeJobId}
          onSelect={setActiveJobId}
          onNew={handleNewJob}
          onDelete={deleteJobSession}
          onRename={(id, name) => updateJobSession(id, { name })}
        />
        <div className="flex-1 flex items-start justify-center overflow-y-auto">
          <div className="w-full max-w-2xl px-8 py-12">
            <h2 className="text-xl font-semibold text-white mb-1">Job Match</h2>
            <p className="text-sm text-gray-400 mb-6">
              Paste a job listing below. Claude will score your fit and generate targeted questions for each gap.
            </p>
            <textarea
              value={activeJob.jobText}
              onChange={(e) => updateJobSession(activeJob.id, { jobText: e.target.value })}
              disabled={activeJob.analysing}
              placeholder="Paste the full job listing here…"
              rows={14}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => handleAnalyse(activeJob.id)}
                disabled={activeJob.analysing || !activeJob.jobText.trim()}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
              >
                {activeJob.analysing ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Analysing…
                  </>
                ) : 'Analyse job listing'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Analysis done — cards + sidebar ────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden relative">
      {/* Toast */}
      {toast && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-green-900/90 border border-green-700 text-green-300 text-xs font-medium px-4 py-2.5 rounded-xl shadow-lg pointer-events-none whitespace-nowrap">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {toast}
        </div>
      )}

      {/* Sidebar: job list + gap analysis */}
      <aside className="w-72 flex-shrink-0 border-r border-gray-800 overflow-y-auto flex flex-col">
        <JobListSidebar
          sessions={jobSessions}
          activeJobId={activeJobId}
          onSelect={setActiveJobId}
          onNew={handleNewJob}
          onDelete={deleteJobSession}
          onRename={(id, name) => updateJobSession(id, { name })}
          embedded
        />

        {/* Gap analysis section */}
        <div className="px-5 py-4 border-t border-gray-800 flex-1">
          <FitScoreBadge score={activeJob.analysis!.score} />

          {cards.length > 0 && (
            <p className="text-xs text-gray-500 mb-4">
              {answeredSet.size} of {cards.length} gaps addressed
            </p>
          )}

          <SidebarSection title="Missing Skills">
            <div className="flex flex-wrap gap-1.5 mt-2">
              {activeJob.analysis!.missingSkills.map((skill, i) => {
                const cardIdx = cards.findIndex(c => c.skill === skill)
                const isDone = answeredSet.has(cardIdx)
                const isSkipped = skippedSet.has(cardIdx)
                const isCurrent = cardIdx === activeJob.cardIndex && !allDone
                return (
                  <span key={i} className={`text-xs rounded-full px-2.5 py-1 border transition-colors ${
                    isDone ? 'bg-green-900/30 border-green-700/50 text-green-400'
                    : isSkipped ? 'bg-gray-800/50 border-gray-700/50 text-gray-600 line-through'
                    : isCurrent ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                    : 'bg-gray-800 border-gray-700 text-gray-400'
                  }`}>
                    {isDone ? '✓ ' : ''}{skill}
                  </span>
                )
              })}
            </div>
          </SidebarSection>

          <SidebarSection title="Experience to Highlight">
            <ul className="mt-2 space-y-1">
              {activeJob.analysis!.highlightExperience.map((item, i) => (
                <li key={i} className="text-xs text-gray-300 flex gap-2">
                  <span className="text-green-500 flex-shrink-0 mt-0.5">✓</span>{item}
                </li>
              ))}
            </ul>
          </SidebarSection>

          <SidebarSection title="Recommended Tweaks">
            <ul className="mt-2 space-y-1">
              {activeJob.analysis!.recommendedTweaks.map((tweak, i) => (
                <li key={i} className="text-xs text-gray-300 flex gap-2">
                  <span className="text-blue-400 flex-shrink-0 mt-0.5">→</span>{tweak}
                </li>
              ))}
            </ul>
          </SidebarSection>
        </div>
      </aside>

      {/* Right: question cards */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="px-8 py-8 max-w-2xl mx-auto w-full">
          {allDone ? (
            <DoneSummary
              total={cards.length}
              answeredCount={answeredSet.size}
              skippedCount={skippedSet.size}
              onNew={handleNewJob}
              onGenerate={() => setPage('generate')}
            />
          ) : cards.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500 text-sm">No missing skills identified — strong match!</p>
            </div>
          ) : (
            <QuestionCard
              skill={cards[activeJob.cardIndex].skill}
              question={cards[activeJob.cardIndex].question}
              index={activeJob.cardIndex}
              total={cards.length}
              value={answerValue}
              onChange={setAnswerValue}
              onSubmit={handleSubmitAnswer}
              onSkip={handleSkip}
              submitting={submitting}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildCards(analysis: GapAnalysis): Array<{ skill: string; question: string }> {
  return analysis.missingSkills.map(skill => ({
    skill,
    question: analysis.skillQuestions?.[skill] ?? `Do you have any experience with ${skill}? If so, please describe it.`
  }))
}

// ── Job list sidebar ──────────────────────────────────────────────────────────

function JobListSidebar({
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
    <div className={embedded ? 'border-b border-gray-800' : 'border-r border-gray-800 w-72 flex-shrink-0 h-full overflow-y-auto'}>
      <div className="px-4 py-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Jobs</span>
        <button
          onClick={onNew}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
        >
          + New
        </button>
      </div>
      <div className="pb-2">
        {sessions.length === 0 && (
          <p className="px-4 py-2 text-xs text-gray-600">No saved jobs yet</p>
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
        isActive ? 'bg-blue-600/20 border border-blue-700/40' : 'hover:bg-gray-800 border border-transparent'
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
              className="w-full text-xs bg-gray-800 border border-blue-500 rounded px-1.5 py-0.5 text-white focus:outline-none"
            />
          ) : (
            <p className={`text-xs font-medium truncate ${isActive ? 'text-white' : 'text-gray-300'}`}>
              {job.name}
            </p>
          )}
          {job.analysis && !editing && (
            <p className="text-xs text-gray-600 mt-0.5">
              {job.analysis.score}/100 fit
              {progress !== null && progress > 0 && ` · ${progress}% done`}
            </p>
          )}
          {job.analysing && !editing && (
            <p className="text-xs text-gray-600 mt-0.5">Analysing…</p>
          )}
        </div>
        {/* Actions — shown on hover */}
        {!editing && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); setEditing(true) }}
              className="text-gray-600 hover:text-gray-300 transition-colors"
              title="Rename"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="text-gray-600 hover:text-red-400 transition-colors"
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

// ── Question card ─────────────────────────────────────────────────────────────

function QuestionCard({
  skill, question, index, total, value, onChange, onSubmit, onSkip, submitting
}: {
  skill: string; question: string; index: number; total: number
  value: string; onChange: (v: string) => void
  onSubmit: () => void; onSkip: () => void; submitting: boolean
}): React.JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { textareaRef.current?.focus() }, [index])

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${(index / total) * 100}%` }} />
        </div>
        <span className="text-xs text-gray-500 flex-shrink-0">{index + 1} / {total}</span>
      </div>
      <div className="mb-3">
        <span className="text-xs font-medium bg-blue-600/20 border border-blue-500/30 text-blue-300 rounded-full px-3 py-1">{skill}</span>
      </div>
      <p className="text-white text-base font-medium leading-relaxed mb-6">{question}</p>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            if (value.trim() && !submitting) onSubmit()
          }
        }}
        disabled={submitting}
        placeholder="Type your answer here…"
        rows={5}
        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500 disabled:opacity-50"
      />
      <div className="mt-4 flex items-center justify-between">
        <button onClick={onSkip} disabled={submitting} className="text-sm text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40">
          Skip
        </button>
        <button
          onClick={onSubmit}
          disabled={submitting || !value.trim()}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
        >
          {submitting ? (
            <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>Saving…</>
          ) : (
            <>Save to profile <span className="opacity-40 text-xs ml-1">⌘↵</span></>
          )}
        </button>
      </div>
    </div>
  )
}

// ── Done summary ──────────────────────────────────────────────────────────────

function DoneSummary({ total, answeredCount, skippedCount, onNew, onGenerate }: {
  total: number; answeredCount: number; skippedCount: number; onNew: () => void; onGenerate: () => void
}): React.JSX.Element {
  return (
    <div className="text-center py-8">
      <div className="w-14 h-14 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
        <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">All gaps reviewed</h3>
      <p className="text-sm text-gray-400 mb-1">
        {answeredCount} of {total} answers saved to your profile
        {skippedCount > 0 && ` · ${skippedCount} skipped`}
      </p>
      <p className="text-xs text-gray-600 mb-8">Your profile has been updated.</p>
      <div className="flex gap-3 justify-center">
        <button onClick={onNew} className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm font-medium transition-colors">
          + Add another job listing
        </button>
        <button onClick={onGenerate} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors">
          Generate CV & Cover Letter →
        </button>
      </div>
    </div>
  )
}

// ── Misc ──────────────────────────────────────────────────────────────────────

function FitScoreBadge({ score }: { score: number }): React.JSX.Element {
  const colour = score >= 70 ? 'text-green-400 bg-green-400/10 border-green-700/40'
    : score >= 40 ? 'text-yellow-400 bg-yellow-400/10 border-yellow-700/40'
    : 'text-red-400 bg-red-400/10 border-red-700/40'
  const label = score >= 70 ? 'Strong match' : score >= 40 ? 'Partial match' : 'Weak match'
  return (
    <div className={`rounded-xl border px-4 py-3 mb-4 flex items-center justify-between ${colour}`}>
      <span className="text-xs font-medium">{label}</span>
      <span className="text-2xl font-bold">{score}<span className="text-sm font-normal opacity-60">/100</span></span>
    </div>
  )
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="mb-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{title}</p>
      {children}
    </div>
  )
}
