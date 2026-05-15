
-- Roles enum and table
CREATE TYPE public.app_role AS ENUM ('student', 'teacher', 'admin');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles public read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Subjects & topics catalog
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subjects public read" ON public.subjects FOR SELECT USING (true);
CREATE POLICY "admins manage subjects" ON public.subjects FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(subject_id, name)
);
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "topics public read" ON public.topics FOR SELECT USING (true);
CREATE POLICY "admins manage topics" ON public.topics FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Teacher profiles
CREATE TABLE public.teacher_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  headline TEXT NOT NULL DEFAULT '',
  hourly_rate_cents INTEGER NOT NULL DEFAULT 4000,
  years_experience INTEGER NOT NULL DEFAULT 0,
  primary_subject_id UUID REFERENCES public.subjects(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher profiles public read" ON public.teacher_profiles FOR SELECT USING (true);
CREATE POLICY "teachers manage own profile" ON public.teacher_profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins manage teacher profiles" ON public.teacher_profiles FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Teacher subject/topic specialties (many to many on topics)
CREATE TABLE public.teacher_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  is_specialty BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(teacher_id, topic_id)
);
ALTER TABLE public.teacher_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher topics public read" ON public.teacher_topics FOR SELECT USING (true);
CREATE POLICY "teachers manage own topics" ON public.teacher_topics FOR ALL USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);

-- Bookings
CREATE TYPE public.booking_status AS ENUM ('pending','confirmed','completed','cancelled');

CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES public.topics(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  price_cents INTEGER NOT NULL DEFAULT 0,
  status booking_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  room_id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "students view own bookings" ON public.bookings FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "teachers view own bookings" ON public.bookings FOR SELECT USING (auth.uid() = teacher_id);
CREATE POLICY "admins view all bookings" ON public.bookings FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "students create bookings" ON public.bookings FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "students update own bookings" ON public.bookings FOR UPDATE USING (auth.uid() = student_id);
CREATE POLICY "teachers update own bookings" ON public.bookings FOR UPDATE USING (auth.uid() = teacher_id);
CREATE POLICY "admins manage bookings" ON public.bookings FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Ratings
CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stars INTEGER NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ratings public read" ON public.ratings FOR SELECT USING (true);
CREATE POLICY "students create rating for own booking" ON public.ratings FOR INSERT WITH CHECK (
  auth.uid() = student_id AND
  EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.student_id = auth.uid() AND b.status = 'completed')
);

-- Validation trigger for stars range
CREATE OR REPLACE FUNCTION public.validate_rating_stars()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.stars < 1 OR NEW.stars > 5 THEN
    RAISE EXCEPTION 'Stars must be between 1 and 5';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER ratings_validate_stars BEFORE INSERT OR UPDATE ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.validate_rating_stars();

-- Transactions
CREATE TYPE public.transaction_status AS ENUM ('pending','succeeded','failed','refunded');

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status transaction_status NOT NULL DEFAULT 'pending',
  stripe_payment_intent TEXT,
  stripe_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins view all transactions" ON public.transactions FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage transactions" ON public.transactions FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Profile auto-create + role assignment trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  _role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'student');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);

  IF _role = 'teacher' THEN
    INSERT INTO public.teacher_profiles (user_id) VALUES (NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at triggers
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER teacher_profiles_touch BEFORE UPDATE ON public.teacher_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER bookings_touch BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed subjects and topics
INSERT INTO public.subjects (name, slug, description) VALUES
  ('Mathematics','mathematics','Algebra, geometry, calculus and beyond'),
  ('Physics','physics','Mechanics, electromagnetism, modern physics'),
  ('Chemistry','chemistry','General, organic, and biochemistry'),
  ('Biology','biology','Cell biology, genetics, anatomy'),
  ('English Literature','english-literature','Reading, writing, and literary analysis'),
  ('History','history','World, US, and European history'),
  ('Computer Science','computer-science','Programming, algorithms, data structures'),
  ('SAT/ACT Prep','sat-act-prep','Standardized test preparation');

INSERT INTO public.topics (subject_id, name)
SELECT s.id, t.name FROM public.subjects s
JOIN (VALUES
  ('mathematics','Algebra II'),('mathematics','Geometry'),('mathematics','Pre-Calculus'),('mathematics','Calculus AB'),('mathematics','Calculus BC'),('mathematics','Statistics'),
  ('physics','AP Physics 1'),('physics','AP Physics C: Mechanics'),('physics','AP Physics C: E&M'),
  ('chemistry','General Chemistry'),('chemistry','AP Chemistry'),('chemistry','Organic Chemistry'),
  ('biology','General Biology'),('biology','AP Biology'),('biology','Genetics'),
  ('english-literature','Essay Writing'),('english-literature','AP English Language'),('english-literature','AP English Literature'),
  ('history','AP US History'),('history','AP World History'),('history','AP European History'),
  ('computer-science','Intro to Python'),('computer-science','AP Computer Science A'),('computer-science','Web Development'),
  ('sat-act-prep','SAT Math'),('sat-act-prep','SAT Verbal'),('sat-act-prep','ACT Science')
) AS t(slug, name) ON s.slug = t.slug;
