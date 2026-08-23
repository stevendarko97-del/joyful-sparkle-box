/**
 * Arkesel SMS Integration for QuickTutor Ghana
 * Sends automated transactional SMS alerts to students, tutors, and admin.
 */

function formatGhanaPhoneNumber(phone: string): string | null {
  if (!phone) return null;
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('233') && cleaned.length === 12) {
    return cleaned;
  }
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return '233' + cleaned.substring(1);
  }
  if (cleaned.length === 9) {
    return '233' + cleaned;
  }
  if (cleaned.length >= 10) {
    return cleaned;
  }
  return null;
}

export async function sendSms(recipientPhone: string, message: string): Promise<boolean> {
  const formattedPhone = formatGhanaPhoneNumber(recipientPhone);
  if (!formattedPhone) {
    console.warn(`[Arkesel SMS] Invalid phone number skipped: "${recipientPhone}"`);
    return false;
  }

  const apiKey = process.env.ARKESEL_API_KEY;
  if (!apiKey) {
    console.warn('[Arkesel SMS] ARKESEL_API_KEY is not configured — SMS skipped');
    return false;
  }

  try {
    // Attempt Arkesel v2 API
    const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: 'QuickTutor',
        message: message,
        recipients: [formattedPhone],
      }),
    });

    const data = await res.json() as any;
    if (res.ok && (data.status === 'success' || data.code === '1000' || data.data?.status === 'success')) {
      console.log(`[Arkesel SMS] ✅ Message delivered to ${formattedPhone}`);
      return true;
    }

    // Fallback: Try Arkesel v1 query endpoint if v2 returns non-success
    const v1Url = `https://sms.arkesel.com/sms/api?action=send-sms&api_key=${encodeURIComponent(apiKey)}&to=${encodeURIComponent(formattedPhone)}&from=QuickTutor&sms=${encodeURIComponent(message)}`;
    const v1Res = await fetch(v1Url);
    if (v1Res.ok) {
      console.log(`[Arkesel SMS] ✅ Delivered via v1 fallback to ${formattedPhone}`);
      return true;
    }

    console.warn(`[Arkesel SMS] API response:`, data);
    return false;
  } catch (error: any) {
    console.error(`[Arkesel SMS] Error sending SMS to ${formattedPhone}:`, error?.message || error);
    return false;
  }
}

// ── Notification Helpers ────────────────────────────────────────────────────────

export async function sendBookingCreatedSms(params: {
  studentPhone: string | null;
  teacherPhone: string | null;
  studentName: string;
  teacherName: string;
  scheduledAt: string;
  priceGhs: string;
}) {
  const dateStr = new Date(params.scheduledAt).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  if (params.studentPhone) {
    const studentMsg = `QuickTutor: Your lesson with ${params.teacherName} on ${dateStr} is booked! Amount: GHS ${params.priceGhs}. Please complete payment on your dashboard to confirm.`;
    await sendSms(params.studentPhone, studentMsg);
  }

  if (params.teacherPhone) {
    const teacherMsg = `QuickTutor: ${params.studentName} booked a lesson with you on ${dateStr} (GHS ${params.priceGhs}). Awaiting student payment.`;
    await sendSms(params.teacherPhone, teacherMsg);
  }
}

export async function sendPaymentConfirmedSms(params: {
  studentPhone: string | null;
  teacherPhone: string | null;
  studentName: string;
  teacherName: string;
  scheduledAt: string;
  amountGhs: string;
  netPayoutGhs: string;
}) {
  const dateStr = new Date(params.scheduledAt).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Prompt Student: Payment confirmed & lesson locked in
  if (params.studentPhone) {
    const studentMsg = `QuickTutor: Payment of GHS ${params.amountGhs} confirmed! Your lesson with ${params.teacherName} on ${dateStr} is confirmed. Log in to join the classroom.`;
    await sendSms(params.studentPhone, studentMsg);
  }

  // Prompt Tutor: Payment received, session confirmed with net earnings
  if (params.teacherPhone) {
    const teacherMsg = `QuickTutor: You have a new booked & paid lesson on ${dateStr} with ${params.studentName}! Net payout will be GHS ${params.netPayoutGhs} upon completion.`;
    await sendSms(params.teacherPhone, teacherMsg);
  }
}

export async function sendAdminPaymentAlertSms(params: {
  adminPhone: string | null;
  studentName: string;
  teacherName: string;
  amountGhs: string;
  scheduledAt: string;
}) {
  if (!params.adminPhone) return;
  const dateStr = new Date(params.scheduledAt).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const adminMsg = `QuickTutor Admin: Payment received! Student ${params.studentName} paid GHS ${params.amountGhs} for a lesson with Tutor ${params.teacherName} on ${dateStr}.`;
  await sendSms(params.adminPhone, adminMsg);
}

export async function sendLessonPriorReminderSms(params: {
  studentPhone: string | null;
  teacherPhone: string | null;
  studentName: string;
  teacherName: string;
  scheduledAt: string;
  minutesBefore: 30 | 5;
}) {
  const dateStr = new Date(params.scheduledAt).toLocaleString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (params.minutesBefore === 30) {
    if (params.studentPhone) {
      const msg = `QuickTutor Alert: Reminder! Your lesson with ${params.teacherName} starts in 30 minutes (${dateStr}). Please prepare your device.`;
      await sendSms(params.studentPhone, msg);
    }
    if (params.teacherPhone) {
      const msg = `QuickTutor Alert: Reminder! Your lesson with ${params.studentName} starts in 30 minutes (${dateStr}). Please get ready to enter the room.`;
      await sendSms(params.teacherPhone, msg);
    }
  } else if (params.minutesBefore === 5) {
    if (params.studentPhone) {
      const msg = `QuickTutor Urgent: Your lesson with ${params.teacherName} starts in 5 minutes! Log into QuickTutor now to enter your classroom.`;
      await sendSms(params.studentPhone, msg);
    }
    if (params.teacherPhone) {
      const msg = `QuickTutor Urgent: Your lesson with ${params.studentName} starts in 5 minutes! Please log in and enter the classroom now.`;
      await sendSms(params.teacherPhone, msg);
    }
  }
}

export async function sendBookingCancelledSms(params: {
  phone: string | null;
  name: string;
  scheduledAt: string;
  cancelledBy: string;
}) {
  if (!params.phone) return;
  const dateStr = new Date(params.scheduledAt).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const msg = `QuickTutor: Your lesson on ${dateStr} was cancelled by ${params.cancelledBy}. Please visit your dashboard for rescheduling or refund info.`;
  await sendSms(params.phone, msg);
}

export async function sendPayoutRemittedSms(params: {
  teacherPhone: string | null;
  teacherName: string;
  amountGhs: string;
}) {
  if (!params.teacherPhone) return;
  const msg = `QuickTutor Payout: GHS ${params.amountGhs} has been remitted to your Mobile Money account. Thank you for tutoring on QuickTutor Ghana!`;
  await sendSms(params.teacherPhone, msg);
}

export async function sendSupportResolvedSms(params: {
  phone: string | null;
  subject: string;
  resolutionNotes?: string | null;
}) {
  if (!params.phone) return;
  const notesText = params.resolutionNotes ? `: "${params.resolutionNotes}"` : '.';
  const msg = `QuickTutor Support: Your ticket "${params.subject}" was resolved by Admin${notesText} Check your dashboard for details.`;
  await sendSms(params.phone, msg);
}
