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
    <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-800 flex-1">
      <FitScoreBadge score={analysis.score} />

      {cards.length > 0 && (
        <p className="text-xs text-gray-400 mb-4">
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

function FitScoreBadge({ score }: { score: number }): React.JSX.Element {
  const colour = score >= 70
    ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-400/10 border-green-200 dark:border-green-700/40'
    : score >= 40
    ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-400/10 border-yellow-200 dark:border-yellow-700/40'
    : 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-400/10 border-red-200 dark:border-red-700/40'
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
