import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import type { GeneratedDocs, CompanyResearch } from '../../../schema/profile.schema'
import DocumentViewer from '../components/DocumentViewer'

type GenerateStatus = 'idle' | 'pre-generate' | 'researching' | 'confirming' | 'generating' | 'done' | 'error'
type GenerationPhase = 'writing' | 'reviewing' | 'refining'

// ─── Generation pipeline config ───────────────────────────────────────────────

const PIPELINE_STEPS: { phase: GenerationPhase; label: string; sublabel: string }[] = [
  { phase: 'writing',   label: 'Writing documents', sublabel: 'Tailoring CV & cover letter to the role' },
  { phase: 'reviewing', label: 'Quality review',    sublabel: 'Checking keyword coverage, tone & structure' },
  { phase: 'refining',  label: 'Refining',          sublabel: 'Editing flagged sections to improve score' },
]

function WritingIcon(): React.JSX.Element {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
    </svg>
  )
}

function ReviewIcon(): React.JSX.Element {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function RefineIcon(): React.JSX.Element {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
  )
}

const PHASE_ICONS: Record<GenerationPhase, React.JSX.Element> = {
  writing:   <WritingIcon />,
  reviewing: <ReviewIcon />,
  refining:  <RefineIcon />,
}

// ─── Stream preview ───────────────────────────────────────────────────────────

function StreamPreview({ text }: { text: string }): React.JSX.Element {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [text])
  const cleaned = text.replace(/\[(Overseer|Editor)[^\]]*\][^\n]*/g, '').trim()
  const preview = cleaned.slice(-400)
  return (
    <div className="bg-gray-950 rounded-lg px-4 py-3 h-28 overflow-hidden relative font-mono text-xs text-gray-400 leading-relaxed">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-gray-950 pointer-events-none z-10" />
      <pre className="whitespace-pre-wrap break-words">{preview}<span className="animate-pulse text-blue-400">▌</span></pre>
      <div ref={endRef} />
    </div>
  )
}

// ─── Generation progress panel ────────────────────────────────────────────────

