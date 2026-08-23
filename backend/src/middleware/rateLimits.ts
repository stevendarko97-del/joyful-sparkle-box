import rateLimit from 'express-rate-limit';

/** For auth endpoints: login, signup, password reset, email verification */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' },
});

/** For outbound SMS operations to prevent credit exhaustion */
export const smsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many SMS requests. Please wait a few minutes before trying again.' },
});
