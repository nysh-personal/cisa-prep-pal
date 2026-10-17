ALTER TABLE public.chunks ADD COLUMN IF NOT EXISTS fts tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
CREATE INDEX IF NOT EXISTS chunks_fts_idx ON public.chunks USING gin(fts);

CREATE OR REPLACE FUNCTION public.search_chunks(q text, n int DEFAULT 6)
RETURNS TABLE (id uuid, document_id uuid, idx int, domain int, content text, title text, rank real)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT c.id, c.document_id, c.idx, c.domain, c.content, d.title,
         ts_rank(c.fts, websearch_to_tsquery('english', q)) AS rank
  FROM public.chunks c JOIN public.documents d ON d.id = c.document_id
  WHERE c.user_id = auth.uid() AND c.fts @@ websearch_to_tsquery('english', q)
  ORDER BY rank DESC LIMIT n
$$;
GRANT EXECUTE ON FUNCTION public.search_chunks(text, int) TO authenticated;

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  msg_id text NOT NULL,
  role text NOT NULL,
  parts jsonb NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rows" ON public.chat_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);