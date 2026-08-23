import nodemailer from 'nodemailer';

function createSmtpTransporter() {
  const host = process.env.SMTP_HOST || (process.env.GMAIL_USER ? 'smtp.gmail.com' : null);
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASS;
  const from = process.env.SMTP_FROM || `"QuickTutor Ghana" <${user || 'no-reply@quicktutor.com'}>`;

  if (!host || !user || !pass) return null;

  return {
    transporter: nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } }),
    from,
  };
}

export async function sendPasswordResetEmail(toEmail: string, resetLink: string): Promise<boolean> {
  const smtp = createSmtpTransporter();

  if (smtp) {
    try {
      await smtp.transporter.sendMail({
        from: smtp.from,
        to: toEmail,
        subject: 'QuickTutor Ghana - Password Reset Request',
        text: `Hello,\n\nYou requested to reset your password on QuickTutor Ghana.\n\nClick the link below to set a new password:\n${resetLink}\n\nThis link will expire in 15 minutes.\n\nIf you did not request this, please ignore this email.\n\nBest regards,\nQuickTutor Ghana Team`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
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

export async function sendVerificationEmail(toEmail: string, verificationLink: string): Promise<boolean> {
  const smtp = createSmtpTransporter();

  if (smtp) {
    try {
      await smtp.transporter.sendMail({
        from: smtp.from,
        to: toEmail,
        subject: 'QuickTutor Ghana - Verify Your Email Address',
        text: `Hello,\n\nThank you for creating an account on QuickTutor Ghana!\n\nPlease verify your email address by clicking the link below:\n${verificationLink}\n\nThis link will expire in 24 hours.\n\nIf you did not create an account, please ignore this email.\n\nBest regards,\nQuickTutor Ghana Team`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #7b1113;">Welcome to QuickTutor Ghana! 🎉</h2>
            <p>Hello,</p>
            <p>Thank you for creating an account. You're almost ready to get started!</p>
            <p>Please verify your email address to activate your account:</p>
            <p style="margin: 25px 0;">
              <a href="${verificationLink}" style="background-color: #7b1113; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 15px;">Verify My Email</a>
            </p>
            <p style="color: #666; font-size: 13px;">Or copy and paste this link into your browser:<br/><a href="${verificationLink}">${verificationLink}</a></p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">This link expires in 24 hours. If you did not create this account, you can safely ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;"/>
            <p style="color: #999; font-size: 11px;">QuickTutor Ghana &mdash; Connecting Students with Expert Tutors</p>
          </div>
        `,
      });
      console.log(`[Email] ✅ Verification email sent successfully to ${toEmail}`);
      return true;
    } catch (err) {
      console.error(`[Email] ❌ Failed to send verification email to ${toEmail}:`, err);
    }
  }

  console.log(`\n======================================================`);
  console.log(`📧 EMAIL VERIFICATION LINK for ${toEmail}:`);
  console.log(`${verificationLink}`);
  console.log(`======================================================\n`);
  return false;
}
