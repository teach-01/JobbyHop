import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Bot, RotateCcw, ExternalLink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ChatbotMessage from './ChatbotMessage';
import ChatbotQuickActions from './ChatbotQuickActions';
import { GREETING_MESSAGE, QUICK_ACTIONS } from './chatbotFaq';
import { sendMessage } from './chatbotService';

/**
 * JobbyHop Assistant Chatbot Panel
 *
 * Features:
 * - Role-aware quick actions (WORKER / RECRUITER / ADMIN / GUEST)
 * - FAQ-based responses via chatbotService
 * - Session-persistent message history (resets on page reload)
 * - Accessible: Escape closes, Enter sends, focus management
 * - Keyboard navigable
 *
 * @param {{ isOpen: boolean, onClose: () => void }} props
 */
const Chatbot = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const role = user?.role || 'GUEST';

  // Determine quick-action set for current role
  const quickActions = QUICK_ACTIONS[role] || QUICK_ACTIONS.GUEST;

  // Initialise history with greeting on first load
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // On first open, add greeting
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          ...GREETING_MESSAGE,
          id: `greeting-${Date.now()}`,
          timestamp: new Date(),
        },
      ]);
      setShowQuickActions(true);
    }
  }, [isOpen]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Escape key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  /**
   * Adds a message to the conversation.
   */
  const addMessage = (role, text) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}-${Math.random()}`,
        role,
        text,
        timestamp: new Date(),
      },
    ]);
  };

  /**
   * Sends a user message through the chatbot service.
   */
  const handleSend = useCallback(
    async (text, { isCategoryAction = false, category = null } = {}) => {
      const trimmed = text.trim();
      if (!trimmed || isTyping) return;

      // Hide quick actions after first user interaction
      setShowQuickActions(false);

      // Add user message
      addMessage('user', trimmed);
      setInput('');
      setIsTyping(true);

      try {
        const response = await sendMessage(trimmed, {
          role: role === 'GUEST' ? null : role,
          isCategoryAction,
          category,
        });
        addMessage('assistant', response.text);

        // If fallback, keep quick actions hidden but don't crash
      } catch (err) {
        addMessage(
          'assistant',
          'Something went wrong. Please try again or contact support at supportjobbyhop@gmail.com.'
        );
      } finally {
        setIsTyping(false);
        // Re-focus input
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [isTyping, role]
  );

  /**
   * Handles quick-action button clicks.
   */
  const handleQuickAction = useCallback(
    (label, category) => {
      handleSend(label, { isCategoryAction: true, category });
    },
    [handleSend]
  );

  /**
   * Handles input field keydown (Enter to send).
   */
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  /**
   * Resets the conversation.
   */
  const handleReset = () => {
    setMessages([
      {
        ...GREETING_MESSAGE,
        id: `greeting-${Date.now()}`,
        timestamp: new Date(),
      },
    ]);
    setShowQuickActions(true);
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop – click to close on mobile */}
      <div
        className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Chatbot Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="JobbyHop Assistant"
        className="
          fixed z-50
          bottom-4 right-4
          w-[calc(100vw-2rem)] max-w-sm
          sm:w-96
          flex flex-col
          bg-slate-900 border border-slate-700/60
          rounded-2xl shadow-2xl shadow-brand-950/50
          overflow-hidden
          animate-in slide-in-from-bottom-4 fade-in duration-200
        "
        style={{ maxHeight: 'calc(100vh - 6rem)' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-brand-900/80 via-slate-900/90 to-slate-900/90 border-b border-slate-800/60 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-brand-600/30 border border-brand-500/50 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-brand-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">JobbyHop Assistant</p>
              <p className="text-[10px] text-slate-400">How can we help you?</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleReset}
              title="Restart conversation"
              aria-label="Restart conversation"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              title="Close chat"
              aria-label="Close chat"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Messages Area ── */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0"
          style={{ maxHeight: '380px' }}
          role="list"
          aria-live="polite"
          aria-label="Chat messages"
        >
          {messages.map((msg, idx) => (
            <React.Fragment key={msg.id}>
              <ChatbotMessage message={msg} />
              {/* Show quick actions below the greeting */}
              {idx === 0 && showQuickActions && (
                <div className="pl-9">
                  <ChatbotQuickActions
                    actions={quickActions}
                    onAction={handleQuickAction}
                    disabled={isTyping}
                  />
                </div>
              )}
            </React.Fragment>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex gap-2.5 justify-start" aria-label="Assistant is typing" aria-live="polite">
              <div className="w-7 h-7 rounded-full bg-brand-600/30 border border-brand-500/40 flex items-center justify-center mt-0.5 flex-shrink-0">
                <Bot className="w-3.5 h-3.5 text-brand-400" />
              </div>
              <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-slate-800/80 border border-slate-700/50 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          {/* Fallback "Contact Support" button – shown after fallback response */}
          {messages.length > 1 &&
            messages[messages.length - 1].role === 'assistant' &&
            messages[messages.length - 1].text?.includes('contact our support team') && (
              <div className="pl-9">
                <a
                  href="/contact"
                  className="
                    inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-full
                    border border-amber-500/40 bg-amber-500/10 text-amber-300
                    hover:bg-amber-500/20 hover:border-amber-400/60 hover:text-amber-200
                    transition-all duration-150
                    focus:outline-none focus:ring-1 focus:ring-amber-500
                  "
                  aria-label="Go to Contact Support page"
                >
                  <ExternalLink className="w-3 h-3" />
                  Contact Support
                </a>
              </div>
            )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input Bar ── */}
        <div className="px-3 py-3 border-t border-slate-800/60 bg-slate-900/80 flex-shrink-0">
          <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2 focus-within:border-brand-500/60 transition-colors">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your question..."
              aria-label="Type your message"
              disabled={isTyping}
              maxLength={500}
              className="
                flex-1 bg-transparent text-xs text-white placeholder-slate-500
                outline-none border-none disabled:opacity-60
              "
            />
            <button
              onClick={() => handleSend(input)}
              disabled={!input.trim() || isTyping}
              aria-label="Send message"
              className="
                flex-shrink-0 w-7 h-7 rounded-lg
                bg-brand-600 hover:bg-brand-500
                disabled:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center justify-center
                transition-colors duration-150
                focus:outline-none focus:ring-1 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-slate-900
              "
            >
              <Send className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
          <p className="text-center text-[10px] text-slate-600 mt-1.5">
            JobbyHop Assistant · FAQ-based help
          </p>
        </div>
      </div>
    </>
  );
};

export default Chatbot;
