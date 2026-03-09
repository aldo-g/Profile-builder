import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import type { GeneratedDocs } from '../../../../schema/profile.schema'

type Tab = 'cv' | 'cover-letter'
type GenerateStatus = 'idle' | 'generating' | 'done' | 'error'
type ViewMode = 'preview' | 'raw'

interface Props {
  templateStatus: { cv: boolean; coverLetter: boolean }
}

// Minimal markdown → HTML renderer (runs in renderer, no external dep needed)
function renderMarkdown(md: string): string {
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Bullet lists
    .replace(/^[-*•]\s+(.+)$/gm, '<li>$1</li>')
    // HR
    .replace(/^---+$/gm, '<hr>')
    // Remaining plain lines → <p>
    .split('\n')
    .map(line => {
      if (/^<(h[1-3]|li|hr|ul|\/ul)/.test(line) || line.trim() === '') return line
      return `<p>${line}</p>`
    })
    .join('\n')
  // Wrap consecutive <li> in <ul>
  html = html.replace(/((<li>[\s\S]*?<\/li>\n?)+)/g, '<ul>$1</ul>')
  return html
}

export default function GeneratePage({ templateStatus }: Props): React.JSX.Element {
  const { profile, jobSessions, activeJobId, updateJobSession } = useStore()
  const activeJob = jobSessions.find(j => j.id === activeJobId) ?? null

  const [activeTab, setActiveTab] = useState<Tab>('cv')
  const [viewMode, setViewMode] = useState<ViewMode>('preview')
  const [status, setStatus] = useState<GenerateStatus>('idle')
  const [error, setError] = useState('')
  const [streamingText, setStreamingText] = useState('')

  const streamEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (activeJob?.generatedDocs) setStatus('done')
  }, [activeJob?.id])

  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [streamingText])

  async function handleGenerate(): Promise<void> {
    if (!activeJob?.analysis || !templateStatus.cv) return
    setStatus('generating')
    setStreamingText('')
    setError('')

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
    })
    const removeDone = api.generate.onDone((result: unknown) => {
      removeStream(); removeDone(); removeError()
      const docs = result as GeneratedDocs
      if (activeJob) {
        updateJobSession(activeJob.id, { generatedDocs: docs, generating: false })
      }
      setStatus('done')
      setStreamingText('')
    })
    const removeError = api.generate.onError((payload: { error: string }) => {
      removeStream(); removeDone(); removeError()
      setError(payload.error)
      setStatus('error')
      if (activeJob) updateJobSession(activeJob.id, { generating: false })
    })

    if (activeJob) updateJobSession(activeJob.id, { generating: true })

    // Convert index-keyed answers to skill-keyed for the generator
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

  async function handleExportPdf(tab: Tab): Promise<void> {
    if (!activeJob?.generatedDocs) return
    const api = (window as any).api
    const markdown = tab === 'cv'
      ? activeJob.generatedDocs.cvMarkdown
      : activeJob.generatedDocs.coverLetterMarkdown
    const company = activeJob.generatedDocs.company || activeJob.analysis?.company || 'application'
    const filename = tab === 'cv' ? `CV - ${company}.pdf` : `Cover Letter - ${company}.pdf`
    await api.generate.pdf({ markdown, filename })
  }

  async function handleExportDocx(tab: Tab): Promise<void> {
    if (!activeJob?.generatedDocs) return
    const api = (window as any).api
    const markdown = tab === 'cv'
      ? activeJob.generatedDocs.cvMarkdown
      : activeJob.generatedDocs.coverLetterMarkdown
    const company = activeJob.generatedDocs.company || activeJob.analysis?.company || 'application'
    const filename = tab === 'cv' ? `CV - ${company}.docx` : `Cover Letter - ${company}.docx`
    await api.generate.docx({ markdown, filename })
  }

  const docs = activeJob?.generatedDocs ?? null
  const activeMarkdown = docs
    ? (activeTab === 'cv' ? docs.cvMarkdown : docs.coverLetterMarkdown)
    : ''

  return (
    <div className="flex flex-col h-full overflow-hidden px-8 py-6 gap-4">

      {/* Header row */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          {activeJob?.analysis ? (
            <h2 className="text-sm font-semibold text-white">
              {activeJob.analysis.jobTitle}
              {activeJob.analysis.company && (
                <span className="text-gray-500 font-normal"> · {activeJob.analysis.company}</span>
              )}
            </h2>
          ) : (
            <p className="text-sm text-yellow-500/80">Complete a job analysis in Job Match first.</p>
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

      {/* Live stream preview */}
      {status === 'generating' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 max-h-36 overflow-y-auto shrink-0">
          <p className="text-xs text-gray-600 mb-1">Claude is writing…</p>
          <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono">{streamingText || ' '}</pre>
          <div ref={streamEndRef} />
        </div>
      )}

      {/* Error */}
      {status === 'error' && error && (
        <div className="px-3 py-2.5 bg-red-950/50 border border-red-900 rounded-lg shrink-0">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Document preview */}
      {docs ? (
        <div className="flex flex-col flex-1 min-h-0 border border-gray-800 rounded-xl overflow-hidden">
          {/* Tab + export toolbar */}
          <div className="flex items-center border-b border-gray-800 bg-gray-900/60 shrink-0">
            <TabButton label="CV" active={activeTab === 'cv'} onClick={() => setActiveTab('cv')} />
            <TabButton label="Cover Letter" active={activeTab === 'cover-letter'} onClick={() => setActiveTab('cover-letter')} />
            <div className="flex-1" />

            {/* Preview / Raw toggle */}
            <div className="flex items-center gap-1 mr-3">
              <button
                onClick={() => setViewMode('preview')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  viewMode === 'preview' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Preview
              </button>
              <button
                onClick={() => setViewMode('raw')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  viewMode === 'raw' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Raw
              </button>
            </div>

            {/* Export buttons */}
            <button
              onClick={() => handleExportDocx(activeTab)}
              className="px-3 py-2.5 text-xs text-gray-400 hover:text-gray-200 font-medium transition-colors flex items-center gap-1.5 border-l border-gray-800"
              title="Export as Word document"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
              </svg>
              DOCX
            </button>
            <button
              onClick={() => handleExportPdf(activeTab)}
              className="px-3 py-2.5 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors flex items-center gap-1.5 border-l border-gray-800"
              title="Export as PDF"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
              </svg>
              PDF
            </button>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto bg-[#1a1a1a]">
            {viewMode === 'preview' ? (
              <div className="prose-doc-wrap">
                <div
                  className={`prose-doc${activeTab === 'cover-letter' ? ' prose-cover-letter' : ''}`}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(activeMarkdown) }}
                />
              </div>
            ) : (
              <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed px-6 py-6">
                {activeMarkdown}
              </pre>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-gray-600">
            {!activeJob?.analysis
              ? 'No job selected — go to Job Match first.'
              : !templateStatus.cv
                ? 'Upload a CV template in the sidebar to get started.'
                : 'Click Generate to create your tailored documents.'}
          </p>
        </div>
      )}
    </div>
  )
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${
        active
          ? 'text-white border-blue-500'
          : 'text-gray-500 border-transparent hover:text-gray-300'
      }`}
    >
      {label}
    </button>
  )
}
