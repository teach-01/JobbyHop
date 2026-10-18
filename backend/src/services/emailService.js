const nodemailer = require('nodemailer');

/**
 * emailService – wraps Nodemailer for sending transactional email.
 * All SMTP credentials are read exclusively from process.env.
 * The App Password is NEVER logged or returned to the frontend.
 */

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  if (
    !process.env.EMAIL_HOST ||
    !process.env.EMAIL_PORT ||
    !process.env.EMAIL_USER ||
    !process.env.EMAIL_PASSWORD
  ) {
    if (process.env.NODE_ENV === 'test') {
      return {
        sendMail: async () => ({ messageId: 'test_mock_message_id' }),
      };
    }
    throw new Error('Email SMTP environment variables are not configured. Check EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD in .env');
  }

  _transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT, 10),
    secure: false, // STARTTLS on port 587
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD, // Google App Password – never logged
    },
    tls: {
      rejectUnauthorized: true,
    },
  });

  return _transporter;
}

/**
 * Sends a 6-digit OTP email to the specified address.
 * @param {string} toEmail  – recipient address
 * @param {string} otp      – plaintext 6-digit OTP (used only to compose the email body)
 */
async function sendOtpEmail(toEmail, otp) {
  const transporter = getTransporter();
  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;

  const mailOptions = {
    from: `"JobbyHop" <${fromAddress}>`,
    to: toEmail,
    subject: 'Your JobbyHop Email Verification Code',
    text: `Your JobbyHop verification code is: ${otp}\n\nThis code expires in 5 minutes.\n\nIf you did not request this, please ignore this email.`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>JobbyHop OTP</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">JobbyHop</h1>
              <p style="margin:8px 0 0;color:#c4b5fd;font-size:13px;">Email Verification</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="color:#cbd5e1;font-size:15px;margin:0 0 24px;">Hi there,</p>
              <p style="color:#cbd5e1;font-size:15px;margin:0 0 32px;">Use the code below to verify your email address. This code is valid for <strong style="color:#a78bfa;">5 minutes</strong>.</p>
              <!-- OTP Box -->
              <div style="background:#0f172a;border:1px solid #7c3aed;border-radius:12px;padding:28px;text-align:center;margin-bottom:32px;">
                <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:2px;">Verification Code</p>
                <p style="margin:0;color:#fff;font-size:42px;font-weight:900;letter-spacing:12px;font-family:'Courier New',monospace;">${otp}</p>
              </div>
              <p style="color:#64748b;font-size:13px;margin:0 0 8px;">⚠️ Never share this code with anyone.</p>
              <p style="color:#64748b;font-size:13px;margin:0;">If you didn't request this, you can safely ignore this email.</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #334155;text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;">© ${new Date().getFullYear()} JobbyHop · Event Staffing Platform</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  };

  await transporter.sendMail(mailOptions);
  // NOTE: OTP is NOT logged here – only the recipient and success are observable
}

/**
 * Sends a password reset code and link to the user.
 * @param {string} toEmail     – recipient address
 * @param {string} resetToken  – the reset code/token (e.g. RESET-XXXXXX)
 * @param {string} frontendUrl – base URL of the frontend (e.g. http://localhost:5173)
 */
async function sendPasswordResetEmail(toEmail, resetToken, frontendUrl) {
  const transporter = getTransporter();
  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  const resetLink = `${frontendUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

  const mailOptions = {
    from: `"JobbyHop" <${fromAddress}>`,
    to: toEmail,
    subject: 'Password Reset Request - JobbyHop',
    text: `Hello,\n\nWe received a request to reset your JobbyHop password.\n\nYour password reset code is:\n\n${resetToken}\n\nThis code expires in 15 minutes.\n\nYou can enter this code on the Create New Password page, or use this direct reset link:\n${resetLink}\n\nIf you did not request a password reset, please ignore this email.\n\nDo not share this code with anyone.\n\nRegards,\nJobbyHop Team`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Password Reset Request - JobbyHop</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="500" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">JobbyHop</h1>
              <p style="margin:8px 0 0;color:#c4b5fd;font-size:13px;font-weight:600;">Password Reset</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="color:#cbd5e1;font-size:15px;margin:0 0 16px;">Hello,</p>
              <p style="color:#cbd5e1;font-size:15px;margin:0 0 28px;line-height:1.5;">We received a request to reset your JobbyHop password.</p>
              
              <!-- Reset Code / Token Box -->
              <div style="background:#0f172a;border:1px solid #7c3aed;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
                <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:2px;font-weight:700;">Your Password Reset Code</p>
                <p style="margin:0 0 8px;color:#38bdf8;font-size:32px;font-weight:900;letter-spacing:4px;font-family:'Courier New',monospace;">${resetToken}</p>
                <p style="margin:0;color:#a78bfa;font-size:12px;font-weight:600;">⏱️ This code expires in 15 minutes</p>
              </div>

              <!-- Direct Reset Button -->
              <div style="text-align:center;margin-bottom:28px;">
                <a href="${resetLink}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;font-size:14px;font-weight:700;padding:12px 28px;border-radius:10px;text-decoration:none;">Create New Password Directly</a>
              </div>

              <div style="background:#0f172a80;border:1px solid #334155;border-radius:10px;padding:16px;margin-bottom:24px;">
                <p style="color:#f87171;font-size:13px;font-weight:700;margin:0 0 6px;">⚠️ Security Warning</p>
                <p style="color:#94a3b8;font-size:12px;margin:0 0 6px;">Do not share this code or link with anyone.</p>
                <p style="color:#64748b;font-size:12px;margin:0;">If you did not request a password reset, please ignore this email. Your current password remains safe.</p>
              </div>

              <p style="color:#64748b;font-size:12px;word-break:break-all;margin:0;">
                Direct URL: <a href="${resetLink}" style="color:#a78bfa;text-decoration:none;">${resetLink}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #334155;text-align:center;">
              <p style="margin:0;color:#64748b;font-size:12px;">Regards,<br><strong style="color:#94a3b8;">JobbyHop Team</strong></p>
              <p style="margin:8px 0 0;color:#475569;font-size:11px;">© ${new Date().getFullYear()} JobbyHop · Event Staffing Platform</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  };

  await transporter.sendMail(mailOptions);
}

module.exports = { sendOtpEmail, sendPasswordResetEmail };

