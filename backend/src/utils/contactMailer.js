const nodemailer = require('nodemailer');

/**
 * HTML escaper to prevent script/HTML injection in transactional emails.
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let _contactTransporter = null;

/**
 * Creates and caches the dedicated Nodemailer transporter for the Contact/Support system.
 * Keeps Contact email functionality logically separate from the OTP system.
 */
function getContactTransporter() {
  if (_contactTransporter) return _contactTransporter;

  const user = process.env.CONTACT_EMAIL_USER || 'supportjobbyhop@gmail.com';
  const pass = process.env.CONTACT_EMAIL_PASS;

  if (!pass) {
    throw new Error('Contact email credentials not configured in environment (CONTACT_EMAIL_PASS is missing).');
  }

  _contactTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user,
      pass,
    },
  });

  return _contactTransporter;
}

/**
 * Sends a contact-form submission to supportjobbyhop@gmail.com.
 *
 * @param {object} params
 * @param {string} params.name     - Sender's full name
 * @param {string} params.email    - Sender's email address (used as replyTo)
 * @param {string} params.role     - WORKER | RECRUITER | OTHER
 * @param {string} params.subject  - User-entered subject
 * @param {string} params.message  - User's message / inquiry
 */
async function sendContactEmail({ name, email, role, subject, message }) {
  const transporter = getContactTransporter();

  const recipient = process.env.CONTACT_EMAIL_TO || 'supportjobbyhop@gmail.com';
  const fromUser = process.env.CONTACT_EMAIL_USER || 'supportjobbyhop@gmail.com';
  const fromHeader = `"JobbyHop Contact" <${fromUser}>`;
  const replyToHeader = `"${name}" <${email}>`;

  const roleLabelMap = {
    WORKER: 'Event Staff / Worker',
    RECRUITER: 'Event Recruiter / Organizer',
    OTHER: 'General Inquiry',
  };
  const roleLabel = roleLabelMap[role] || (role ? String(role) : 'General Inquiry');

  const submissionDate = new Date();
  const formattedDate = submissionDate.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'full',
    timeStyle: 'medium',
  }) + ` (UTC: ${submissionDate.toISOString()})`;

  // Email subject line using the user's entered subject
  const emailSubject = `JobbyHop Contact: ${subject.trim()}`;

  // Plain-text representation
  const textBody = [
    `New JobbyHop Contact Request`,
    ``,
    `Name:`,
    `${name}`,
    ``,
    `Email:`,
    `${email}`,
    ``,
    `Contacting as:`,
    `${roleLabel}`,
    ``,
    `Subject:`,
    `${subject}`,
    ``,
    `Message:`,
    `${message}`,
    ``,
    `Submitted:`,
    `${formattedDate}`,
    ``,
    `---`,
    `Reply directly to this email to respond to ${name} (${email}).`,
  ].join('\n');

  // HTML representation (with HTML sanitization)
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeRole = escapeHtml(roleLabel);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message);
  const safeDate = escapeHtml(formattedDate);

  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New JobbyHop Contact Request</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:28px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">JobbyHop</h1>
              <p style="margin:8px 0 0;color:#c4b5fd;font-size:13px;font-weight:500;">Support / Contact Inquiry</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <p style="color:#94a3b8;font-size:12px;margin:0 0 20px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">
                New Contact Form Submission
              </p>

              <!-- Inquiry Summary Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border-collapse:collapse;">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #334155;width:140px;">
                    <span style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Name</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #334155;text-align:right;">
                    <strong style="color:#f8fafc;font-size:14px;">${safeName}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #334155;">
                    <span style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Email</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #334155;text-align:right;">
                    <a href="mailto:${safeEmail}" style="color:#a78bfa;font-size:13px;text-decoration:none;font-weight:500;">${safeEmail}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #334155;">
                    <span style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Contacting As</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #334155;text-align:right;">
                    <span style="color:#e2e8f0;font-size:13px;">${safeRole}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #334155;">
                    <span style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Subject</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #334155;text-align:right;">
                    <span style="color:#38bdf8;font-size:13px;font-weight:600;">${safeSubject}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;">
                    <span style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Submitted</span>
                  </td>
                  <td style="padding:10px 0;text-align:right;">
                    <span style="color:#94a3b8;font-size:12px;">${safeDate}</span>
                  </td>
                </tr>
              </table>

              <!-- Message Section -->
              <p style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">Message</p>
              <div style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:20px;margin-bottom:24px;">
                <p style="color:#cbd5e1;font-size:14px;line-height:1.7;margin:0;white-space:pre-wrap;">${safeMessage}</p>
              </div>

              <!-- Reply-To Notice -->
              <p style="color:#64748b;font-size:12px;margin:0;line-height:1.6;">
                Clicking <strong style="color:#94a3b8;">Reply</strong> in your email client will respond directly to <a href="mailto:${safeEmail}" style="color:#a78bfa;text-decoration:none;">${safeEmail}</a>.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:18px 40px;border-top:1px solid #334155;text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;">© ${new Date().getFullYear()} JobbyHop Support System</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  await transporter.sendMail({
    from: fromHeader,
    to: recipient,
    replyTo: replyToHeader,
    subject: emailSubject,
    text: textBody,
    html: htmlBody,
  });
}

module.exports = {
  getContactTransporter,
  sendContactEmail,
};
