import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, CheckCircle2, MessageCircle, HelpCircle } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import Chatbot from '../../components/support/Chatbot';
import contactService from '../../services/contactService';

export const ContactPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'WORKER',
    subject: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { showToast } = useNotifications();

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Prevent duplicate submissions while in-flight
    if (isSubmitting) return;

    const trimmedName = formData.name.trim();
    const trimmedEmail = formData.email.trim();
    const trimmedRole = formData.role;
    const trimmedSubject = formData.subject.trim();
    const trimmedMessage = formData.message.trim();

    // Client-side validations
    if (!trimmedName) {
      showToast('Please enter your name.', 'error');
      return;
    }

    if (!trimmedEmail) {
      showToast('Please enter your email address.', 'error');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }

    if (!trimmedRole) {
      showToast('Please select who you are contacting as.', 'error');
      return;
    }

    if (!trimmedSubject) {
      showToast('Please enter a subject.', 'error');
      return;
    }

    if (!trimmedMessage) {
      showToast('Please enter your message or question.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await contactService.submitContactForm({
        name: trimmedName,
        email: trimmedEmail,
        role: trimmedRole,
        subject: trimmedSubject,
        message: trimmedMessage,
      });

      // Clear/reset the form upon success
      setFormData({ name: '', email: '', role: 'WORKER', subject: '', message: '' });
      setSubmitted(true);
      showToast('Your message has been sent successfully.', 'success');
    } catch (err) {
      // Do NOT reset form on error so user input is preserved
      const errorMsg =
        typeof err === 'string'
          ? err
          : err?.message || 'Unable to send your message right now. Please try again later.';
      showToast(errorMsg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-12">
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-extrabold text-white">Contact JobbyHop Support</h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
          Have questions about job approvals, worker assignments, or payment tracking? Our Admin team is here to assist.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Contact Info Cards */}
        <div className="space-y-6">
          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-brand-500/20 text-brand-400">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase">Email Support</p>
                <p className="text-sm font-bold text-white">supportjobbyhop@gmail.com</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase">Helpline / WhatsApp</p>
                <p className="text-sm font-bold text-white">+91 9214535240</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-purple-500/20 text-purple-400">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase">Headquarters</p>
                <p className="text-sm font-bold text-white">Jaipur, Rajasthan</p>
              </div>
            </div>
          </div>

          {/* ── Chatbot Section (Need Help?) ── */}
          <div className="glass-card p-6 rounded-2xl border border-brand-500/30 bg-brand-500/5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-brand-500/20 text-brand-400 flex-shrink-0">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Need Help?</p>
                <p className="text-xs text-brand-300 font-medium">Chat with JobbyHop Assistant</p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Get quick help with your account, jobs, applications, payments, and other questions.
            </p>

            <button
              onClick={() => setIsChatOpen(true)}
              aria-label="Open JobbyHop Assistant chat"
              className="
                w-full gradient-btn py-2.5 rounded-xl text-xs font-bold
                flex items-center justify-center gap-2
                focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 focus:ring-offset-slate-900
              "
            >
              <MessageCircle className="w-4 h-4" />
              💬 Chat with JobbyHop Assistant
            </button>

            <p className="text-[11px] text-slate-500 text-center">
              Can't find what you're looking for? Our support team is here to help.
            </p>
          </div>
        </div>

        {/* Contact Form */}
        <div className="glass-card p-8 rounded-3xl border border-slate-800">
          {submitted ? (
            <div className="text-center py-12 space-y-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <h3 className="text-xl font-bold text-white">Message Received!</h3>
              <p className="text-xs text-slate-400">
                Thank you for contacting JobbyHop. An Admin representative will respond within 24 hours.
              </p>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setFormData({ name: '', email: '', role: 'WORKER', subject: '', message: '' });
                }}
                className="gradient-btn px-6 py-2.5 rounded-xl text-xs font-bold"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs" noValidate>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Your Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:border-brand-500 outline-none"
                  placeholder="Enter full name"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:border-brand-500 outline-none"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">I am contacting as</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white"
                >
                  <option value="WORKER">Event Staff / Worker</option>
                  <option value="RECRUITER">Event Recruiter / Organizer</option>
                  <option value="OTHER">General Inquiry</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Subject</label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:border-brand-500 outline-none"
                  placeholder="Enter subject"
                  maxLength={200}
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Message / Question</label>
                <textarea
                  required
                  rows="4"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:border-brand-500 outline-none"
                  placeholder="Describe your inquiry..."
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="gradient-btn w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Inline Chatbot panel (opened from Contact page) */}
      <Chatbot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  );
};

export default ContactPage;
