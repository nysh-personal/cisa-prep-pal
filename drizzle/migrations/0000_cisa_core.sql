CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  chunk_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  idx int NOT NULL,
  domain int NOT NULL,
  content text NOT NULL,
  cards_done boolean NOT NULL DEFAULT false,
  mcq_done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chunks_user_domain ON public.chunks(user_id, domain, idx);
CREATE TABLE public.cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  chunk_id uuid REFERENCES public.chunks(id) ON DELETE CASCADE,
  domain int NOT NULL,
  topic text NOT NULL DEFAULT '',
  front text NOT NULL,
  back text NOT NULL,
  known boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  chunk_id uuid REFERENCES public.chunks(id) ON DELETE CASCADE,
  domain int NOT NULL,
  stem text NOT NULL,
  options jsonb NOT NULL,
  answer int NOT NULL,
  explanation text NOT NULL DEFAULT '',
  times_seen int NOT NULL DEFAULT 0,
  times_correct int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  total int NOT NULL,
  correct int NOT NULL,
  by_domain jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['documents','chunks','cards','questions','exam_attempts'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "own rows" ON public.%I FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t);
  END LOOP;
END $$;