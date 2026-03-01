import React from 'react'
import { ChatMessage as ChatMessageType } from '../store'

interface Props {
  message: ChatMessageType
}

export function formatAssistantContent(content: string): React.ReactNode {
  const paragraphs = content.split(/\n\n+/)
  return paragraphs.map((para, pIdx) => {
    const lines = para.split('\n')
    return (
      <p key={pIdx} className={pIdx > 0 ? 'mt-3' : ''}>
        {lines.map((line, lIdx) => {
          const parts = line.split(/\*\*(.+?)\*\*/g)
          return (
            <span key={lIdx}>
              {lIdx > 0 && <br />}
              {parts.map((part, i) =>
                i % 2 === 1 ? <strong key={i}>{part}</strong> : part
              )}
            </span>
          )
        })}
      </p>
    )
  })
}

export default function ChatMessage({ message }: Props): React.JSX.Element {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold mr-3 flex-shrink-0 mt-0.5">
          AI
        </div>
      )}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-blue-600 text-white rounded-tr-sm'
            : 'bg-gray-800 text-gray-100 rounded-tl-sm'
        }`}
      >
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <div>{formatAssistantContent(message.content)}</div>
        )}
      </div>
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold ml-3 flex-shrink-0 mt-0.5">
          You
        </div>
      )}
    </div>
  )
}
