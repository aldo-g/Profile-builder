import React, { useState } from 'react'
import type { GeneratedDocs } from '../../../schema/profile.schema'
import { renderMarkdown } from '../utils/renderMarkdown'

type Tab = 'cv' | 'cover-letter'
type ViewMode = 'preview' | 'raw'

interface Props {
  docs: GeneratedDocs
  onExportPdf: (tab: Tab) => void
  onExportDocx: (tab: Tab) => void
  /** Tailwind max-height class for the content area, e.g. 'max-h-[600px]'. Omit for no cap. */
  maxHeight?: string
}

export default function DocumentViewer({ docs, onExportPdf, onExportDocx, maxHeight }: Props): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>('cv')
  const [viewMode, setViewMode] = useState<ViewMode>('preview')

  const activeMarkdown = activeTab === 'cv' ? docs.cvMarkdown : docs.coverLetterMarkdown

  return (
    <div className="flex flex-col flex-1 min-h-0 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
      {/* Tab + export toolbar */}
      <div className="flex items-center border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 shrink-0">
        <DocTabButton label="CV" active={activeTab === 'cv'} onClick={() => setActiveTab('cv')} />
        <DocTabButton label="Cover Letter" active={activeTab === 'cover-letter'} onClick={() => setActiveTab('cover-letter')} />
        <div className="flex-1" />

        {/* Preview / Raw toggle */}
        <div className="flex items-center gap-1 mr-3">
          <button
            onClick={() => setViewMode('preview')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              viewMode === 'preview' ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => setViewMode('raw')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              viewMode === 'raw' ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            Raw
          </button>
        </div>

        {/* Export buttons */}
        <button
          onClick={() => onExportDocx(activeTab)}
          className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium transition-colors flex items-center gap-1.5 border-l border-gray-200 dark:border-gray-800"
          title="Export as Word document"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
          </svg>
          DOCX
        </button>
        <button
          onClick={() => onExportPdf(activeTab)}
          className="px-3 py-2.5 text-xs text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 font-medium transition-colors flex items-center gap-1.5 border-l border-gray-200 dark:border-gray-800"
          title="Export as PDF"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
          </svg>
          PDF
        </button>
      </div>

      {/* Content area */}
      <div className={`overflow-y-auto ${maxHeight ?? 'flex-1'}`}>
        {viewMode === 'preview' ? (
          <div className="prose-doc-wrap">
            <div
              className={`prose-doc${activeTab === 'cover-letter' ? ' prose-cover-letter' : ''}`}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(activeMarkdown) }}
            />
          </div>
        ) : (
          <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono leading-relaxed px-6 py-6 bg-gray-50 dark:bg-transparent">
            {activeMarkdown}
          </pre>
        )}
      </div>
    </div>
  )
}

function DocTabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${
        active ? 'text-gray-900 dark:text-white border-blue-500' : 'text-gray-400 border-transparent hover:text-gray-600 dark:hover:text-gray-300'
      }`}
    >
      {label}
    </button>
  )
}
