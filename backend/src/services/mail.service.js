
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.MAIL_PORT || '465'),
  secure: process.env.MAIL_PORT === '465', 
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  // Gmail sometimes needs this for certain environments
  tls: {
    rejectUnauthorized: false
  }
});

// Verify connection configuration on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('[MailService] ❌ Transporter verification failed:', error);
  } else {
    console.log('[MailService] ✅ Server is ready to take our messages');
  }
});

// Debug: Check if credentials are loaded
if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
  console.warn('[MailService] ⚠️ MAIL_USER or MAIL_PASS is not set in environment variables.');
} else {
  console.log(`[MailService] ✅ Mail service config found for ${process.env.MAIL_USER}`);
}

/**
 * Send an email notification to a client about a new hearing date.
 * @param {Object} options
 */
export async function sendHearingNotification({ to, clientName, caseTitle, caseId, hearingDate }) {
  console.log(`[MailService] Preparing email for ${to}...`);
  
  if (!to) {
    console.error('[MailService] ❌ No recipient email provided');
    return { success: false, error: 'No recipient' };
  }

  const mailOptions = {
    from: process.env.MAIL_FROM || `"Law Firm Support" <${process.env.MAIL_USER}>`,
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
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
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
    console.log(`[MailService] Sending email to ${to} using ${process.env.MAIL_HOST}...`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`[MailService] 🚀 Email sent successfully! MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[MailService] ❌ Failed to send email to ${to}:`, error);
    if (error.code === 'EAUTH') {
      console.error('[MailService] ❌ Authentication error: Check MAIL_USER and MAIL_PASS (App Password)');
    }
    return { success: false, error: error.message };
  }
}

export default {
  sendHearingNotification,
};

