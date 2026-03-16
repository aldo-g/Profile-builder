import React, { useState } from 'react'

interface WelcomeModalProps {
  onGetStarted: () => void
  onClose: () => void
}

const STEPS = [
  {
    id: 'build',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    label: 'Step 1',
    title: 'Build your profile',
    description:
      'Claude interviews you section by section — work history, education, skills, projects, and more. You can also upload your CV or LinkedIn export to give it a head start. Everything is stored locally as a structured profile on your machine.',
    details: [
      'Upload your existing CV to pre-fill your history',
      'Chat with Claude to fill in gaps and add context',
      'Import documents, certificates, and LinkedIn exports',
    ],
  },
  {
    id: 'match',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    label: 'Step 2',
    title: 'Match to a job',
    description:
      'Paste in any job listing. Claude compares it against your profile, identifies what\'s missing or undersold, and asks targeted questions to fill those gaps — so your application is tailored, not generic.',
    details: [
      'Paste any job listing URL or text',
      'Claude finds gaps between the role and your profile',
      'Answer a few targeted questions to strengthen your fit',
    ],
  },
  {
    id: 'generate',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    label: 'Step 3',
    title: 'Generate your documents',
    description:
      'Upload your CV template (and optionally a cover letter template) and Claude generates tailored documents filled with your actual experience — written for that specific role, not a one-size-fits-all version.',
    details: [
      'Upload a .docx template for your CV',
      'Optionally add a cover letter template',
      'Get documents written for that exact role',
    ],
  },
]

export default function WelcomeModal({ onGetStarted, onClose }: WelcomeModalProps): React.JSX.Element {
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors z-10"
          title="Close"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header — always visible */}
        <div className="px-8 pt-8 pb-0">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white tracking-wide">Profile Builder</span>
            <span className="text-xs text-gray-400 ml-0.5">by Claude</span>
          </div>

          <p className="text-xs font-semibold text-blue-500 dark:text-blue-400 tracking-widest uppercase mb-2">How it works</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-snug mb-1">
            Your career, perfectly told.
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            Profile Builder uses Claude to build a deep record of your experience, then tailors CVs and cover letters to any job — automatically.
          </p>

          {/* Step tabs */}
          <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setStep(i)}
                className={`px-4 py-2 text-xs font-medium rounded-t-md transition-colors border-b-2 -mb-px ${
                  i === step
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30'
                    : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/40'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="px-8 py-6">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center text-blue-500 dark:text-blue-400 flex-shrink-0">
              {current.icon}
            </div>
            <div className="pt-0.5">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">{current.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{current.description}</p>
            </div>
          </div>

          <ul className="space-y-2.5 mb-8">
            {current.details.map((d) => (
              <li key={d} className="flex items-start gap-2.5">
                <svg className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-gray-600 dark:text-gray-300">{d}</span>
              </li>
            ))}
          </ul>

          {/* Privacy note */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 mb-6">
            <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-xs text-gray-400">
              Your profile is stored locally as <code className="text-gray-500">profile.json</code> — never uploaded to any server.
            </p>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0}
              className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-0 disabled:pointer-events-none transition-colors"
            >
              ← Back
            </button>

            {/* Step dots */}
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`rounded-full transition-all ${
                    i === step
                      ? 'w-5 h-2 bg-blue-600'
                      : 'w-2 h-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                  }`}
                />
              ))}
            </div>

            {isLast ? (
              <button
                onClick={onGetStarted}
                className="px-5 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white transition-colors"
              >
                Get started →
              </button>
            ) : (
              <button
                onClick={() => setStep(s => s + 1)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
