import nodemailer from 'nodemailer';

function createSmtpTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const rawPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASS;
  const pass = rawPass ? rawPass.replace(/\s+/g, '') : undefined; // Remove spaces that Google App Passwords often have
  const from = process.env.SMTP_FROM || `"QuickTutor Ghana" <${user || 'no-reply@quicktutor.com'}>`;

  if (!user || !pass) {
    console.warn(`[Email] Missing email credentials (GMAIL_USER: ${!!user}, GMAIL_APP_PASS: ${!!pass})`);
    return null;
  }

  // If using Gmail directly without custom SMTP host, use nodemailer's built-in 'gmail' service
  if (!host || host.includes('gmail')) {
    return {
      transporter: nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
      }),
      from,
    };
  }

  return {
    transporter: nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    }),
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
      const info = await smtp.transporter.sendMail({
        from: smtp.from,
        to: toEmail,
        replyTo: smtp.from,
        subject: 'Verify your QuickTutor Ghana account',
        text: `Hello,\n\nThank you for creating an account on QuickTutor Ghana!\n\nPlease verify your email address by clicking the link below:\n${verificationLink}\n\nThis link will expire in 24 hours.\n\nIf you did not create an account, please ignore this email.\n\nBest regards,\nQuickTutor Ghana Team`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <h2 style="color: #7b1113; margin-top: 0;">QuickTutor Ghana</h2>
            <p style="font-size: 15px; color: #1e293b;">Hello,</p>
            <p style="font-size: 14px; color: #334155; line-height: 1.6;">Thank you for registering on QuickTutor Ghana. Please click the button below to verify your email address and activate your account:</p>
            <p style="margin: 28px 0; text-align: center;">
              <a href="${verificationLink}" style="background-color: #7b1113; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 15px;">Verify My Email</a>
            </p>
            <p style="color: #64748b; font-size: 13px; line-height: 1.5;">Or copy and paste this link into your web browser:<br/><a href="${verificationLink}" style="color: #7b1113; word-break: break-all;">${verificationLink}</a></p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;"/>
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">This verification link will expire in 24 hours. If you did not create an account, please ignore this email.</p>
          </div>
        `,
      });
      console.log(`[Email] ✅ Verification email sent to ${toEmail} (messageId: ${info.messageId})`);
      return true;
    } catch (err: any) {
      console.error(`[Email] ❌ Failed to send verification email to ${toEmail}:`, err?.message || err);
    }
  }

  console.log(`\n======================================================`);
  console.log(`📧 EMAIL VERIFICATION LINK for ${toEmail}:`);
  console.log(`${verificationLink}`);
  console.log(`======================================================\n`);
  return false;
}

export async function testSmtpConnection(targetEmail: string): Promise<{ success: boolean; message: string; details?: any }> {
  const smtp = createSmtpTransporter();
  if (!smtp) {
    return { success: false, message: 'SMTP credentials missing (GMAIL_USER or GMAIL_APP_PASS not set)' };
  }
  try {
    const verifyResult = await smtp.transporter.verify();
    const sendResult = await smtp.transporter.sendMail({
      from: smtp.from,
      to: targetEmail,
      subject: 'QuickTutor Ghana - SMTP Test Email',
      text: 'This is a test email confirming that your QuickTutor SMTP email system is working perfectly.',
    });
    return {
      success: true,
      message: `Test email successfully sent to ${targetEmail}`,
      details: { verifyResult, messageId: sendResult.messageId, response: sendResult.response }
    };
  } catch (err: any) {
    return {
      success: false,
      message: `SMTP Error: ${err.message}`,
      details: { code: err.code, response: err.response, stack: err.stack }
    };
  }
}

export async function sendPaymentReceiptEmail(
  toEmail: string,
  details: {
    studentName: string;
    teacherName: string;
    amountGhs: string;
    reference: string;
    scheduledAt: string;
    bookingId: string;
  }
): Promise<boolean> {
  const smtp = createSmtpTransporter();
  const { studentName, teacherName, amountGhs, reference, scheduledAt, bookingId } = details;
  const lessonDate = new Date(scheduledAt).toLocaleString('en-GH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const receiptDate = new Date().toLocaleString('en-GH', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; border-radius: 12px; overflow: hidden; border: 1px solid #eee;">
      <div style="background: linear-gradient(135deg, #7b1113, #a31f22); padding: 28px 32px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">QuickTutor Ghana</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 6px 0 0; font-size: 14px;">Payment Receipt</p>
      </div>
      <div style="padding: 28px 32px; background: #ffffff;">
        <p style="color: #333; font-size: 15px; margin: 0 0 6px;">Hello <strong>${studentName}</strong>,</p>
        <p style="color: #555; font-size: 14px; margin: 0 0 24px;">Your payment was successful! Here's your receipt for the lesson booking.</p>

        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Receipt Date</td>
              <td style="padding: 10px 0; color: #111827; font-size: 13px; font-weight: 600; text-align: right; border-bottom: 1px solid #e5e7eb;">${receiptDate}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Tutor</td>
              <td style="padding: 10px 0; color: #111827; font-size: 13px; font-weight: 600; text-align: right; border-bottom: 1px solid #e5e7eb;">${teacherName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Lesson Date &amp; Time</td>
              <td style="padding: 10px 0; color: #111827; font-size: 13px; font-weight: 600; text-align: right; border-bottom: 1px solid #e5e7eb;">${lessonDate}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Transaction Reference</td>
              <td style="padding: 10px 0; font-size: 12px; font-family: monospace; color: #4f46e5; font-weight: 600; text-align: right; border-bottom: 1px solid #e5e7eb;">${reference}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Booking ID</td>
              <td style="padding: 10px 0; font-size: 11px; font-family: monospace; color: #9ca3af; text-align: right; border-bottom: 1px solid #e5e7eb;">${bookingId}</td>
            </tr>
            <tr>
              <td style="padding: 14px 0 0; color: #111827; font-size: 15px; font-weight: bold;">Amount Paid</td>
              <td style="padding: 14px 0 0; font-size: 18px; font-weight: bold; color: #15803d; text-align: right;">GHS ${amountGhs}</td>
            </tr>
          </table>
        </div>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px;">
          <p style="margin: 0; color: #15803d; font-size: 13px; font-weight: 600;">✅ Payment Confirmed &amp; Booking Active</p>
          <p style="margin: 6px 0 0; color: #166534; font-size: 12px;">Your lesson is confirmed. You can access the session room from your student dashboard.</p>
        </div>

        <p style="color: #9ca3af; font-size: 12px; margin: 0; border-top: 1px solid #f3f4f6; padding-top: 16px;">
          If you have any questions or concerns, please contact us via the support section on your dashboard.<br/>
          <strong>QuickTutor Ghana</strong> — Connecting Students with Expert Tutors
        </p>
      </div>
    </div>
  `;

  if (smtp) {
    try {
      await smtp.transporter.sendMail({
        from: smtp.from,
        to: toEmail,
        subject: `QuickTutor Ghana — Payment Receipt (GHS ${amountGhs})`,
        text: `Hello ${studentName},\n\nYour payment of GHS ${amountGhs} for a lesson with ${teacherName} on ${lessonDate} was successful.\n\nTransaction Reference: ${reference}\nBooking ID: ${bookingId}\n\nYou can access your lesson room from your student dashboard.\n\nThank you,\nQuickTutor Ghana Team`,
        html: htmlBody,
      });
      console.log(`[Email] ✅ Payment receipt sent to ${toEmail}`);
      return true;
    } catch (err) {
      console.error(`[Email] ❌ Failed to send receipt to ${toEmail}:`, err);
    }
  }

  console.log(`\n======================================================`);
  console.log(`🧾 PAYMENT RECEIPT for ${toEmail}: GHS ${amountGhs} — Ref: ${reference}`);
  console.log(`======================================================\n`);
  return false;
}
