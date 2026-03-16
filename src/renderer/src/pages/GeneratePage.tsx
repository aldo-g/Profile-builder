import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import type { GeneratedDocs, CompanyResearch } from '../../../schema/profile.schema'
import DocumentViewer from '../components/DocumentViewer'

type GenerateStatus = 'idle' | 'researching' | 'confirming' | 'generating' | 'done' | 'error'

interface Props {
  templateStatus: { cv: boolean; coverLetter: boolean }
}

export default function GeneratePage({ templateStatus }: Props): React.JSX.Element {
  const { profile, jobSessions, activeJobId, updateJobSession, setPage } = useStore()
  const activeJob = jobSessions.find(j => j.id === activeJobId) ?? null

  const [status, setStatus] = useState<GenerateStatus>('idle')
  const [error, setError] = useState('')
  const [streamingText, setStreamingText] = useState('')
  const [phaseLabel, setPhaseLabel] = useState('Claude is writing…')
  const [researchResult, setResearchResult] = useState<CompanyResearch | null>(null)
  const [showCompanyEdit, setShowCompanyEdit] = useState(false)
  const [correctedCompany, setCorrectedCompany] = useState('')

  const streamEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (activeJob?.generatedDocs) {
      setStatus('done')
    } else if (activeJob?.analysis && templateStatus.cv) {
      handleGenerate()
    }
  }, [activeJob?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [streamingText])

  async function handleGenerate(): Promise<void> {
    if (!activeJob?.analysis || !templateStatus.cv) return
    setError('')
    setShowCompanyEdit(false)
    setCorrectedCompany('')

    const companyName = activeJob.analysis.company

    // Skip research if we already have a cached summary
    if (companyName && !activeJob.companySummary) {
      await runResearch(companyName)
      return
    }

    await startGenerate()
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

  async function startGenerate(): Promise<void> {
    if (!activeJob?.analysis || !templateStatus.cv) return
    setStatus('generating')
    setStreamingText('')
    setPhaseLabel('Claude is writing…')

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
      if (chunk.includes('[Overseer]')) setPhaseLabel('Reviewing quality…')
      if (chunk.includes('[Editor]')) setPhaseLabel('Refining sections…')
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

    await api.generate.docs({
      profile,
      analysis: activeJob.analysis,
      cvTemplateText,
      coverLetterTemplateText,
      gapAnswers: Object.keys(gapAnswers).length > 0 ? gapAnswers : undefined,
      companySummary: activeJob.companySummary
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

      {/* Research streaming preview */}
      {status === 'researching' && (
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 max-h-36 overflow-y-auto shrink-0">
          <p className="text-xs text-gray-400 mb-1">Researching company…</p>
          <pre className="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap font-mono">{streamingText || ' '}</pre>
          <div ref={streamEndRef} />
        </div>
      )}

      {/* Generation streaming preview */}
      {status === 'generating' && (
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 max-h-36 overflow-y-auto shrink-0">
          <p className="text-xs text-gray-400 mb-1">{phaseLabel}</p>
          <pre className="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap font-mono">{streamingText || ' '}</pre>
          <div ref={streamEndRef} />
        </div>
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
                  onClick={startGenerate}
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
