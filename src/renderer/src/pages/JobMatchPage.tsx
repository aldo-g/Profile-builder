import React, { useEffect, useRef, useState } from 'react'
import { useStore, JobSession } from '../store'
import type { GapAnalysis, GeneratedDocs } from '../../../../schema/profile.schema'

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
  const [docTab, setDocTab] = useState<'cv' | 'cover-letter'>('cv')
  const [docViewMode, setDocViewMode] = useState<'preview' | 'raw'>('preview')
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
        // Show confirmation — don't close or mark answered yet
        setProposedUpdates(proposed)
      } else {
        // No profile update suggested — mark answered and close
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
      // Auto-name from extracted title/company
      const autoName = [analysis.jobTitle, analysis.company].filter(Boolean).join(' · ') || 'Untitled role'
      updateJobSession(jobId, { analysis, name: autoName, analysing: false })
    } catch (err: unknown) {
      updateJobSession(jobId, { analysing: false })
    }
  }

  async function handleSubmitAnswer(): Promise<void> {
    if (!activeJob || !activeJob.analysis || selectedCardIndex === null) return
    const text = answerValue.trim()
    if (!text || submittingIndex !== null) return
    submittingIndexRef.current = selectedCardIndex
    setSubmittingIndex(selectedCardIndex)
    // Persist the answer text in the session regardless of profile update
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
    updateJobSession(activeJob.id, {
      skipped: [...activeJob.skipped, idx]
    })
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
      activeJob.analysis.missingSkills.forEach((skill, i) => {
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

  async function handleExportPdf(tab: 'cv' | 'cover-letter'): Promise<void> {
    if (!activeJob?.generatedDocs) return
    const api = (window as any).api
    const markdown = tab === 'cv' ? activeJob.generatedDocs.cvMarkdown : activeJob.generatedDocs.coverLetterMarkdown
    const company = activeJob.generatedDocs.company || activeJob.analysis?.company || 'application'
    const filename = tab === 'cv' ? `CV - ${company}.pdf` : `Cover Letter - ${company}.pdf`
    await api.generate.pdf({ markdown, filename })
  }

  async function handleExportDocx(tab: 'cv' | 'cover-letter'): Promise<void> {
    if (!activeJob?.generatedDocs) return
    const api = (window as any).api
    const markdown = tab === 'cv' ? activeJob.generatedDocs.cvMarkdown : activeJob.generatedDocs.coverLetterMarkdown
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
      <aside className={`${sidebarOpen ? 'w-72' : 'w-10'} flex-shrink-0 border-r border-gray-800 overflow-y-auto flex flex-col transition-all duration-200`}>
        {/* Sidebar header: back button + toggle */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 flex-shrink-0">
          {sidebarOpen && (
            <button
              onClick={() => setActiveJobId(null)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Jobs
            </button>
          )}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className={`text-gray-500 hover:text-gray-300 transition-colors ${sidebarOpen ? '' : 'mx-auto'}`}
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

        {/* Gap analysis section */}
        {sidebarOpen && <div className="px-5 py-4 border-t border-gray-800 flex-1">
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
                const isCurrent = cardIdx === selectedCardIndex
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
        </div>}
      </aside>

      {/* Right: question list + generate */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="px-8 py-8 max-w-2xl mx-auto w-full">
          {cards.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500 text-sm">No missing skills identified — strong match!</p>
            </div>
          ) : (
            <QuestionList
              cards={cards}
              answeredSet={answeredSet}
              skippedSet={skippedSet}
              selectedIndex={selectedCardIndex}
              onSelect={(i) => {
                if (selectedCardIndex === i) { setSelectedCardIndex(null); setAnswerValue(''); setProposedUpdates(null); setAgentMessage(null) }
                else { setSelectedCardIndex(i); setAnswerValue(''); setProposedUpdates(null); setAgentMessage(null) }
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
          <div className="mt-8 pt-6 border-t border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-medium text-white">Generate documents</p>
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
              <div className="mt-3 bg-gray-900 border border-gray-800 rounded-xl p-4 max-h-32 overflow-y-auto">
                <p className="text-xs text-gray-600 mb-1">Claude is writing…</p>
                <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono">{streamingText || ' '}</pre>
                <div ref={streamEndRef} />
              </div>
            )}

            {/* Error */}
            {generateStatus === 'error' && generateError && (
              <div className="mt-3 px-3 py-2.5 bg-red-950/50 border border-red-900 rounded-lg">
                <p className="text-xs text-red-400">{generateError}</p>
              </div>
            )}
          </div>

          {/* Inline docs */}
          {activeJob.generatedDocs && (
            <div ref={docsRef} className="mt-6 border border-gray-800 rounded-xl overflow-hidden">
              {/* Tab + export toolbar */}
              <div className="flex items-center border-b border-gray-800 bg-gray-900/60">
                <DocTabButton label="CV" active={docTab === 'cv'} onClick={() => setDocTab('cv')} />
                <DocTabButton label="Cover Letter" active={docTab === 'cover-letter'} onClick={() => setDocTab('cover-letter')} />
                <div className="flex-1" />
                <div className="flex items-center gap-1 mr-3">
                  <button
                    onClick={() => setDocViewMode('preview')}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${docViewMode === 'preview' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                  >Preview</button>
                  <button
                    onClick={() => setDocViewMode('raw')}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${docViewMode === 'raw' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                  >Raw</button>
                </div>
                <button
                  onClick={() => handleExportDocx(docTab)}
                  className="px-3 py-2.5 text-xs text-gray-400 hover:text-gray-200 font-medium transition-colors flex items-center gap-1.5 border-l border-gray-800"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                  </svg>
                  DOCX
                </button>
                <button
                  onClick={() => handleExportPdf(docTab)}
                  className="px-3 py-2.5 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors flex items-center gap-1.5 border-l border-gray-800"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                  </svg>
                  PDF
                </button>
              </div>
              {/* Content */}
              <div className="bg-[#1a1a1a] max-h-[600px] overflow-y-auto">
                {(() => {
                  const md = docTab === 'cv'
                    ? activeJob.generatedDocs.cvMarkdown
                    : activeJob.generatedDocs.coverLetterMarkdown
                  return docViewMode === 'preview' ? (
                    <div className="prose-doc-wrap">
                      <div className={`prose-doc${docTab === 'cover-letter' ? ' prose-cover-letter' : ''}`} dangerouslySetInnerHTML={{ __html: renderMarkdown(md) }} />
                    </div>
                  ) : (
                    <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed px-6 py-6">{md}</pre>
                  )
                })()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Profile update modal */}
      {proposedUpdates && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white mb-1">Add to your profile?</p>
                {agentMessage && (
                  <p className="text-xs text-gray-400 leading-relaxed mb-3">{agentMessage}</p>
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
                      <li key={key} className="flex items-center gap-2 bg-gray-800/60 rounded-lg px-3 py-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                        <span className="text-xs text-gray-200 font-medium">profile.json</span>
                        <span className="text-xs text-gray-500">→</span>
                        <span className="text-xs text-green-300 font-mono">{key}</span>
                        {count > 1 && <span className="text-xs text-gray-500 ml-auto">({count} items)</span>}
                        {count === 1 && <span className="text-xs text-gray-500 ml-auto">{labels[key] ?? key}</span>}
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={handleDismissUpdate}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
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
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white mb-1">Unanswered gaps</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  You have {cards.filter((_, i) => !answeredSet.has(i) && !skippedSet.has(i)).length} unanswered question{cards.filter((_, i) => !answeredSet.has(i) && !skippedSet.has(i)).length !== 1 ? 's' : ''}. Answering them helps Claude write a stronger, more tailored application.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowGapWarning(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
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

// ── Question list ─────────────────────────────────────────────────────────────

function QuestionList({
  cards, answeredSet, skippedSet, selectedIndex, onSelect,
  answerValue, onAnswerChange, onSubmit, onSkip, submittingIndex,
  proposedUpdates, agentMessage, onConfirmUpdate, onDismissUpdate
}: {
  cards: Array<{ skill: string; question: string }>
  answeredSet: Set<number>
  skippedSet: Set<number>
  selectedIndex: number | null
  onSelect: (i: number) => void
  answerValue: string
  onAnswerChange: (v: string) => void
  onSubmit: () => void
  onSkip: (i: number) => void
  submittingIndex: number | null
  proposedUpdates: Record<string, unknown> | null
  agentMessage: string | null
  onConfirmUpdate: () => void
  onDismissUpdate: () => void
}): React.JSX.Element {
  const pending = cards.filter((_, i) => !answeredSet.has(i) && !skippedSet.has(i))
  const done = cards.filter((_, i) => answeredSet.has(i) || skippedSet.has(i))

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 mb-4">
        {answeredSet.size} of {cards.length} gaps addressed · click a question to answer it
      </p>

      {pending.map((card) => {
        const globalI = cards.indexOf(card)
        const isOpen = selectedIndex === globalI
        return (
          <QuestionRow
            key={globalI}
            card={card}
            status="pending"
            isOpen={isOpen}
            onSelect={() => onSelect(globalI)}
            answerValue={answerValue}
            onAnswerChange={onAnswerChange}
            onSubmit={onSubmit}
            onSkip={() => onSkip(globalI)}
            submitting={submittingIndex === globalI}
            proposedUpdates={isOpen ? proposedUpdates : null}
            agentMessage={isOpen ? agentMessage : null}
            onConfirmUpdate={onConfirmUpdate}
            onDismissUpdate={onDismissUpdate}
          />
        )
      })}

      {done.length > 0 && (
        <div className="space-y-1 pt-2">
          {done.map((card) => {
            const globalI = cards.indexOf(card)
            return (
              <QuestionRow
                key={globalI}
                card={card}
                status={answeredSet.has(globalI) ? 'answered' : 'skipped'}
                isOpen={false}
                onSelect={() => {}}
                answerValue=""
                onAnswerChange={() => {}}
                onSubmit={() => {}}
                onSkip={() => {}}
                submitting={false}
                proposedUpdates={null}
                agentMessage={null}
                onConfirmUpdate={() => {}}
                onDismissUpdate={() => {}}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function QuestionRow({
  card, status, isOpen, onSelect,
  answerValue, onAnswerChange, onSubmit, onSkip, submitting,
  proposedUpdates, agentMessage, onConfirmUpdate, onDismissUpdate
}: {
  card: { skill: string; question: string }
  status: 'pending' | 'answered' | 'skipped'
  isOpen: boolean
  onSelect: () => void
  answerValue: string
  onAnswerChange: (v: string) => void
  onSubmit: () => void
  onSkip: () => void
  submitting: boolean
  proposedUpdates: Record<string, unknown> | null
  agentMessage: string | null
  onConfirmUpdate: () => void
  onDismissUpdate: () => void
}): React.JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (isOpen) textareaRef.current?.focus()
  }, [isOpen])

  // Compact single-line for completed/skipped rows
  if (status === 'answered' || status === 'skipped') {
    return (
      <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border ${
        status === 'answered'
          ? 'border-green-700/50 bg-green-900/10'
          : 'border-gray-800 bg-transparent opacity-40'
      }`}>
        <svg className={`w-3.5 h-3.5 flex-shrink-0 ${status === 'answered' ? 'text-green-500' : 'text-gray-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <span className={`text-xs font-medium rounded-full px-2 py-0.5 border flex-shrink-0 ${
          status === 'answered'
            ? 'bg-green-900/30 border-green-700/40 text-green-400'
            : 'bg-gray-800/50 border-gray-700/50 text-gray-500'
        }`}>
          {card.skill}
        </span>
        <span className="text-xs text-gray-600 truncate">{card.question}</span>
      </div>
    )
  }

  const rowBase = 'rounded-xl border transition-all duration-150 overflow-hidden'
  const rowStyle = isOpen
    ? `${rowBase} border-blue-500/50 bg-blue-600/5`
    : `${rowBase} border-gray-800 bg-gray-900/40 hover:border-gray-700 cursor-pointer`

  return (
    <div className={rowStyle}>
      {/* Header row */}
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer"
        onClick={onSelect}
      >
        {/* Chevron */}
        <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center mt-0.5">
          {isOpen ? (
            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium bg-blue-600/20 border border-blue-500/30 text-blue-300 rounded-full px-2.5 py-0.5 inline-block mb-1.5">
            {card.skill}
          </span>
          <p className={`text-sm leading-snug ${isOpen ? 'text-white font-medium' : 'text-gray-300'}`}>
            {card.question}
          </p>
        </div>
      </div>

      {/* Expanded answer area */}
      {isOpen && (
        <div className="px-4 pb-4 pt-1" onClick={(e) => e.stopPropagation()}>
          {proposedUpdates ? (
            /* Modal is handling confirmation — show a brief holding state */
            <div className="rounded-xl border border-green-700/30 bg-green-900/10 px-4 py-3 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-xs text-green-300">Profile update suggested — see popup</p>
            </div>
          ) : (
            <>
              <textarea
                ref={textareaRef}
                value={answerValue}
                onChange={(e) => onAnswerChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    if (answerValue.trim() && !submitting) onSubmit()
                  }
                }}
                disabled={submitting}
                placeholder="Type your answer here…"
                rows={4}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500 disabled:opacity-50"
              />
              <div className="mt-3 flex items-center justify-between">
                <button
                  onClick={onSkip}
                  disabled={submitting}
                  className="text-sm text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40"
                >
                  Skip
                </button>
                <button
                  onClick={onSubmit}
                  disabled={submitting || !answerValue.trim()}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {submitting ? (
                    <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>Saving…</>
                  ) : (
                    <>Submit <span className="opacity-40 text-xs ml-1">⌘↵</span></>
)}
                </button>
              </div>
            </>
          )}
        </div>
      )}
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

function DocTabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${
        active ? 'text-white border-blue-500' : 'text-gray-500 border-transparent hover:text-gray-300'
      }`}
    >
      {label}
    </button>
  )
}

function renderMarkdown(md: string): string {
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[-*•]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/^---+$/gm, '<hr>')
    .split('\n')
    .map(line => {
      if (/^<(h[1-3]|li|hr|ul|\/ul)/.test(line) || line.trim() === '') return line
      return `<p>${line}</p>`
    })
    .join('\n')
  html = html.replace(/((<li>[\s\S]*?<\/li>\n?)+)/g, '<ul>$1</ul>')
  return html
}