function GenerationProgress({ phase, streamingText, hasRefining }: {
  phase: GenerationPhase
  streamingText: string
  hasRefining: boolean
}): React.JSX.Element {
  const steps = hasRefining ? PIPELINE_STEPS : PIPELINE_STEPS.slice(0, 2)
  const currentIdx = steps.findIndex(s => s.phase === phase)
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-10 px-4 py-6">
      {/* Pipeline */}
      <div className="flex items-start gap-0 w-full max-w-md">
        {steps.map((step, i) => {
          const isDone    = i < currentIdx
          const isActive  = i === currentIdx
          const isPending = i > currentIdx
          const isLast    = i === steps.length - 1
          return (
            <React.Fragment key={step.phase}>
              <div className="flex flex-col items-center gap-2.5 flex-1 min-w-0">
                {/* Circle */}
                <div className={`
                  relative w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-500
                  ${isDone    ? 'bg-green-500 border-green-500 text-white' : ''}
                  ${isActive  ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/30' : ''}
                  ${isPending ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600' : ''}
                `}>
                  {isDone ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : isActive ? (
                    <div className="relative">
                      {PHASE_ICONS[step.phase]}
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-300 rounded-full animate-ping" />
                    </div>
                  ) : PHASE_ICONS[step.phase]}
                </div>
                {/* Label */}
                <div className="text-center px-1">
                  <p className={`text-xs font-medium transition-colors leading-tight ${
                    isDone    ? 'text-green-600 dark:text-green-400' :
                    isActive  ? 'text-blue-600 dark:text-blue-400' :
                    'text-gray-400 dark:text-gray-600'
                  }`}>{step.label}</p>
                  {isActive && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">{step.sublabel}</p>
                  )}
                </div>
              </div>
              {!isLast && (
                <div className="flex-shrink-0 mt-6 w-8 flex items-center">
                  <div className={`h-0.5 w-full transition-all duration-700 ${
                    i < currentIdx ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'
                  }`} />
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>
      {/* Stream */}
      <div className="w-full max-w-md">
        <p className="text-xs text-gray-400 mb-2 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
          Live output
        </p>
        <StreamPreview text={streamingText} />
      </div>
    </div>
  )
}

// ─── Research progress panel ──────────────────────────────────────────────────

function ResearchProgress({ streamingText, company }: { streamingText: string; company: string }): React.JSX.Element {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [streamingText])
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 py-6">
      <div className="flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
          <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-900 dark:text-white">Researching {company}</p>
          <p className="text-xs text-gray-400 mt-0.5">Gathering company context to personalise your application</p>
        </div>
      </div>
      <div className="w-full max-w-md">
        <p className="text-xs text-gray-400 mb-2 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
          Live output
        </p>
        <div className="bg-gray-950 rounded-lg px-4 py-3 h-28 overflow-hidden relative font-mono text-xs text-gray-400 leading-relaxed">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-gray-950 pointer-events-none z-10" />
          <pre className="whitespace-pre-wrap break-words">{streamingText.slice(-400) || ' '}<span className="animate-pulse text-blue-400">▌</span></pre>
          <div ref={endRef} />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface ApplicationOverrides {
  location: string
  phone: string
  hasRightToWork: boolean
}

interface Props {
  templateStatus: { cv: boolean; coverLetter: boolean }
}

export default function GeneratePage({ templateStatus }: Props): React.JSX.Element {
  const { profile, jobSessions, activeJobId, updateJobSession, setPage } = useStore()
  const activeJob = jobSessions.find(j => j.id === activeJobId) ?? null

  const [status, setStatus] = useState<GenerateStatus>('idle')
  const [error, setError] = useState('')
  const [streamingText, setStreamingText] = useState('')
  const [phase, setPhase] = useState<GenerationPhase>('writing')
  const [hasRefining, setHasRefining] = useState(false)
  const [researchResult, setResearchResult] = useState<CompanyResearch | null>(null)
  const [showCompanyEdit, setShowCompanyEdit] = useState(false)
  const [correctedCompany, setCorrectedCompany] = useState('')
  const [overrides, setOverrides] = useState<ApplicationOverrides | null>(null)

  function defaultOverrides(): ApplicationOverrides {
    const personal = profile?.personal as Record<string, unknown> | undefined
    const profileLocation = personal?.location as Record<string, unknown> | undefined
    const city = (profileLocation?.city as string) ?? ''
    const country = (profileLocation?.country as string) ?? ''
    const profileLocationStr = [city, country].filter(Boolean).join(', ')
    const jobLocation = activeJob?.analysis?.jobLocation ?? ''
    return {
      location: jobLocation || profileLocationStr,
      phone: (personal?.phone as string) ?? '',
      hasRightToWork: false,
    }
  }

  useEffect(() => {
    if (activeJob?.generatedDocs) {
      setStatus('done')
    } else if (activeJob?.analysis && templateStatus.cv) {
      setOverrides(defaultOverrides())
      setStatus('pre-generate')
    }
  }, [activeJob?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerate(): Promise<void> {
    if (!activeJob?.analysis || !templateStatus.cv) return
    setOverrides(defaultOverrides())
    setStatus('pre-generate')
  }

  async function handleConfirmGenerate(confirmed: ApplicationOverrides): Promise<void> {
    if (!activeJob?.analysis || !templateStatus.cv) return
    setOverrides(confirmed)
    setError('')
    setShowCompanyEdit(false)
    setCorrectedCompany('')

    const companyName = activeJob.analysis.company

    // Skip research if we already have a cached summary
    if (companyName && !activeJob.companySummary) {
      await runResearch(companyName)
      return
    }

    await startGenerate(confirmed)
  }

  async function runResearch(company: string): Promise<void> {
    setStatus('researching')
    setStreamingText('')

    const api = (window as any).api

    const removeStream = api.research.onStream((chunk: string) => {
      setStreamingText(prev => prev + chunk)
    })
    const removeDone = api.research.onDone((result: unknown) => {
      removeStream(); removeDone(); removeError()
      const research = result as CompanyResearch
      if (activeJob) updateJobSession(activeJob.id, { companySummary: research.summary })
      setResearchResult(research)
      setStatus('confirming')
    })
    const removeError = api.research.onError((_payload: { error: string }) => {
      removeStream(); removeDone(); removeError()
      // Research failure is non-fatal — proceed without summary
      setResearchResult(null)
      setStatus('confirming')
    })

    await api.research.company({ company })
  }

  async function startGenerate(confirmedOverrides?: ApplicationOverrides): Promise<void> {
    if (!activeJob?.analysis || !templateStatus.cv) return
    setStatus('generating')
    setStreamingText('')
    setPhase('writing')
    setHasRefining(false)

    const api = (window as any).api

    let cvTemplateText = ''
    let coverLetterTemplateText: string | undefined
    try {
      const cvResult = await api.templates.read({ type: 'cv' })
      cvTemplateText = cvResult.text
      if (templateStatus.coverLetter) {
        const clResult = await api.templates.read({ type: 'coverLetter' })
        coverLetterTemplateText = clResult.text
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to read template.')
      setStatus('error')
      return
    }

    const removeStream = api.generate.onStream((chunk: string) => {
      setStreamingText(prev => prev + chunk)
      if (chunk.includes('[Overseer]')) setPhase('reviewing')
      if (chunk.includes('[Editor]')) { setPhase('refining'); setHasRefining(true) }
    })
    const removeDone = api.generate.onDone((result: unknown) => {
      removeStream(); removeDone(); removeGenError()
      const docs = result as GeneratedDocs
      if (activeJob) {
        updateJobSession(activeJob.id, {
          generatedDocs: docs,
          overseerResult: docs.overseerResult,
          generating: false
        })
      }
      setStatus('done')
      setStreamingText('')
    })
    const removeGenError = api.generate.onError((payload: { error: string }) => {
      removeStream(); removeDone(); removeGenError()
      setError(payload.error)
      setStatus('error')
      if (activeJob) updateJobSession(activeJob.id, { generating: false })
    })

    if (activeJob) updateJobSession(activeJob.id, { generating: true })

    const gapAnswers: Record<string, string> = {}
    if (activeJob.answers && activeJob.analysis) {
      activeJob.analysis.missingSkills.forEach((skill: string, i: number) => {
        if (activeJob.answers[i]) gapAnswers[skill] = activeJob.answers[i]
      })
    }

    const active = confirmedOverrides ?? overrides

    await api.generate.docs({
      profile,
      analysis: activeJob.analysis,
      cvTemplateText,
      coverLetterTemplateText,
      gapAnswers: Object.keys(gapAnswers).length > 0 ? gapAnswers : undefined,
      companySummary: activeJob.companySummary,
      applicationOverrides: active ?? undefined
    })
  }

  async function handleReresearch(): Promise<void> {
    const company = correctedCompany.trim() || activeJob?.analysis?.company
    if (!company || !activeJob) return
    // Update company name in analysis if corrected
    if (correctedCompany.trim() && activeJob.analysis) {
      updateJobSession(activeJob.id, {
        analysis: { ...activeJob.analysis, company: correctedCompany.trim() },
        companySummary: undefined
      })
    }
    await runResearch(correctedCompany.trim() || company)
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

  function openExternal(url: string): void {
    ;(window as any).electron?.shell?.openExternal(url)
  }

  const docs = activeJob?.generatedDocs ?? null
  const overseerResult = activeJob?.overseerResult ?? null

  return (
    <div className="relative flex flex-col h-full overflow-hidden px-8 py-6 gap-4">

      {/* Header row */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPage('job-match')}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Job Match
          </button>
          <span className="text-gray-300 dark:text-gray-700 text-xs">/</span>
          {activeJob?.analysis ? (
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              {activeJob.analysis.jobTitle}
              {activeJob.analysis.company && (
                <span className="text-gray-400 dark:text-gray-500 font-normal"> · {activeJob.analysis.company}</span>
              )}
            </h2>
          ) : (
            <p className="text-sm text-yellow-600 dark:text-yellow-500/80">Complete a job analysis in Job Match first.</p>
          )}
        </div>

        <button
          onClick={handleGenerate}
          disabled={!activeJob?.analysis || !templateStatus.cv || status === 'researching' || status === 'generating'}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shrink-0"
        >
          {(status === 'researching' || status === 'generating') ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              {status === 'researching' ? 'Researching…' : 'Generating…'}
            </>
          ) : docs ? 'Regenerate' : 'Generate'}
        </button>
      </div>

      {/* Research in-progress panel */}
      {status === 'researching' && (
        <ResearchProgress
          streamingText={streamingText}
          company={activeJob?.analysis?.company ?? 'company'}
        />
      )}

      {/* Generation in-progress panel */}
      {status === 'generating' && (
        <GenerationProgress
          phase={phase}
          streamingText={streamingText}
          hasRefining={hasRefining}
        />
      )}

      {/* Error */}
      {status === 'error' && error && (
        <div className="px-3 py-2.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg shrink-0">
          <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Overseer score badge */}
      {docs && overseerResult && (
        <div className="flex items-center gap-3 shrink-0 px-1">
          <span className="text-xs text-gray-400">Quality score</span>
          <span className={`text-sm font-semibold ${
            overseerResult.score >= 8 ? 'text-green-600 dark:text-green-400' :
            overseerResult.score >= 6 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500 dark:text-red-400'
          }`}>
            {overseerResult.score.toFixed(1)}/10
          </span>
          {overseerResult.pass ? (
            <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/40 border border-green-200 dark:border-green-700/50 rounded px-2 py-0.5">
              Passed review
            </span>
          ) : (
            <span className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700/40 rounded px-2 py-0.5">
              Edited &amp; improved
            </span>
          )}
        </div>
      )}

      {/* Document viewer */}
      {docs ? (
        <DocumentViewer
          docs={docs}
          onExportPdf={handleExportPdf}
          onExportDocx={handleExportDocx}
          onEdit={handleEdit}
        />
      ) : (
        status !== 'researching' && status !== 'generating' && status !== 'confirming' && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-gray-400 dark:text-gray-600">
              {!activeJob?.analysis
                ? 'No job selected — go to Job Match first.'
                : !templateStatus.cv
                  ? 'Upload a CV template in the sidebar to get started.'
                  : 'Click Generate to create your tailored documents.'}
            </p>
          </div>
        )
      )}

      {/* Pre-generate overrides modal */}
      {status === 'pre-generate' && overrides && (
        <PreGenerateModal
          overrides={overrides}
          onChange={setOverrides}
          onConfirm={() => handleConfirmGenerate(overrides)}
          onCancel={() => setStatus(activeJob?.generatedDocs ? 'done' : 'idle')}
        />
      )}

      {/* Company confirmation modal */}
      {status === 'confirming' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl">
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Is this the right company?
            </p>

            {researchResult ? (
              <>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                  {researchResult.summary}
                </p>

                {researchResult.sources.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Sources</p>
                    <ul className="space-y-1">
                      {researchResult.sources.map((url, i) => (
                        <li key={i}>
                          <button
                            onClick={() => openExternal(url)}
                            className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 underline break-all text-left"
                          >
                            {url}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mb-5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    researchResult.confidence === 'high'
                      ? 'bg-green-100 dark:bg-green-900/60 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700'
                      : researchResult.confidence === 'medium'
                        ? 'bg-yellow-100 dark:bg-yellow-900/60 text-yellow-700 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600'
                  }`}>
                    {researchResult.confidence} confidence
                  </span>
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Could not retrieve company info — you can still proceed without it.
              </p>
            )}

            {showCompanyEdit ? (
              <div className="mb-4">
                <input
                  type="text"
                  value={correctedCompany}
                  onChange={e => setCorrectedCompany(e.target.value)}
                  placeholder={activeJob?.analysis?.company ?? 'Company name'}
                  className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-2"
                  onKeyDown={e => { if (e.key === 'Enter') handleReresearch() }}
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => { setShowCompanyEdit(false); setCorrectedCompany('') }}
                    className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReresearch}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    Research again
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowCompanyEdit(true)}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors"
                >
                  Wrong company
                </button>
                <button
                  onClick={() => startGenerate(overrides ?? undefined)}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  Yes, continue
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Pre-generate overrides modal ───────────────────────────────────────────────

interface PreGenerateModalProps {
  overrides: ApplicationOverrides
  onChange: (o: ApplicationOverrides) => void
  onConfirm: () => void
  onCancel: () => void
}

function PreGenerateModal({ overrides, onChange, onConfirm, onCancel }: PreGenerateModalProps): React.JSX.Element {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
        <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Application details</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
          Confirm the details to use for this application. These override your profile for this generation only.
        </p>

        <div className="space-y-4">
          {/* Location */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Location</label>
            <input
              type="text"
              value={overrides.location}
              onChange={e => onChange({ ...overrides, location: e.target.value })}
              placeholder="e.g. London, UK"
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Phone number</label>
            <input
              type="text"
              value={overrides.phone}
              onChange={e => onChange({ ...overrides, phone: e.target.value })}
              placeholder="e.g. +44 7700 000000"
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Sponsorship toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">I have the right to work</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">State this in your application — no sponsorship needed</p>
            </div>
            <button
              onClick={() => onChange({ ...overrides, hasRightToWork: !overrides.hasRightToWork })}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                overrides.hasRightToWork ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                  overrides.hasRightToWork ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Generate →
          </button>
        </div>
      </div>
    </div>
  )
}
