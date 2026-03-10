import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import type { GapAnalysis, GeneratedDocs } from '../../../schema/profile.schema'
import { JobListSidebar } from '../components/JobListSidebar'
import GapSidebar from '../components/GapSidebar'
import { GapQuestionList } from '../components/GapQuestionList'
import DocumentViewer from '../components/DocumentViewer'

export default function JobMatchPage(): React.JSX.Element {
  const {
    setProfile,
    jobSessions,
    activeJobId,
    createJobSession,
    deleteJobSession,
    setActiveJobId,
    updateJobSession
  } = useStore()

  const { profile } = useStore()

  const activeJob = jobSessions.find(j => j.id === activeJobId) ?? null

  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Per-card UI state
  const [answerValue, setAnswerValue] = useState('')
  const [submittingIndex, setSubmittingIndex] = useState<number | null>(null)
  const submittingIndexRef = useRef<number | null>(null)
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null)
  const [proposedUpdates, setProposedUpdates] = useState<Record<string, unknown> | null>(null)
  const [agentMessage, setAgentMessage] = useState<string | null>(null)

  // Generation state
  const [generateStatus, setGenerateStatus] = useState<'idle' | 'generating' | 'done' | 'error'>('idle')
  const [generateError, setGenerateError] = useState('')
  const [streamingText, setStreamingText] = useState('')
  const [showGapWarning, setShowGapWarning] = useState(false)
  const streamEndRef = useRef<HTMLDivElement>(null)
  const docsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (activeJob?.generatedDocs) setGenerateStatus('done')
    else setGenerateStatus('idle')
  }, [activeJob?.id])

  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [streamingText])

  function showToast(message: string): void {
    setToast(message)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 4000)
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

    const removeError = api.job.onError((_payload: any) => {
      submittingIndexRef.current = null
      setSubmittingIndex(null)
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

  async function startGenerate(): Promise<void> {
    if (!activeJob?.analysis) return
    setShowGapWarning(false)
    setGenerateStatus('generating')
    setStreamingText('')
    setGenerateError('')

    const api = (window as any).api
    let cvTemplateText = ''
    let coverLetterTemplateText: string | undefined
    try {
      const cvResult = await api.templates.read({ type: 'cv' })
      cvTemplateText = cvResult.text
      try {
        const clResult = await api.templates.read({ type: 'coverLetter' })
        coverLetterTemplateText = clResult.text
      } catch { /* no cover letter template — optional */ }
    } catch (err: unknown) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to read template.')
      setGenerateStatus('error')
      return
    }

    const removeStream = api.generate.onStream((chunk: string) => {
      setStreamingText(prev => prev + chunk)
    })
    const removeDone = api.generate.onDone((result: unknown) => {
      removeStream(); removeDone(); removeGenError()
      const docs = result as GeneratedDocs
      updateJobSession(activeJob.id, { generatedDocs: docs, generating: false })
      setGenerateStatus('done')
      setStreamingText('')
      setTimeout(() => docsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    })
    const removeGenError = api.generate.onError((payload: { error: string }) => {
      removeStream(); removeDone(); removeGenError()
      setGenerateError(payload.error)
      setGenerateStatus('error')
      updateJobSession(activeJob.id, { generating: false })
    })

    updateJobSession(activeJob.id, { generating: true })

    const gapAnswers: Record<string, string> = {}
    if (activeJob.answers && activeJob.analysis) {
      activeJob.analysis.missingSkills.forEach((skill: string, i: number) => {
        if (activeJob.answers[i]) gapAnswers[skill] = activeJob.answers[i]
      })
    }

    await api.generate.docs({
      profile,
      analysis: activeJob.analysis,
      cvTemplateText,
      coverLetterTemplateText,
      gapAnswers: Object.keys(gapAnswers).length > 0 ? gapAnswers : undefined
    })
  }

  function handleGenerateClick(cards: Array<{ skill: string; question: string }>, answeredSet: Set<number>, skippedSet: Set<number>): void {
    const unanswered = cards.filter((_, i) => !answeredSet.has(i) && !skippedSet.has(i)).length
    if (unanswered > 0) {
      setShowGapWarning(true)
    } else {
      startGenerate()
    }
  }

  function handleEdit(tab: 'cv' | 'cover-letter', markdown: string): void {
    if (!activeJob?.generatedDocs) return
    const updated = tab === 'cv'
      ? { ...activeJob.generatedDocs, cvMarkdown: markdown }
      : { ...activeJob.generatedDocs, coverLetterMarkdown: markdown }
    updateJobSession(activeJob.id, { generatedDocs: updated })
  }

  async function handleExportPdf(tab: 'cv' | 'cover-letter', markdown: string): Promise<void> {
    if (!activeJob?.generatedDocs) return
    const api = (window as any).api
    const company = activeJob.generatedDocs.company || activeJob.analysis?.company || 'application'
    const filename = tab === 'cv' ? `CV - ${company}.pdf` : `Cover Letter - ${company}.pdf`
    await api.generate.pdf({ markdown, filename })
  }

  async function handleExportDocx(tab: 'cv' | 'cover-letter', markdown: string): Promise<void> {
    if (!activeJob?.generatedDocs) return
    const api = (window as any).api
    const company = activeJob.generatedDocs.company || activeJob.analysis?.company || 'application'
    const filename = tab === 'cv' ? `CV - ${company}.docx` : `Cover Letter - ${company}.docx`
    await api.generate.docx({ markdown, filename })
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
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-green-700/90 dark:bg-green-900/90 border border-green-600 dark:border-green-700 text-white dark:text-green-300 text-xs font-medium px-4 py-2.5 rounded-xl shadow-lg pointer-events-none whitespace-nowrap">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {toast}
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
          {cards.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400 dark:text-gray-500 text-sm">No missing skills identified — strong match!</p>
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

          {/* Generate button */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Generate documents</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {answeredSet.size} of {cards.length} gaps answered
                </p>
              </div>
              <button
                onClick={() => handleGenerateClick(cards, answeredSet, skippedSet)}
                disabled={generateStatus === 'generating'}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
              >
                {generateStatus === 'generating' ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Generating…
                  </>
                ) : activeJob.generatedDocs ? 'Regenerate' : 'Generate CV & Cover Letter'}
              </button>
            </div>

            {/* Streaming preview */}
            {generateStatus === 'generating' && (
              <div className="mt-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 max-h-32 overflow-y-auto">
                <p className="text-xs text-gray-400 mb-1">Claude is writing…</p>
                <pre className="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap font-mono">{streamingText || ' '}</pre>
                <div ref={streamEndRef} />
              </div>
            )}

            {/* Error */}
            {generateStatus === 'error' && generateError && (
              <div className="mt-3 px-3 py-2.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg">
                <p className="text-xs text-red-500 dark:text-red-400">{generateError}</p>
              </div>
            )}
          </div>

          {/* Inline document viewer */}
          {activeJob.generatedDocs && (
            <div ref={docsRef} className="mt-6">
              <DocumentViewer
                docs={activeJob.generatedDocs}
                onExportPdf={handleExportPdf}
                onExportDocx={handleExportDocx}
                onEdit={handleEdit}
                maxHeight="max-h-[600px]"
              />
            </div>
          )}
        </div>
      </div>

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
                onClick={startGenerate}
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

function buildCards(analysis: GapAnalysis): Array<{ skill: string; question: string }> {
  return analysis.missingSkills.map(skill => ({
    skill,
    question: analysis.skillQuestions?.[skill] ?? `Do you have any experience with ${skill}? If so, please describe it.`
  }))
}
