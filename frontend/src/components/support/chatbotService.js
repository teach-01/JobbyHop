/**
 * JobbyHop Chatbot Service
 *
 * This is the service layer between the chatbot UI and the FAQ engine.
 * Currently uses the local FAQ/rule-based engine.
 *
 * FUTURE AI INTEGRATION:
 * To replace the FAQ engine with an AI backend, swap out the
 * `processMessageWithFAQ` call in `sendMessage()` with an API call.
 * The UI layer does not need to change.
 *
 * Architecture:
 *   Chatbot UI (Chatbot.jsx)
 *       ↓
 *   chatbotService.js  ← this file
 *       ↓
 *   FAQ engine (chatbotFaq.js) ← currently
 *       ↓
 *   Future: AI API (OpenAI / Gemini / custom backend)
 */

import { FAQS, FAQ_CATEGORIES, FALLBACK_ANSWER } from './chatbotFaq';

/**
 * Normalises a string for comparison (lowercase, trim, collapse spaces).
 * @param {string} str
 * @returns {string}
 */
const normalise = (str) => str.toLowerCase().trim().replace(/\s+/g, ' ');

/**
 * Returns FAQ entries filtered by the user's role.
 * Admin-only entries are hidden from non-admin users.
 *
 * @param {string|null} role - 'ADMIN' | 'RECRUITER' | 'WORKER' | 'OPERATIONS' | null
 * @returns {Array}
 */
const getFaqsForRole = (role) => {
  return FAQS.filter((faq) => {
    if (faq.roles.includes('ALL')) return true;
    if (!role) return faq.roles.includes('GUEST') || faq.roles.includes('ALL');
    return faq.roles.includes(role);
  });
};

/**
 * Returns all FAQs in a given category, filtered by role.
 *
 * @param {string} category - FAQ_CATEGORIES key e.g. 'ACCOUNT'
 * @param {string|null} role
 * @returns {Array}
 */
const getFaqsByCategory = (category, role) => {
  return getFaqsForRole(role).filter((faq) => faq.category === category);
};

/**
 * Keyword-based search across all FAQs visible to the user's role.
 * Scores each FAQ by how many keywords match the input.
 *
 * @param {string} input - user's message
 * @param {string|null} role
 * @returns {{ faq: object, score: number }|null}
 */
const findBestMatch = (input, role) => {
  const normInput = normalise(input);
  const visibleFaqs = getFaqsForRole(role);

  let best = null;
  let bestScore = 0;

  for (const faq of visibleFaqs) {
    let score = 0;

    // Check keywords
    for (const kw of faq.keywords) {
      if (normInput.includes(normalise(kw))) {
        // Longer keyword = more specific match = higher weight
        score += kw.split(' ').length;
      }
    }

    // Check question text itself
    const normQ = normalise(faq.question);
    if (normInput.includes(normQ) || normQ.includes(normInput)) {
      score += 5;
    }

    // Check category name
    const catName = normalise(FAQ_CATEGORIES[faq.category] || '');
    if (normInput.includes(catName)) {
      score += 2;
    }

    if (score > bestScore) {
      bestScore = score;
      best = faq;
    }
  }

  return bestScore > 0 ? { faq: best, score: bestScore } : null;
};

/**
 * Processes a category quick-action click.
 * Returns a summary of FAQs in that category.
 *
 * @param {string} category - category key
 * @param {string|null} role
 * @returns {string}
 */
const processCategoryAction = (category, role) => {
  const faqs = getFaqsByCategory(category, role);
  if (!faqs.length) {
    return `I don't have specific help for that category right now. Please contact support at supportjobbyhop@gmail.com for assistance.`;
  }

  const categoryName = FAQ_CATEGORIES[category] || category;
  const questionList = faqs.map((f, i) => `${i + 1}. ${f.question}`).join('\n');
  return `Here are common questions about **${categoryName}**:\n\n${questionList}\n\nAsk me any of these questions and I'll be happy to help!`;
};

/**
 * Main message processing function.
 * This is the function to replace when integrating an AI backend.
 *
 * @param {string} input - user's message text
 * @param {{ role: string|null, isCategoryAction: boolean, category: string|null }} context
 * @returns {Promise<{ text: string, isFallback: boolean }>}
 */
const processMessageWithFAQ = async (input, context = {}) => {
  try {
    const { role = null, isCategoryAction = false, category = null } = context;

    // Category quick-action
    if (isCategoryAction && category) {
      const text = processCategoryAction(category, role);
      return { text, isFallback: false };
    }

    // Try to find a matching FAQ
    const match = findBestMatch(input, role);
    if (match) {
      return { text: match.faq.answer, isFallback: false };
    }

    // No match found → fallback
    return { text: FALLBACK_ANSWER, isFallback: true };
  } catch (err) {
    // Safe fallback on any error
    return {
      text: 'Something went wrong while processing your question. Please try again or contact support at supportjobbyhop@gmail.com.',
      isFallback: true,
    };
  }
};

/**
 * Public API for the chatbot UI.
 *
 * @param {string} input - user message
 * @param {object} context - { role, isCategoryAction, category }
 * @returns {Promise<{ text: string, isFallback: boolean }>}
 */
export const sendMessage = async (input, context = {}) => {
  // Small artificial delay to feel more natural (remove when using real AI)
  await new Promise((resolve) => setTimeout(resolve, 350));
  return processMessageWithFAQ(input, context);
};

export default { sendMessage };
