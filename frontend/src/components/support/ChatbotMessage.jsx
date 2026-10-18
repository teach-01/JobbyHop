import React from 'react';
import { Bot, User } from 'lucide-react';

/**
 * Renders a single chat message bubble.
 * Supports multi-line text (converts \n to <br>).
 * Bold text is rendered via **text** markdown-like syntax.
 *
 * @param {{ message: { role: 'user'|'assistant', text: string, timestamp: Date } }} props
 */
const ChatbotMessage = ({ message }) => {
  const isAssistant = message.role === 'assistant';

  /**
   * Very lightweight text renderer:
   * - **bold** → <strong>
   * - \n → <br />
   * - Bullet lines starting with • stay as-is
   */
  const renderText = (text) => {
    if (!text) return null;
    // Split on newlines
    return text.split('\n').map((line, lineIdx) => {
      // Parse **bold**
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      const rendered = parts.map((part, partIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={partIdx} className="font-semibold text-white">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      });
      return (
        <React.Fragment key={lineIdx}>
          {rendered}
          {lineIdx < text.split('\n').length - 1 && <br />}
        </React.Fragment>
      );
    });
  };

  const formattedTime = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div
      className={`flex gap-2.5 ${isAssistant ? 'justify-start' : 'justify-end'}`}
      role="listitem"
      aria-label={`${isAssistant ? 'Assistant' : 'You'}: ${message.text}`}
    >
      {/* Avatar – assistant only on left */}
      {isAssistant && (
        <div
          className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-600/30 border border-brand-500/40 flex items-center justify-center mt-0.5"
          aria-hidden="true"
        >
          <Bot className="w-3.5 h-3.5 text-brand-400" />
        </div>
      )}

      <div className={`flex flex-col gap-1 max-w-[82%] ${isAssistant ? 'items-start' : 'items-end'}`}>
        <div
          className={`
            px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed
            ${
              isAssistant
                ? 'bg-slate-800/80 border border-slate-700/50 text-slate-200 rounded-tl-sm'
                : 'bg-brand-600/80 border border-brand-500/40 text-white rounded-tr-sm'
            }
          `}
        >
          {renderText(message.text)}
        </div>
        {formattedTime && (
          <span className="text-[10px] text-slate-500 px-1" aria-hidden="true">
            {formattedTime}
          </span>
        )}
      </div>

      {/* Avatar – user only on right */}
      {!isAssistant && (
        <div
          className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-700/60 border border-slate-600/40 flex items-center justify-center mt-0.5"
          aria-hidden="true"
        >
          <User className="w-3.5 h-3.5 text-slate-300" />
        </div>
      )}
    </div>
  );
};

export default ChatbotMessage;
