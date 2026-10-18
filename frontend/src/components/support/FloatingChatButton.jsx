import React, { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import Chatbot from './Chatbot';

/**
 * FloatingChatButton
 *
 * A fixed bottom-right floating action button that opens/closes the chatbot.
 * Automatically hides when the chatbot panel is visible (avoids stacking).
 *
 * Accessibility:
 * - aria-label on button
 * - Keyboard accessible (Tab + Enter/Space)
 * - Focus ring visible
 * - role="button" implied by element
 * - tooltip via title attribute
 */
const FloatingChatButton = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleChat = () => setIsOpen((prev) => !prev);
  const closeChat = () => setIsOpen(false);

  return (
    <>
      {/* Chatbot Panel */}
      <Chatbot isOpen={isOpen} onClose={closeChat} />

      {/* Floating Button – hidden when chatbot is open */}
      {!isOpen && (
        <button
          onClick={toggleChat}
          title="Chat with JobbyHop Assistant"
          aria-label="Open JobbyHop Assistant chat"
          className="
            fixed bottom-6 right-6 z-40
            w-14 h-14 rounded-full
            bg-gradient-to-br from-brand-600 to-indigo-600
            hover:from-brand-500 hover:to-indigo-500
            border border-brand-400/30
            shadow-lg shadow-brand-900/50
            flex items-center justify-center
            transition-all duration-300
            hover:scale-110 hover:shadow-brand-600/50
            focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 focus:ring-offset-slate-950
            active:scale-95
            group
          "
        >
          <MessageCircle
            className="w-6 h-6 text-white transition-transform duration-200 group-hover:scale-110"
            aria-hidden="true"
          />
          {/* Pulse animation ring */}
          <span
            className="absolute inset-0 rounded-full border-2 border-brand-400/30 animate-ping opacity-75 pointer-events-none"
            aria-hidden="true"
          />
        </button>
      )}

      {/* Close button shown when chatbot is open (alternative close for mobile) */}
      {isOpen && (
        <button
          onClick={closeChat}
          title="Close chat"
          aria-label="Close JobbyHop Assistant chat"
          className="
            fixed bottom-6 right-6 z-[60]
            w-10 h-10 rounded-full
            bg-slate-800 border border-slate-700
            hover:bg-slate-700
            shadow-lg
            flex items-center justify-center
            transition-all duration-200
            hover:scale-105
            focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1 focus:ring-offset-slate-950
            active:scale-95
            md:hidden
          "
        >
          <X className="w-4 h-4 text-slate-300" aria-hidden="true" />
        </button>
      )}
    </>
  );
};

export default FloatingChatButton;
