import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import type { GeneratedDocs } from '../../../schema/profile.schema'
import DocumentViewer from '../components/DocumentViewer'

type GenerateStatus = 'idle' | 'pre-generate' | 'generating' | 'done' | 'error'
type GenerationPhase = 'writing' | 'trimming' | 'reviewing' | 'refining'

// ─── Generation pipeline config ───────────────────────────────────────────────

const PIPELINE_STEPS: { phase: GenerationPhase; label: string; sublabel: string }[] = [
  { phase: 'writing',   label: 'Writing documents', sublabel: 'Tailoring CV & cover letter to the role' },
  { phase: 'trimming',  label: 'Length check',      sublabel: 'Trimming CV to target page count' },
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

function TrimIcon(): React.JSX.Element {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
    </svg>
  )
}

const PHASE_ICONS: Record<GenerationPhase, React.JSX.Element> = {
  writing:   <WritingIcon />,
  trimming:  <TrimIcon />,
  reviewing: <ReviewIcon />,
  refining:  <RefineIcon />,
}

// ─── Stream preview ───────────────────────────────────────────────────────────

function StreamPreview({ text }: { text: string }): React.JSX.Element {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [text])
  const cleaned = text.replace(/\[(Overseer|Editor|Trimmer)[^\]]*\][^\n]*/g, '').trim()
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

function GenerationProgress({ phase, streamingText, hasTrimming, hasRefining }: {
  phase: GenerationPhase
  streamingText: string
  hasTrimming: boolean
  hasRefining: boolean
}): React.JSX.Element {
  // Always show writing + reviewing; show trimming and refining only if they actually ran
  const steps = PIPELINE_STEPS.filter(s =>
    s.phase === 'writing' || s.phase === 'reviewing' ||
    (s.phase === 'trimming' && hasTrimming) ||
    (s.phase === 'refining' && hasRefining)
  )
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
  const [hasTrimming, setHasTrimming] = useState(false)
  const [hasRefining, setHasRefining] = useState(false)
  const [targetPages, setTargetPages] = useState(2)
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
    await startGenerate(confirmed)
  }

  async function startGenerate(confirmedOverrides?: ApplicationOverrides): Promise<void> {
    if (!activeJob?.analysis || !templateStatus.cv) return
    setStatus('generating')
    setStreamingText('')
    setPhase('writing')
    setHasTrimming(false)
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
      if (chunk.includes('[Trimmer]')) { setPhase('trimming'); setHasTrimming(true) }
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
      jobText: activeJob.jobText,
      cvTemplateText,
      coverLetterTemplateText,
      gapAnswers: Object.keys(gapAnswers).length > 0 ? gapAnswers : undefined,
      companySummary: activeJob.companySummary,
      productContext: activeJob.productContext,
      targetPages,
      applicationOverrides: active ?? undefined
    })
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
          disabled={!activeJob?.analysis || !templateStatus.cv || status === 'generating'}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shrink-0"
        >
          {status === 'generating' ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Generating…
            </>
          ) : docs ? 'Regenerate' : 'Generate'}
        </button>
      </div>

      {/* Generation in-progress panel */}
      {status === 'generating' && (
        <GenerationProgress
          phase={phase}
          streamingText={streamingText}
          hasTrimming={hasTrimming}
          hasRefining={hasRefining}
        />
      )}

      {/* Error */}
      {status === 'error' && error && (
        <div className="px-3 py-2.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg shrink-0">
          <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Overseer score breakdown */}
      {docs && overseerResult && (
        <div className="shrink-0 px-1 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <div className="flex items-center gap-2">
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
          <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
            <span>
              Keywords{' '}
              <span className={overseerResult.dimensions.keyword_coverage >= 8 ? 'text-green-600 dark:text-green-400 font-medium' : overseerResult.dimensions.keyword_coverage >= 6 ? 'text-yellow-600 dark:text-yellow-400 font-medium' : 'text-red-500 dark:text-red-400 font-medium'}>
                {overseerResult.dimensions.keyword_coverage.toFixed(1)}
              </span>
            </span>
            <span className="text-gray-200 dark:text-gray-700">·</span>
            <span>
              Narrative{' '}
              <span className={overseerResult.dimensions.narrative_coherence >= 8 ? 'text-green-600 dark:text-green-400 font-medium' : overseerResult.dimensions.narrative_coherence >= 6 ? 'text-yellow-600 dark:text-yellow-400 font-medium' : 'text-red-500 dark:text-red-400 font-medium'}>
                {overseerResult.dimensions.narrative_coherence.toFixed(1)}
              </span>
            </span>
            <span className="text-gray-200 dark:text-gray-700">·</span>
            <span>
              Structure{' '}
              <span className={overseerResult.dimensions.structural_completeness >= 8 ? 'text-green-600 dark:text-green-400 font-medium' : overseerResult.dimensions.structural_completeness >= 6 ? 'text-yellow-600 dark:text-yellow-400 font-medium' : 'text-red-500 dark:text-red-400 font-medium'}>
                {overseerResult.dimensions.structural_completeness.toFixed(1)}
              </span>
            </span>
            <span className="text-gray-200 dark:text-gray-700">·</span>
            <span>
              Holistic{' '}
              <span className={overseerResult.dimensions.holistic >= 8 ? 'text-green-600 dark:text-green-400 font-medium' : overseerResult.dimensions.holistic >= 6 ? 'text-yellow-600 dark:text-yellow-400 font-medium' : 'text-red-500 dark:text-red-400 font-medium'}>
                {overseerResult.dimensions.holistic.toFixed(1)}
              </span>
            </span>
          </div>
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
        status !== 'generating' && (
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

      {/* Recommended tweaks warning */}
      {status !== 'generating' && !docs && activeJob?.analysis?.recommendedTweaks?.length ? (
        <div className="shrink-0 px-4 py-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-2">
            Your profile may be missing some experience for this role — generation will do its best.
          </p>
          <ul className="space-y-1">
            {activeJob.analysis.recommendedTweaks.slice(0, 3).map((tweak, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500">
                <span className="mt-0.5 flex-shrink-0">•</span>
                <span>{tweak}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Pre-generate overrides modal */}
      {status === 'pre-generate' && overrides && (
        <PreGenerateModal
          overrides={overrides}
          onChange={setOverrides}
          targetPages={targetPages}
          onTargetPagesChange={setTargetPages}
          onConfirm={() => handleConfirmGenerate(overrides)}
          onCancel={() => setStatus(activeJob?.generatedDocs ? 'done' : 'idle')}
        />
      )}

    </div>
  )
}

// ── Pre-generate overrides modal ───────────────────────────────────────────────

interface PreGenerateModalProps {
  overrides: ApplicationOverrides
  onChange: (o: ApplicationOverrides) => void
  targetPages: number
  onTargetPagesChange: (n: number) => void
  onConfirm: () => void
  onCancel: () => void
}

function PreGenerateModal({ overrides, onChange, targetPages, onTargetPagesChange, onConfirm, onCancel }: PreGenerateModalProps): React.JSX.Element {
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

          {/* Target pages */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">CV length target</label>
            <div className="flex gap-2">
              {[1, 2, 3].map(n => (
                <button
                  key={n}
                  onClick={() => onTargetPagesChange(n)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    targetPages === n
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-500'
                  }`}
                >
                  {n} page{n !== 1 ? 's' : ''}
                </button>
              ))}
            </div>
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
