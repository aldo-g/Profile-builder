import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import type { GapAnalysis } from '../../../schema/profile.schema'
import { JobListSidebar } from '../components/JobListSidebar'
import GapSidebar from '../components/GapSidebar'
import { GapQuestionList } from '../components/GapQuestionList'

const ROLE_TYPE_LABELS: Array<{ value: GapAnalysis['roleType']; label: string }> = [
  { value: 'ic-junior',           label: 'Junior IC' },
  { value: 'ic-senior',           label: 'Senior IC' },
  { value: 'tech-lead',           label: 'Tech Lead' },
  { value: 'engineering-manager', label: 'Engineering Manager' },
  { value: 'product',             label: 'Product' },
  { value: 'design',              label: 'Design' },
  { value: 'data',                label: 'Data' },
  { value: 'other',               label: 'Other' },
]

export default function JobMatchPage(): React.JSX.Element {
  const {
    setProfile,
    profile,
    setPage,
    jobSessions,
    activeJobId,
    createJobSession,
    deleteJobSession,
    setActiveJobId,
    updateJobSession
  } = useStore()

  const activeJob = jobSessions.find(j => j.id === activeJobId) ?? null

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Per-card UI state
  const [answerValue, setAnswerValue] = useState('')
  const [submittingIndex, setSubmittingIndex] = useState<number | null>(null)
  const submittingIndexRef = useRef<number | null>(null)
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null)
  const [proposedUpdates, setProposedUpdates] = useState<Record<string, unknown> | null>(null)
  const [agentMessage, setAgentMessage] = useState<string | null>(null)

  const [showGapWarning, setShowGapWarning] = useState(false)

  function showToast(message: string, type: 'success' | 'error' = 'success'): void {
    setToast({ message, type })
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), type === 'error' ? 8000 : 4000)
  }

  // Reset answer and selection when switching jobs
  useEffect(() => {
    setAnswerValue('')
    setSelectedCardIndex(null)
  }, [activeJobId])

  // Register job IPC listeners
  useEffect(() => {
    const api = (window as any).api
    if (!api?.job || !activeJobId) return

    const removeDone = api.job.onDone((payload: any) => {
      const idx = submittingIndexRef.current
      submittingIndexRef.current = null
      setSubmittingIndex(null)
      const proposed = payload.proposedUpdates ?? null
      setAgentMessage(payload.agentResponse?.message ?? null)
      if (proposed) {
        setProposedUpdates(proposed)
      } else {
        const job = useStore.getState().jobSessions.find(j => j.id === activeJobId)
        if (job && idx !== null) {
          updateJobSession(activeJobId, { answered: [...job.answered, idx] })
        }
        setAnswerValue('')
        setSelectedCardIndex(null)
      }
    })

    const removeError = api.job.onError((payload: any) => {
      submittingIndexRef.current = null
      setSubmittingIndex(null)
      showToast(payload?.error ?? 'Unknown error', 'error')
    })

    return () => { removeDone(); removeError() }
  }, [activeJobId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAnalyse(jobId: string): Promise<void> {
    const job = useStore.getState().jobSessions.find(j => j.id === jobId)
    if (!job?.jobText.trim()) return
    updateJobSession(jobId, { analysing: true, analysis: null, cardIndex: 0, answered: [], skipped: [], answers: {} })
    try {
      const api = (window as any).api
      const result = await api.job.analyse({
        jobText: job.jobText,
        profile: useStore.getState().profile
      })
      const analysis: GapAnalysis = result.analysis
      const autoName = [analysis.jobTitle, analysis.company].filter(Boolean).join(' · ') || 'Untitled role'
      updateJobSession(jobId, { analysis, name: autoName, analysing: false })
    } catch {
      updateJobSession(jobId, { analysing: false })
    }
  }

  async function handleSubmitAnswer(): Promise<void> {
    if (!activeJob || !activeJob.analysis || selectedCardIndex === null) return
    const text = answerValue.trim()
    if (!text || submittingIndex !== null) return
    submittingIndexRef.current = selectedCardIndex
    setSubmittingIndex(selectedCardIndex)
    updateJobSession(activeJob.id, {
      answers: { ...activeJob.answers, [selectedCardIndex]: text }
    })
    const api = (window as any).api
    const state = useStore.getState()
    const cards = buildCards(activeJob.analysis)
    const card = cards[selectedCardIndex]
    await api.job.chat({
      message: `${card.question}\n\nMy answer: ${text}`,
      conversationHistory: [],
      jobText: activeJob.jobText,
      analysis: activeJob.analysis,
      profile: state.profile
    })
  }

  async function handleConfirmUpdate(): Promise<void> {
    if (!proposedUpdates) return
    const api = (window as any).api
    const updated = await api.job.confirmUpdate(proposedUpdates)
    setProfile(updated)
    const labels: Record<string, string> = {
      personal: 'Personal info', workExperience: 'Work experience',
      education: 'Education', certifications: 'Certifications',
      skills: 'Skills', portfolio: 'Portfolio',
      languages: 'Languages', softSkills: 'Soft skills', summary: 'Summary'
    }
    showToast(`Saved to profile: ${Object.keys(proposedUpdates).map(k => labels[k] ?? k).join(', ')}`)
    setProposedUpdates(null)
    setAgentMessage(null)
    const job = useStore.getState().jobSessions.find(j => j.id === activeJobId)
    if (job && selectedCardIndex !== null) {
      updateJobSession(activeJobId!, { answered: [...job.answered, selectedCardIndex] })
    }
    setAnswerValue('')
    setSelectedCardIndex(null)
  }

  function handleDismissUpdate(): void {
    setProposedUpdates(null)
    setAgentMessage(null)
    const job = useStore.getState().jobSessions.find(j => j.id === activeJobId)
    if (job && selectedCardIndex !== null) {
      updateJobSession(activeJobId!, { answered: [...job.answered, selectedCardIndex] })
    }
    setAnswerValue('')
    setSelectedCardIndex(null)
  }

  function handleSkip(idx: number): void {
    if (!activeJob) return
    updateJobSession(activeJob.id, { skipped: [...activeJob.skipped, idx] })
    if (selectedCardIndex === idx) {
      setProposedUpdates(null)
      setAgentMessage(null)
      setAnswerValue('')
      setSelectedCardIndex(null)
    }
  }

  function handleNewJob(): void {
    createJobSession()
    setAnswerValue('')
  }

  function handleGenerateClick(cards: Array<{ skill: string; question: string }>, answeredSet: Set<number>, skippedSet: Set<number>): void {
    const unanswered = cards.filter((_, i) => !answeredSet.has(i) && !skippedSet.has(i)).length
    if (unanswered > 0) {
      setShowGapWarning(true)
    } else {
      setPage('generate')
    }
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
            <p className="text-gray-400 dark:text-gray-500 text-sm mb-4">No job selected</p>
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
  const answeredSet = new Set(activeJob.answered)
  const skippedSet = new Set(activeJob.skipped)

  // ── Input phase (no analysis yet) ──────────────────────────────────────────
  if (!activeJob.analysis) {
    return (
      <div className="flex h-full relative">
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
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Job Match</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Paste a job listing below. Claude will score your fit and generate targeted questions for each gap.
            </p>
            <textarea
              value={activeJob.jobText}
              onChange={(e) => updateJobSession(activeJob.id, { jobText: e.target.value })}
              disabled={activeJob.analysing}
              placeholder="Paste the full job listing here…"
              rows={14}
              className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => handleAnalyse(activeJob.id)}
                disabled={activeJob.analysing || !activeJob.jobText.trim()}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors"
              >
                Analyse job listing
              </button>
            </div>
          </div>
        </div>

        {activeJob.analysing && <AnalysingOverlay />}
      </div>
    )
  }

  // ── Analysis done — cards + sidebar ────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden relative">
      {/* Toast */}
      {toast && (
        <div className={`absolute bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 text-xs font-medium px-4 py-2.5 rounded-xl shadow-lg pointer-events-none max-w-sm text-center ${
          toast.type === 'error'
            ? 'bg-red-700/90 dark:bg-red-900/90 border border-red-600 dark:border-red-700 text-white dark:text-red-300'
            : 'bg-green-700/90 dark:bg-green-900/90 border border-green-600 dark:border-green-700 text-white dark:text-green-300'
        }`}>
          {toast.type === 'error' ? (
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {toast.message}
        </div>
      )}

      {/* Sidebar: job list + gap analysis */}
      <aside className={`${sidebarOpen ? 'w-72' : 'w-10'} flex-shrink-0 border-r border-gray-200 dark:border-gray-800 overflow-y-auto flex flex-col transition-all duration-200`}>
        {/* Sidebar header: back button + toggle */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          {sidebarOpen && (
            <button
              onClick={() => setActiveJobId(null)}
              className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Jobs
            </button>
          )}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className={`text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors ${sidebarOpen ? '' : 'mx-auto'}`}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d={sidebarOpen ? 'M11 19l-7-7 7-7m8 14l-7-7 7-7' : 'M13 5l7 7-7 7M5 5l7 7-7 7'} />
            </svg>
          </button>
        </div>

        {sidebarOpen && (
          <JobListSidebar
            sessions={jobSessions}
            activeJobId={activeJobId}
            onSelect={setActiveJobId}
            onNew={handleNewJob}
            onDelete={deleteJobSession}
            onRename={(id, name) => updateJobSession(id, { name })}
            embedded
          />
        )}

        {sidebarOpen && (
          <GapSidebar
            analysis={activeJob.analysis!}
            cards={cards}
            answeredSet={answeredSet}
            skippedSet={skippedSet}
            selectedCardIndex={selectedCardIndex}
          />
        )}
      </aside>

      {/* Right: question list + generate */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="px-8 py-8 max-w-2xl mx-auto w-full">
          {/* Header with job title + progress */}
          <div className="mb-6">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white leading-tight">
                  {activeJob.analysis!.jobTitle || 'Job Match'}
                </h2>
                {activeJob.analysis!.company && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{activeJob.analysis!.company}</p>
                )}
              </div>
              <ScorePill score={activeJob.analysis!.score} />
            </div>
            {cards.length > 0 && (
              <GapProgressBar total={cards.length} answered={answeredSet.size} skipped={skippedSet.size} />
            )}
          </div>

          {cards.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-green-200 dark:border-green-800/50 bg-green-50 dark:bg-green-900/10">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-500/20 border border-green-300 dark:border-green-500/30 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">Strong match</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">No skill gaps identified — you're well-positioned for this role.</p>
            </div>
          ) : (
            <GapQuestionList
              cards={cards}
              answeredSet={answeredSet}
              skippedSet={skippedSet}
              selectedIndex={selectedCardIndex}
              onSelect={(i) => {
                if (selectedCardIndex === i) {
                  setSelectedCardIndex(null)
                  setAnswerValue('')
                  setProposedUpdates(null)
                  setAgentMessage(null)
                } else {
                  // If re-opening an answered/skipped card, remove it from those sets
                  const job = useStore.getState().jobSessions.find(j => j.id === activeJobId)
                  if (job) {
                    const newAnswered = job.answered.filter(idx => idx !== i)
                    const newSkipped = job.skipped.filter(idx => idx !== i)
                    if (newAnswered.length !== job.answered.length || newSkipped.length !== job.skipped.length) {
                      updateJobSession(activeJobId!, { answered: newAnswered, skipped: newSkipped })
                    }
                  }
                  setSelectedCardIndex(i)
                  setAnswerValue('')
                  setProposedUpdates(null)
                  setAgentMessage(null)
                }
              }}
              answerValue={answerValue}
              onAnswerChange={setAnswerValue}
              onSubmit={handleSubmitAnswer}
              onSkip={handleSkip}
              submittingIndex={submittingIndex}
              proposedUpdates={proposedUpdates}
              agentMessage={agentMessage}
              onConfirmUpdate={handleConfirmUpdate}
              onDismissUpdate={handleDismissUpdate}
            />
          )}

          {/* Role type + narrative angle confirmation row */}
          {activeJob.analysis && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-24 flex-shrink-0">Role type</span>
                <select
                  value={activeJob.analysis.roleType || 'other'}
                  onChange={(e) => {
                    updateJobSession(activeJob.id, {
                      analysis: { ...activeJob.analysis!, roleType: e.target.value as GapAnalysis['roleType'] }
                    })
                  }}
                  className="text-xs font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-600/40 rounded-full px-2.5 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {ROLE_TYPE_LABELS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-24 flex-shrink-0 pt-2">Narrative</span>
                <textarea
                  value={activeJob.analysis.narrativeAngle || ''}
                  onChange={(e) => {
                    updateJobSession(activeJob.id, {
                      analysis: { ...activeJob.analysis!, narrativeAngle: e.target.value }
                    })
                  }}
                  rows={2}
                  placeholder="No narrative angle inferred — you can add one manually."
                  className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Generate button */}
          <div className="mt-6 pt-5 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Ready to generate?</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {answeredSet.size} of {cards.length} gaps answered
                  {activeJob.generatedDocs && ' · docs ready'}
                </p>
              </div>
              <button
                onClick={() => handleGenerateClick(cards, answeredSet, skippedSet)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
              >
                {activeJob.generatedDocs ? 'View / Regenerate' : 'Generate CV & Cover Letter'}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Submitting answer overlay */}
      {submittingIndex !== null && !proposedUpdates && <SubmittingOverlay />}

      {/* Profile update modal */}
      {proposedUpdates && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-500/20 border border-green-300 dark:border-green-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Add to your profile?</p>
                {agentMessage && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3">{agentMessage}</p>
                )}
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Would be saved to:</p>
                <ul className="space-y-1.5">
                  {Object.entries(proposedUpdates).map(([key, val]) => {
                    const labels: Record<string, string> = {
                      personal: 'Personal info', workExperience: 'Work experience',
                      education: 'Education', certifications: 'Certifications',
                      skills: 'Skills', portfolio: 'Portfolio',
                      languages: 'Languages', softSkills: 'Soft skills', summary: 'Summary',
                      extras: 'Extras'
                    }
                    const count = Array.isArray(val) ? val.length
                      : typeof val === 'object' && val !== null ? Object.keys(val as object).length
                      : 1
                    return (
                      <li key={key} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800/60 rounded-lg px-3 py-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 dark:bg-green-400 flex-shrink-0" />
                        <span className="text-xs text-gray-600 dark:text-gray-200 font-medium">profile.json</span>
                        <span className="text-xs text-gray-400">→</span>
                        <span className="text-xs text-green-600 dark:text-green-300 font-mono">{key}</span>
                        {count > 1 && <span className="text-xs text-gray-400 ml-auto">({count} items)</span>}
                        {count === 1 && <span className="text-xs text-gray-400 ml-auto">{labels[key] ?? key}</span>}
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={handleDismissUpdate}
                className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors"
              >
                Don't add
              </button>
              <button
                onClick={handleConfirmUpdate}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Add to profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gap warning modal */}
      {showGapWarning && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Unanswered gaps</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  You have {cards.filter((_, i) => !answeredSet.has(i) && !skippedSet.has(i)).length} unanswered question{cards.filter((_, i) => !answeredSet.has(i) && !skippedSet.has(i)).length !== 1 ? 's' : ''}. Answering them helps Claude write a stronger, more tailored application.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowGapWarning(false)}
                className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors"
              >
                Go back
              </button>
              <button
                onClick={() => { setShowGapWarning(false); setPage('generate') }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors"
              >
                Generate anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Submitting answer overlay ──────────────────────────────────────────────────

function SubmittingOverlay(): React.JSX.Element {
  const [dot, setDot] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setDot(d => (d + 1) % 3), 500)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/80 dark:bg-gray-950/85 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 shadow-2xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-center mb-6">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
            <div className="absolute inset-1 rounded-full bg-blue-500/30 animate-ping [animation-delay:150ms]" />
            <div className="relative w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center">
              <svg className="w-7 h-7 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
          </div>
        </div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white text-center mb-1">Processing your answer</h3>
        <p className="text-xs text-gray-400 text-center">
          Claude is reviewing your response{'.'.repeat(dot + 1)}
        </p>
      </div>
    </div>
  )
}

// ── Analysing overlay ──────────────────────────────────────────────────────────

function AnalysingOverlay(): React.JSX.Element {
  const [step, setStep] = useState(0)
  const steps = [
    { label: 'Reading job listing…', icon: '📄' },
    { label: 'Comparing to your profile…', icon: '🔍' },
    { label: 'Scoring your fit…', icon: '📊' },
    { label: 'Generating gap questions…', icon: '✍️' },
  ]

  useEffect(() => {
    const timings = [0, 1800, 3800, 5600]
    const timers = timings.map((delay, i) =>
      setTimeout(() => setStep(i), delay)
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/80 dark:bg-gray-950/85 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 shadow-2xl w-full max-w-sm mx-4">
        {/* Animated pulse ring */}
        <div className="flex items-center justify-center mb-6">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
            <div className="absolute inset-1 rounded-full bg-blue-500/30 animate-ping [animation-delay:150ms]" />
            <div className="relative w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center">
              <svg className="w-7 h-7 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-gray-900 dark:text-white text-center mb-1">Analysing job listing</h3>
        <p className="text-xs text-gray-400 text-center mb-6">This takes a few seconds…</p>

        {/* Step list */}
        <div className="space-y-3">
          {steps.map((s, i) => {
            const done = i < step
            const active = i === step
            return (
              <div key={i} className={`flex items-center gap-3 transition-all duration-300 ${i > step ? 'opacity-30' : ''}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm transition-all duration-300 ${
                  done ? 'bg-green-100 dark:bg-green-500/20'
                  : active ? 'bg-blue-100 dark:bg-blue-500/20'
                  : 'bg-gray-100 dark:bg-gray-800'
                }`}>
                  {done ? (
                    <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span>{s.icon}</span>
                  )}
                </div>
                <span className={`text-xs transition-all duration-300 ${
                  done ? 'text-gray-400 dark:text-gray-500 line-through'
                  : active ? 'text-gray-900 dark:text-white font-medium'
                  : 'text-gray-400 dark:text-gray-500'
                }`}>
                  {s.label}
                </span>
                {active && (
                  <div className="ml-auto flex gap-0.5">
                    {[0, 1, 2].map(d => (
                      <div key={d} className="w-1 h-1 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: `${d * 150}ms` }} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Score pill (compact, for the main header) ──────────────────────────────────

function ScorePill({ score }: { score: number }): React.JSX.Element {
  const { bg, text, label } = score >= 70
    ? { bg: 'bg-green-100 dark:bg-green-500/15 border-green-300 dark:border-green-600/40', text: 'text-green-700 dark:text-green-300', label: 'Strong match' }
    : score >= 40
    ? { bg: 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-600/40', text: 'text-amber-700 dark:text-amber-300', label: 'Partial match' }
    : { bg: 'bg-red-50 dark:bg-red-500/10 border-red-300 dark:border-red-600/40', text: 'text-red-600 dark:text-red-400', label: 'Weak match' }

  return (
    <div className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full border ${bg}`}>
      <span className={`text-xl font-bold leading-none ${text}`}>{score}</span>
      <div>
        <p className={`text-xs font-medium leading-none ${text}`}>/100</p>
        <p className={`text-xs leading-none mt-0.5 ${text} opacity-70`}>{label}</p>
      </div>
    </div>
  )
}

// ── Gap progress bar ───────────────────────────────────────────────────────────

function GapProgressBar({ total, answered, skipped }: { total: number; answered: number; skipped: number }): React.JSX.Element {
  const answeredPct = (answered / total) * 100
  const skippedPct = (skipped / total) * 100
  const remaining = total - answered - skipped

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {answered} answered · {skipped} skipped · {remaining} remaining
        </span>
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{total} gaps</span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex">
        <div
          className="h-full bg-green-500 transition-all duration-500 rounded-l-full"
          style={{ width: `${answeredPct}%` }}
        />
        <div
          className="h-full bg-gray-300 dark:bg-gray-600 transition-all duration-500"
          style={{ width: `${skippedPct}%` }}
        />
      </div>
    </div>
  )
}

function buildCards(analysis: GapAnalysis): Array<{ skill: string; question: string }> {
  return analysis.missingSkills.map(skill => ({
    skill,
    question: analysis.skillQuestions?.[skill] ?? `Do you have any experience with ${skill}? If so, please describe it.`
  }))
}
