
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.MAIL_PORT || '465'),
  secure: process.env.MAIL_PORT === '465', // true for 465, false for other ports
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// Debug: Check if credentials are loaded (but don't log the password!)
if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
  console.warn('[MailService] ⚠️ MAIL_USER or MAIL_PASS is not set in environment variables.');
} else {
  console.log(`[MailService] ✅ Mail service initialized for ${process.env.MAIL_USER}`);
}

/**
 * Send an email notification to a client about a new hearing date.
 * @param {Object} options
 * @param {string} options.to - Client email
 * @param {string} options.clientName - Client name
 * @param {string} options.caseTitle - Case title
 * @param {string} options.caseId - Case ID
 * @param {string} options.hearingDate - The new hearing date
 */
export async function sendHearingNotification({ to, clientName, caseTitle, caseId, hearingDate }) {
  if (!to) {
    console.error('[MailService] No recipient email provided');
    return;
  }

  const mailOptions = {
    from: process.env.MAIL_FROM || '"Law Firm Support" <no-reply@lawfirm.com>',
    to,
    subject: `Update: New Hearing Date for Case ${caseId}`,
    text: `Dear ${clientName},

This is an automated notification regarding your case: "${caseTitle}" (ID: ${caseId}).

A new hearing date has been scheduled for: ${hearingDate}.

Please ensure that you submit all required documents at least two days before the hearing date. 

If you have any questions, please contact your lawyer via the dashboard.

Best regards,
Law Firm Team`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; rounded-lg: 12px;">
        <h2 style="color: #1f2937; margin-bottom: 20px;">Hearing Date Update</h2>
        <p>Dear <strong>${clientName}</strong>,</p>
        <p>This is an automated notification regarding your case:</p>
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #6b7280;">Case ID: ${caseId}</p>
          <p style="margin: 5px 0 0 0; font-size: 18px; color: #111827; font-weight: 600;">${caseTitle}</p>
        </div>
        <p>A new hearing date has been scheduled for:</p>
        <p style="font-size: 20px; color: #b91c1c; font-weight: 700; margin: 10px 0;">${hearingDate}</p>
        <p style="color: #4b5563; line-height: 1.6;">
          <strong>Important:</strong> Please ensure that you submit all required documents at least two days before the hearing date.
        </p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 12px; color: #9ca3af;">
          This is an automated message. Please do not reply directly to this email.
        </p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[MailService] Email sent successfully to ${to}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[MailService] Failed to send email to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
}

export default {
  sendHearingNotification,
};
