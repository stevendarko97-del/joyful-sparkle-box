import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { pool } from '../db';
import { authLimiter } from '../middleware/rateLimits';
import { requireAuth } from '../middleware/auth';
import { sendPasswordResetEmail, sendVerificationEmail } from '../email';
import { sendSms } from '../sms';
import {
  validate,
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resendVerificationSchema,
} from '../validation';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET!;

// ── Signup ────────────────────────────────────────────────────────────────────
router.post('/signup', authLimiter, validate(signupSchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      email, password, fullName, role, phone, location, bio,
      schoolName, level, studentExam, guardianPhone,
      headline, yearsExperience, hourlyRate, primarySubject, examTypes, languages, certificateUrl,
    } = req.body;

    const verificationToken = jwt.sign(
      { email: email.trim().toLowerCase(), purpose: 'verify_email' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const password_hash = await bcrypt.hash(password, 10);
    const userRes = await pool.query(
      'INSERT INTO local_users (email, password_hash, email_verified, verification_token) VALUES ($1, $2, false, $3) RETURNING id, email',
      [email, password_hash, verificationToken]
    );
    const user = userRes.rows[0];

    try {
      await pool.query(
        'INSERT INTO profiles (id, full_name, role, phone, bio) VALUES ($1, $2, $3, $4, $5)',
        [user.id, fullName, role, phone || null, bio || null]
      );
    } catch (e: any) {
      await pool.query('DELETE FROM local_users WHERE id = $1', [user.id]);
      throw e;
    }

    if (role === 'student') {
      try {
        await pool.query(
          `INSERT INTO student_profiles (user_id, school_name, level, exam_type, location, guardian_phone)
           VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (user_id) DO UPDATE
           SET school_name=$2, level=$3, exam_type=$4, location=$5, guardian_phone=$6`,
          [user.id, schoolName || null, level || null, studentExam || null, location || null, guardianPhone || null]
        );
      } catch { /* table may not exist yet */ }
    } else if (role === 'teacher') {
      try {
        await pool.query(`ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS certificate_url TEXT;`).catch(() => {});
        await pool.query(
          `INSERT INTO teacher_profiles (user_id, video_url, background, hourly_rate_cents, years_experience, location, exam_types, languages, certificate_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (user_id) DO UPDATE
           SET video_url=$2, background=$3, hourly_rate_cents=$4, years_experience=$5, location=$6, exam_types=$7, languages=$8, certificate_url=$9`,
          [
            user.id, headline || null, location || null,
            Math.round((Number(hourlyRate) || 0) * 100),
            Number(yearsExperience) || 0,
            location || null,
            JSON.stringify(examTypes ?? []),
            JSON.stringify(languages ?? ['English']),
            certificateUrl || null,
          ]
        );
        if (primarySubject) {
          await pool.query(`UPDATE teacher_profiles SET primary_subject_id=$1 WHERE user_id=$2`, [primarySubject, user.id]);
        }
      } catch { /* table may not exist yet */ }
    }

    const host = req.get('origin') || `${req.protocol}://${req.get('host')}` || 'https://quicktutor-ghana.onrender.com';
    const verificationLink = `${host}/auth/verify-email?token=${verificationToken}`;
    await sendVerificationEmail(user.email, verificationLink);

    return res.status(201).json({ message: 'signup_pending_verification', email: user.email });
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    return res.status(500).json({ error: err.message });
  }
});

// ── Verify Email ──────────────────────────────────────────────────────────────
router.get('/verify-email', async (req: Request, res: Response): Promise<any> => {
  try {
    const { token } = req.query as { token?: string };
    if (!token) return res.status(400).json({ error: 'Missing verification token' });

    const decoded: any = jwt.verify(token, JWT_SECRET);
    if (decoded.purpose !== 'verify_email') return res.status(400).json({ error: 'Invalid token type' });

    const result = await pool.query(
      'UPDATE local_users SET email_verified = true, verification_token = NULL WHERE email = $1 AND verification_token = $2 RETURNING id',
      [decoded.email, token]
    );

    const host = req.get('origin') || `${req.protocol}://${req.get('host')}` || 'https://quicktutor-ghana.onrender.com';
    if (result.rowCount === 0) {
      const existing = await pool.query('SELECT email_verified FROM local_users WHERE email = $1', [decoded.email]);
      if (existing.rows[0]?.email_verified) {
        return res.redirect(`${host}/auth?mode=login&notice=already_verified`);
      }
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }
    return res.redirect(`${host}/auth?mode=login&notice=verified`);
  } catch {
    return res.status(400).json({ error: 'Invalid or expired verification token' });
  }
});

