import nodemailer from 'nodemailer';

export async function sendPasswordResetEmail(toEmail: string, resetLink: string): Promise<boolean> {
  const host = process.env.SMTP_HOST || (process.env.GMAIL_USER ? 'smtp.gmail.com' : null);
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASS;
  const from = process.env.SMTP_FROM || `"QuickTutor Ghana" <${user || 'no-reply@quicktutor.com'}>`;

  if (host && user && pass) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });

      await transporter.sendMail({
        from,
        to: toEmail,
        subject: 'QuickTutor Ghana - Password Reset Request',
        text: `Hello,\n\nYou requested to reset your password on QuickTutor Ghana.\n\nClick the link below to set a new password:\n${resetLink}\n\nThis link will expire in 15 minutes.\n\nIf you did not request this, please ignore this email.\n\nBest regards,\nQuickTutor Ghana Team`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; rounded: 10px;">
            <h2 style="color: #7b1113;">QuickTutor Ghana</h2>
            <p>Hello,</p>
            <p>You recently requested to reset your password for your QuickTutor Ghana account.</p>
            <p style="margin: 25px 0;">
              <a href="${resetLink}" style="background-color: #7b1113; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
            </p>
            <p style="color: #666; font-size: 13px;">Or copy and paste this link into your browser:<br/><a href="${resetLink}">${resetLink}</a></p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">This link will expire in 15 minutes. If you did not request this reset, you can safely ignore this email.</p>
          </div>
        `,
      });

      console.log(`[Email] ✅ Password reset email sent successfully to ${toEmail}`);
      return true;
    } catch (err) {
      console.error(`[Email] ❌ Failed to send reset email to ${toEmail}:`, err);
    }
  }

  console.log(`\n======================================================`);
  console.log(`🔑 PASSWORD RESET LINK for ${toEmail}:`);
  console.log(`${resetLink}`);
  console.log(`======================================================\n`);
  return false;
}
