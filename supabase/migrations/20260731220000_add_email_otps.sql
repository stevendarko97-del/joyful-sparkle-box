-- Migration: add email OTP storage
CREATE TABLE IF NOT EXISTS email_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code varchar(6) NOT NULL,
  type text NOT NULL,
  full_name text,
  role app_role,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '15 minutes',
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS email_otps_email_type_code_idx ON email_otps (email, type, code);
CREATE INDEX IF NOT EXISTS email_otps_expires_at_idx ON email_otps (expires_at);