// ── Resend Verification ───────────────────────────────────────────────────────
router.post('/resend-verification', authLimiter, validate(resendVerificationSchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const { email } = req.body;
    const userRes = await pool.query('SELECT id, email, email_verified FROM local_users WHERE email = $1', [email]);
    const user = userRes.rows[0];
    if (!user || user.email_verified) return res.json({ message: 'If unverified, a new link has been sent.' });

    const verificationToken = jwt.sign({ email: user.email, purpose: 'verify_email' }, JWT_SECRET, { expiresIn: '24h' });
    await pool.query('UPDATE local_users SET verification_token = $1 WHERE id = $2', [verificationToken, user.id]);

    const host = req.get('origin') || `${req.protocol}://${req.get('host')}` || 'https://quicktutor-ghana.onrender.com';
    await sendVerificationEmail(user.email, `${host}/auth/verify-email?token=${verificationToken}`);

    return res.json({ message: 'If unverified, a new link has been sent.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', authLimiter, validate(loginSchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body;
    const userRes = await pool.query('SELECT * FROM local_users WHERE email = $1', [email]);
    const user = userRes.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });
    if (!user.email_verified) return res.status(403).json({ error: 'email_not_verified', email: user.email });

    const profileRes = await pool.query('SELECT role, suspended FROM profiles WHERE id = $1', [user.id]);
    const profile = profileRes.rows[0];
    const role = profile?.role || 'student';
    if (profile?.suspended) {
      return res.status(403).json({
        error: 'account_suspended',
        email: user.email,
        message: 'Your account has been suspended by an administrator. You may submit an appeal below.'
      });
    }
    const token = jwt.sign({ id: user.id, role, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 });
    return res.json({ message: 'Login successful', token, user: { id: user.id, email: user.email, role } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Forgot Password ───────────────────────────────────────────────────────────
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const { email } = req.body;
    const userRes = await pool.query('SELECT * FROM local_users WHERE email = $1', [email]);
    const user = userRes.rows[0];
    if (!user) return res.json({ message: 'If email exists, reset link sent.' });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '15m' });
    const host = req.get('origin') || `${req.protocol}://${req.get('host')}` || 'https://quicktutor-ghana.onrender.com';
    const resetLink = `${host}/forgot-password?token=${token}`;

    await sendPasswordResetEmail(user.email, resetLink);

    try {
      const profileRes = await pool.query('SELECT phone FROM profiles WHERE id = $1', [user.id]);
      const phone = profileRes.rows[0]?.phone;
      if (phone) await sendSms(phone, `QuickTutor Ghana: Reset your password here: ${resetLink}`);
    } catch { /* SMS is best-effort */ }

    return res.json({ message: 'If email exists, reset link sent.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Reset Password ────────────────────────────────────────────────────────────
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const { token, newPassword } = req.body;
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const password_hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE local_users SET password_hash = $1 WHERE id = $2', [password_hash, decoded.id]);
    return res.json({ message: 'Password reset successfully' });
  } catch {
    return res.status(400).json({ error: 'Invalid or expired token' });
  }
});

// ── Upload Certificate (stored in PostgreSQL as base64) ───────────────────────
// The file is stored directly as a base64 data URL in teacher_profiles.certificate_url.
// This works on Render (no ephemeral disk) with zero external services.
router.post('/upload-certificate', async (req: Request, res: Response): Promise<any> => {
  try {
    const { fileBase64, fileName, mimeType } = req.body;
    if (!fileBase64 || !fileName) {
      return res.status(400).json({ error: 'Missing file data' });
    }

    // Enforce a 5 MB size limit (base64 string ~ 4/3 × raw bytes)
    const MAX_B64_LEN = 5 * 1024 * 1024 * (4 / 3);
    if (fileBase64.length > MAX_B64_LEN) {
      return res.status(413).json({ error: 'File too large. Maximum size is 5 MB.' });
    }

    // Ensure it includes the data URL prefix (e.g. data:application/pdf;base64,...)
    const detectedMime = mimeType || 'application/octet-stream';
    const dataUrl = fileBase64.startsWith('data:')
      ? fileBase64
      : `data:${detectedMime};base64,${fileBase64}`;

    // We return the data URL as the "filePath" — it gets stored in certificate_url
    return res.json({ filePath: dataUrl });
  } catch (err: any) {
    console.error('[upload-certificate]', err);
    return res.status(500).json({ error: err.message });
  }
});


// ── Me / Logout ─────────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({ user: (req as any).user });
});

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

export default router;
