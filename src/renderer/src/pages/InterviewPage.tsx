import React from 'react'
import { useStore, WIZARD_SECTIONS } from '../store'
import ProfileSectionCard from '../components/ProfileSectionCard'

export default function InterviewPage(): React.JSX.Element {
  const { profile, expandedSectionId, setExpandedSectionId } = useStore()
  const completedCount = WIZARD_SECTIONS.filter(s => s.completionCheck(profile)).length
  const completionPct = Math.round((completedCount / WIZARD_SECTIONS.length) * 100)

  const handleExpand = (sectionId: string) => {
    setExpandedSectionId(expandedSectionId === sectionId ? null : sectionId)
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-950">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Completeness bar */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>Profile completeness</span>
            <span>{completedCount} / {WIZARD_SECTIONS.length} sections done</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>

        {/* Section cards */}
        <div className="space-y-4">
          {WIZARD_SECTIONS.map((section) => (
            <ProfileSectionCard
              key={section.id}
              section={section}
              isExpanded={expandedSectionId === section.id}
              onExpand={() => handleExpand(section.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
