const { sendContactEmail } = require('../utils/contactMailer');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/contact
 * Accepts contact form submissions and forwards them to supportjobbyhop@gmail.com
 * via dedicated contact transporter.
 */
const submitContactForm = async (req, res) => {
  try {
    const { name, email, role, subject, message } = req.body || {};

    // Validate presence of all required fields
    if (
      !name ||
      typeof name !== 'string' ||
      !name.trim() ||
      !email ||
      typeof email !== 'string' ||
      !email.trim() ||
      !role ||
      typeof role !== 'string' ||
      !role.trim() ||
      !subject ||
      typeof subject !== 'string' ||
      !subject.trim() ||
      !message ||
      typeof message !== 'string' ||
      !message.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required.',
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }

    const trimmedName = name.trim();
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();
    const trimmedRole = role.trim();

    // Length safeguards
    if (trimmedName.length > 120) {
      return res.status(400).json({
        success: false,
        message: 'Name must not exceed 120 characters.',
      });
    }

    if (trimmedSubject.length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Subject must not exceed 200 characters.',
      });
    }

    if (trimmedMessage.length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'Message must not exceed 5000 characters.',
      });
    }

    // Send email via dedicated contact mailer
    await sendContactEmail({
      name: trimmedName,
      email: trimmedEmail,
      role: trimmedRole,
      subject: trimmedSubject,
      message: trimmedMessage,
    });

    return res.status(200).json({
      success: true,
      message: 'Your message has been sent successfully.',
    });
  } catch (error) {
    // Technical error logged on backend only; never expose SMTP secrets or stacks to client
    console.error('Contact email error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to send your message right now. Please try again later.',
    });
  }
};

module.exports = { submitContactForm };
