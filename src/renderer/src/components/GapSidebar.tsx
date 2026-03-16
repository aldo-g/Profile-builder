import React from 'react'
import type { GapAnalysis } from '../../../schema/profile.schema'

interface Props {
  analysis: GapAnalysis
  cards: Array<{ skill: string; question: string }>
  answeredSet: Set<number>
  skippedSet: Set<number>
  selectedCardIndex: number | null
}

export default function GapSidebar({ analysis, cards, answeredSet, skippedSet, selectedCardIndex }: Props): React.JSX.Element {
  return (
    <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-800 flex-1 overflow-y-auto">
      <FitScoreGauge score={analysis.score} />

      {cards.length > 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 text-center">
          {answeredSet.size} of {cards.length} gaps addressed
        </p>
      )}

      <SidebarSection title="Missing Skills">
        <div className="flex flex-wrap gap-1.5 mt-2">
          {analysis.missingSkills.map((skill, i) => {
            const cardIdx = cards.findIndex(c => c.skill === skill)
            const isDone = answeredSet.has(cardIdx)
            const isSkipped = skippedSet.has(cardIdx)
            const isCurrent = cardIdx === selectedCardIndex
            return (
              <span key={i} className={`text-xs rounded-full px-2.5 py-1 border transition-colors ${
                isDone ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700/50 text-green-600 dark:text-green-400'
                : isSkipped ? 'bg-gray-100 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/50 text-gray-400 line-through'
                : isCurrent ? 'bg-blue-50 dark:bg-blue-600/20 border-blue-300 dark:border-blue-500/50 text-blue-600 dark:text-blue-300'
                : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
              }`}>
                {isDone ? '✓ ' : ''}{skill}
              </span>
            )
          })}
        </div>
      </SidebarSection>

      <SidebarSection title="Experience to Highlight">
        <ul className="mt-2 space-y-1">
          {analysis.highlightExperience.map((item, i) => (
            <li key={i} className="text-xs text-gray-600 dark:text-gray-300 flex gap-2">
              <span className="text-green-500 flex-shrink-0 mt-0.5">✓</span>{item}
            </li>
          ))}
        </ul>
      </SidebarSection>

      <SidebarSection title="Recommended Tweaks">
        <ul className="mt-2 space-y-1">
          {analysis.recommendedTweaks.map((tweak, i) => (
            <li key={i} className="text-xs text-gray-600 dark:text-gray-300 flex gap-2">
              <span className="text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5">→</span>{tweak}
            </li>
          ))}
        </ul>
      </SidebarSection>
    </div>
  )
}

// ── Score bar ──────────────────────────────────────────────────────────────────

function FitScoreGauge({ score }: { score: number }): React.JSX.Element {
  const label = score >= 70 ? 'Strong match' : score >= 40 ? 'Partial match' : 'Weak match'
  const barColour = score >= 70
    ? 'bg-green-500'
    : score >= 40
    ? 'bg-amber-500'
    : 'bg-red-500'
  const labelColour = score >= 70
    ? 'text-green-600 dark:text-green-400'
    : score >= 40
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400'

  return (
    <div className="mb-4">
      {/* Score number + label */}
      <div className="flex items-baseline justify-between mb-2">
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-bold tracking-tight leading-none ${labelColour}`}>{score}</span>
          <span className="text-xs text-gray-400 font-medium">/100</span>
        </div>
        <span className={`text-xs font-semibold ${labelColour}`}>{label}</span>
      </div>
      {/* Bar */}
      <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColour}`}
          style={{ width: `${score}%` }}
        />
      </div>
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
