import React from 'react';

/**
 * Renders the quick-action category buttons shown below the greeting message.
 *
 * @param {{
 *   actions: Array<{ label: string, category: string }>,
 *   onAction: (label: string, category: string) => void,
 *   disabled: boolean
 * }} props
 */
const ChatbotQuickActions = ({ actions = [], onAction, disabled = false }) => {
  if (!actions.length) return null;

  return (
    <div
      className="flex flex-wrap gap-1.5 mt-2"
      role="group"
      aria-label="Quick help topics"
    >
      {actions.map((action) => (
        <button
          key={action.category}
          onClick={() => !disabled && onAction(action.label, action.category)}
          disabled={disabled}
          className="
            px-2.5 py-1 text-[11px] font-medium rounded-full
            border border-brand-500/40 bg-brand-500/10 text-brand-300
            hover:bg-brand-500/25 hover:border-brand-400/60 hover:text-brand-200
            focus:outline-none focus:ring-1 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-slate-900
            transition-all duration-150
            disabled:opacity-40 disabled:cursor-not-allowed
          "
          aria-label={`Get help with ${action.label}`}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
};

export default ChatbotQuickActions;
