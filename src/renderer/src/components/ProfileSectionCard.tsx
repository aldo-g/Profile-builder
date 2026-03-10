import React, { useEffect, useRef, useState } from 'react'
import { WizardSection, useStore } from '../store'
import { SectionPreview } from './SectionPreview'
import SectionChat from './SectionChat'
import PersonalInfoForm from './PersonalInfoForm'
import SectionEditor from './SectionEditor'

interface Props {
  section: WizardSection
  isExpanded: boolean
  onExpand: () => void
}

function ChevronIcon({ rotated }: { rotated: boolean }): React.JSX.Element {
  return (
    <svg
      className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${rotated ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

// Loads AI-generated questions for the section, shows them as tappable chips.
// Clicking a chip opens the chat with that question pre-sent as the opening message.
function SectionQuestions({ section }: { section: WizardSection }): React.JSX.Element {
  const profile = useStore((s) => s.profile)
  const [questions, setQuestions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    const api = (window as any).api
    api.questions.generate({ section: section.label, profile })
      .then((qs: string[]) => {
        setQuestions(qs)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (selectedQuestion !== null) {
    return <SectionChat section={section} initialMessage={selectedQuestion} />
  }

  return (
    <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-800">
      <p className="text-xs text-gray-500 mb-3">Help expand your experience by answering these key questions</p>
      {loading ? (
        <div className="flex gap-1.5 items-center text-xs text-gray-400">
          <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      ) : questions.length > 0 ? (
        <div className="flex flex-col gap-2">
          {questions.map((q, i) => (
            <button
              key={i}
              onClick={() => setSelectedQuestion(q)}
              className="text-left text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 rounded-lg px-3 py-2.5 transition-all leading-relaxed"
            >
              {q}
            </button>
          ))}
          <button
            onClick={() => setSelectedQuestion('')}
            className="text-left text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mt-1 transition-colors"
          >
            Or type your own response →
          </button>
        </div>
      ) : (
        <button
          onClick={() => setSelectedQuestion('')}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          Add more detail →
        </button>
      )}
    </div>
  )
}

export default function ProfileSectionCard({ section, isExpanded, onExpand }: Props): React.JSX.Element {
  const profile = useStore((s) => s.profile)
  const isComplete = section.completionCheck(profile)
  const cardRef = useRef<HTMLDivElement>(null)

  // Scroll card into view when expanded so the chat input is reachable
  useEffect(() => {
    if (isExpanded) {
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 100)
    }
  }, [isExpanded])

  return (
    <div
      ref={cardRef}
      className={`rounded-xl border transition-all duration-200 ${
        isExpanded
          ? 'border-blue-500 dark:border-blue-600 bg-white dark:bg-gray-900'
          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700'
      }`}
    >
      {/* Card header — always visible, click to toggle */}
      <button
        className="w-full text-left px-5 py-4 flex items-center justify-between gap-3"
        onClick={onExpand}
      >
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{section.label}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{section.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isComplete ? (
            <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-400/10 px-2 py-0.5 rounded-full">
              Done
            </span>
          ) : (
            <span className="text-xs font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
              Incomplete
            </span>
          )}
          <ChevronIcon rotated={isExpanded} />
        </div>
      </button>

      {/* Collapsed preview */}
      {!isExpanded && (
        <div className="px-5 pb-4">
          <SectionPreview section={section} profile={profile} detail={false} />
        </div>
      )}

      {/* Expanded body */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-800">
          {section.id === 'personal' ? (
            // Personal Info: plain editable form, no AI chat
            <div className="px-5 py-5">
              <PersonalInfoForm />
            </div>
          ) : (
            <>
              {/* Editable list — add/delete items directly */}
              <div className="px-5 py-5 border-b border-gray-200 dark:border-gray-800 overflow-y-auto" style={{ maxHeight: '500px' }}>
                <SectionEditor section={section} />
              </div>

              {/* AI questions — enrichment only, below the editor */}
              <SectionQuestions section={section} />
            </>
          )}
        </div>
      )}
    </div>
  )
}
