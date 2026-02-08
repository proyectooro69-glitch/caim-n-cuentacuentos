-- Create stories table
CREATE TABLE public.stories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  theme TEXT NOT NULL,
  title TEXT NOT NULL,
  share_code TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create story pages table
CREATE TABLE public.story_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  narrative_text TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(story_id, page_number)
);

-- Create page drawings table (stores canvas data per page)
CREATE TABLE public.page_drawings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id UUID NOT NULL REFERENCES public.story_pages(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  drawing_data TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(page_id, session_id)
);

-- Enable RLS
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_drawings ENABLE ROW LEVEL SECURITY;

-- Stories are public (anyone with share link can view)
CREATE POLICY "Stories are publicly readable"
  ON public.stories FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create stories"
  ON public.stories FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update stories"
  ON public.stories FOR UPDATE
  USING (true);

-- Story pages are public
CREATE POLICY "Story pages are publicly readable"
  ON public.story_pages FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create story pages"
  ON public.story_pages FOR INSERT
  WITH CHECK (true);

-- Page drawings are public (kids can save without auth)
CREATE POLICY "Page drawings are publicly readable"
  ON public.page_drawings FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create page drawings"
  ON public.page_drawings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update page drawings"
  ON public.page_drawings FOR UPDATE
  USING (true);

-- Create storage bucket for story images
INSERT INTO storage.buckets (id, name, public)
VALUES ('story-images', 'story-images', true);

-- Storage policies for story images
CREATE POLICY "Story images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'story-images');

CREATE POLICY "Anyone can upload story images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'story-images');

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_stories_updated_at
  BEFORE UPDATE ON public.stories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_page_drawings_updated_at
  BEFORE UPDATE ON public.page_drawings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();