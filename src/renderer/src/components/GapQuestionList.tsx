import React, { useEffect, useRef } from 'react'

interface Card {
  skill: string
  question: string
}

interface QuestionListProps {
  cards: Card[]
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
}

export function GapQuestionList({
  cards, answeredSet, skippedSet, selectedIndex, onSelect,
  answerValue, onAnswerChange, onSubmit, onSkip, submittingIndex,
  proposedUpdates, agentMessage, onConfirmUpdate, onDismissUpdate
}: QuestionListProps): React.JSX.Element {
  const pending = cards.filter((_, i) => !answeredSet.has(i) && !skippedSet.has(i))
  const done = cards.filter((_, i) => answeredSet.has(i) || skippedSet.has(i))

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
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
            const isOpen = selectedIndex === globalI
            return (
              <QuestionRow
                key={globalI}
                card={card}
                status={answeredSet.has(globalI) ? 'answered' : 'skipped'}
                isOpen={isOpen}
                onSelect={() => onSelect(globalI)}
                answerValue={isOpen ? answerValue : ''}
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
  card: Card
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

  // Compact single-line for completed/skipped rows (expandable to re-answer)
  if ((status === 'answered' || status === 'skipped') && !isOpen) {
    return (
      <div
        onClick={onSelect}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
          status === 'answered'
            ? 'border-green-300 dark:border-green-700/50 bg-green-50 dark:bg-green-900/10 hover:border-green-400 dark:hover:border-green-600/60 hover:bg-green-100 dark:hover:bg-green-900/20'
            : 'border-gray-200 dark:border-gray-800 bg-transparent opacity-40 hover:opacity-70'
        }`}
      >
        <svg className={`w-3.5 h-3.5 flex-shrink-0 ${status === 'answered' ? 'text-green-500' : 'text-gray-400 dark:text-gray-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <span className={`text-xs font-medium rounded-full px-2 py-0.5 border flex-shrink-0 ${
          status === 'answered'
            ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700/40 text-green-600 dark:text-green-400'
            : 'bg-gray-100 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/50 text-gray-400 dark:text-gray-500'
        }`}>
          {card.skill}
        </span>
        <span className="text-xs text-gray-400 truncate flex-1">{card.question}</span>
        <span className="text-xs text-gray-400 flex-shrink-0">re-answer →</span>
      </div>
    )
  }

  const rowBase = 'rounded-xl border transition-all duration-150 overflow-hidden'
  const rowStyle = isOpen
    ? `${rowBase} border-blue-400 dark:border-blue-500/50 bg-blue-50/50 dark:bg-blue-600/5`
    : `${rowBase} border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 hover:border-gray-300 dark:hover:border-gray-700 cursor-pointer`

  return (
    <div className={rowStyle}>
      {/* Header row */}
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer"
        onClick={onSelect}
      >
        <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center mt-0.5">
          {isOpen ? (
            <svg className="w-4 h-4 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium bg-blue-100 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-300 rounded-full px-2.5 py-0.5 inline-block mb-1.5">
            {card.skill}
          </span>
          <p className={`text-sm leading-snug ${isOpen ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-600 dark:text-gray-300'}`}>
            {card.question}
          </p>
        </div>
      </div>

      {/* Expanded answer area */}
      {isOpen && (
        <div className="px-4 pb-4 pt-1" onClick={(e) => e.stopPropagation()}>
          {proposedUpdates ? (
            <div className="rounded-xl border border-green-300 dark:border-green-700/30 bg-green-50 dark:bg-green-900/10 px-4 py-3 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-green-500 dark:text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-xs text-green-600 dark:text-green-300">Profile update suggested — see popup</p>
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
                className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500 disabled:opacity-50"
              />
              <div className="mt-3 flex items-center justify-between">
                <button
                  onClick={onSkip}
                  disabled={submitting}
                  className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-40"
                >
                  Skip
                </button>
                <button
                  onClick={onSubmit}
                  disabled={submitting || !answerValue.trim()}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Saving…
                    </>
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
