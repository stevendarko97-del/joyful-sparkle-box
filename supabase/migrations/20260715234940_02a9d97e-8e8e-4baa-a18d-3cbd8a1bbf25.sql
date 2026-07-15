
CREATE TYPE public.exam_type AS ENUM ('BECE', 'WASSCE', 'NOV_DEC', 'SHS_REMEDIAL', 'JHS_REMEDIAL');

ALTER TABLE public.teacher_profiles
  ADD COLUMN location text NOT NULL DEFAULT '',
  ADD COLUMN exam_types public.exam_type[] NOT NULL DEFAULT '{}';

CREATE INDEX teacher_profiles_location_idx ON public.teacher_profiles (location);
CREATE INDEX teacher_profiles_exam_types_idx ON public.teacher_profiles USING GIN (exam_types);
