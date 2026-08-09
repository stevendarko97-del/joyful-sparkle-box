-- Create course_materials table
CREATE TABLE public.course_materials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('past_questions', 'textbook', 'sample_questions', 'other')),
    file_url TEXT NOT NULL,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.course_materials ENABLE ROW LEVEL SECURITY;

-- Policies
-- Anyone can view course materials
CREATE POLICY "Students and teachers can view materials"
ON public.course_materials FOR SELECT
USING (true);

-- Only teachers/admins can insert
CREATE POLICY "Teachers can insert materials"
ON public.course_materials FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('teacher', 'admin')
    )
);

-- Create storage bucket for materials
INSERT INTO storage.buckets (id, name, public) VALUES ('materials', 'materials', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public Access to materials"
ON storage.objects FOR SELECT
USING (bucket_id = 'materials');

CREATE POLICY "Teachers can upload materials"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'materials' AND 
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('teacher', 'admin')
    )
);
