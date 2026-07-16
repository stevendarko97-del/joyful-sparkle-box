
CREATE TYPE public.verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');

ALTER TABLE public.teacher_profiles
  ADD COLUMN verification_status public.verification_status NOT NULL DEFAULT 'unverified',
  ADD COLUMN id_document_url text,
  ADD COLUMN qualification_document_url text,
  ADD COLUMN verification_notes text,
  ADD COLUMN verified_at timestamptz;

CREATE POLICY "Admins can update any teacher profile"
  ON public.teacher_profiles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.teacher_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_hour smallint NOT NULL CHECK (start_hour BETWEEN 0 AND 23),
  end_hour smallint NOT NULL CHECK (end_hour BETWEEN 1 AND 24),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_hour > start_hour)
);

CREATE INDEX teacher_availability_teacher_idx ON public.teacher_availability(teacher_id);

GRANT SELECT ON public.teacher_availability TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.teacher_availability TO authenticated;
GRANT ALL ON public.teacher_availability TO service_role;

ALTER TABLE public.teacher_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view availability"
  ON public.teacher_availability FOR SELECT
  USING (true);

CREATE POLICY "Teachers manage own availability"
  ON public.teacher_availability FOR ALL
  TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers upload own verification docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Teachers or admins read verification docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'verification-docs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Teachers update own verification docs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
