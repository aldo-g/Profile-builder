import React from 'react'
import { WizardSection, WIZARD_SECTIONS, useStore } from '../store'

interface Props {
  onSelectSection: (section: WizardSection) => void
}

export default function WizardSectionList({ onSelectSection }: Props): React.JSX.Element {
  const { currentSection, profile } = useStore()
  const completedCount = WIZARD_SECTIONS.filter(s => s.completionCheck(profile)).length

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-gray-800">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Profile Sections</h2>
      </div>
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {WIZARD_SECTIONS.map((section) => {
          const isActive = currentSection.id === section.id
          const isComplete = section.completionCheck(profile)

          return (
            <button
              key={section.id}
              onClick={() => onSelectSection(section)}
              className={`w-full text-left px-3 py-3 rounded-lg transition-colors group ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{section.label}</span>
                {isComplete ? (
                  <span className={`text-xs font-medium ${isActive ? 'text-blue-200' : 'text-green-400'}`}>
                    Done
                  </span>
                ) : (
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    isActive ? 'bg-blue-300' : 'bg-gray-600 group-hover:bg-gray-500'
                  }`} />
                )}
              </div>
              <p className={`text-xs mt-0.5 ${isActive ? 'text-blue-200' : 'text-gray-500 group-hover:text-gray-400'}`}>
                {section.description}
              </p>
            </button>
          )
        })}
      </nav>
      <div className="px-4 py-4 border-t border-gray-800">
        <p className="text-xs text-gray-500">{completedCount} / {WIZARD_SECTIONS.length} sections complete</p>
      </div>
    </div>
  )
}
