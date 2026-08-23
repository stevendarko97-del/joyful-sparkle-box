import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// ── Reusable primitives ───────────────────────────────────────────────────────
const uuid = z.string().uuid('Must be a valid UUID');
const positiveInt = z.number().int().positive('Must be a positive integer');
const emailField = z.string().email('Must be a valid email address').toLowerCase().trim();
const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long');

// ── Auth ──────────────────────────────────────────────────────────────────────
export const signupSchema = z.object({
  email: emailField,
  password: passwordField,
  fullName: z.string().min(2, 'Full name is required').max(100).trim(),
  role: z.enum(['student', 'teacher'], { message: 'Role must be student or teacher' }),
  phone: z.string().min(7, 'Phone number is required').max(20).trim(),
  location: z.string().min(2, 'Location is required').max(200).trim(),
  bio: z.string().max(800).optional(),
  // Student extras
  schoolName: z.string().max(200).optional(),
  level: z.string().max(100).optional(),
  studentExam: z.string().max(50).optional(),
  guardianPhone: z.string().max(20).optional(),
  // Teacher extras
  headline: z.string().max(300).optional(),
  yearsExperience: z.number().int().min(0).max(60).optional(),
  hourlyRate: z.number().min(0).max(10000).optional(),
  primarySubject: z.string().optional(),
  examTypes: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  certificateUrl: z.string().optional(),
});

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: passwordField,
});

export const resendVerificationSchema = z.object({
  email: emailField,
});

// ── Bookings ──────────────────────────────────────────────────────────────────
export const createBookingSchema = z.object({
  teacher_id: uuid,
  topic_id: uuid.optional(),
  scheduled_at: z.string().datetime({ message: 'Must be a valid ISO datetime' }),
  duration_minutes: z.number().int().min(15).max(480).optional().default(60),
  price_cents: positiveInt,
  location: z.string().max(200).optional().default('Online'),
});

export const rescheduleBookingSchema = z.object({
  scheduled_at: z.string().datetime({ message: 'Must be a valid ISO datetime' }),
});

// ── Payments ──────────────────────────────────────────────────────────────────
export const paystackInitSchema = z.object({
  booking_id: uuid,
  email: emailField,
});

export const paystackVerifySchema = z.object({
  reference: z.string().min(1, 'Reference is required'),
  booking_id: uuid,
});

export const ratingSchema = z.object({
  booking_id: uuid,
  teacher_id: uuid,
  stars: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

// ── Messages ──────────────────────────────────────────────────────────────────
export const sendMessageSchema = z.object({
  receiver_id: uuid,
  content: z.string().min(1, 'Message cannot be empty').max(2000).trim(),
});

// ── Support ───────────────────────────────────────────────────────────────────
export const supportTicketSchema = z.object({
  booking_id: uuid.optional().nullable(),
  category: z.string().min(1, 'Category is required').max(100),
  subject: z.string().min(3, 'Subject too short').max(300).trim(),
  description: z.string().min(10, 'Description too short').max(5000).trim(),
});

export const ticketStatusSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved']),
  resolution_notes: z.string().max(2000).optional().nullable(),
});

// ── Admin ─────────────────────────────────────────────────────────────────────
export const payoutSchema = z.object({
  teacher_id: uuid,
  amount_cents: positiveInt,
});

export const verificationActionSchema = z.object({
  approve: z.boolean(),
  notes: z.string().max(500).optional(),
});

export const smsTestSchema = z.object({
  phone: z.string().min(7, 'Phone is required'),
  message: z.string().min(1, 'Message is required').max(160),
});

// ── Middleware factory ────────────────────────────────────────────────────────
/**
 * Returns an Express middleware that validates req.body against the given Zod schema.
 * On failure it sends 400 with a structured error list.
 */
export function validate<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): any => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = (result.error as any).issues || (result.error as any).errors || [];
      const errors = issues.map((e: any) => ({
        field: e.path?.join('.') || '',
        message: e.message || 'Invalid value',
      }));
      return res.status(400).json({ error: 'Validation failed', errors });
    }
    req.body = result.data;
    next();
  };
}
