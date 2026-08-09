-- Run this in your Supabase SQL Editor to create the custom backend auth tables!

CREATE TABLE public.local_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  reset_token TEXT,
  reset_token_expires TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Note: Our NodeJS backend will now handle inserting into this table 
-- and the existing public.profiles table simultaneously.
