-- 001_create_curated_articles.sql
-- Supabase/Postgres 用マイグレーション
-- curated_articles テーブルを作成し、インデックスと簡易削除関数を追加します。

BEGIN;

-- テーブル作成
CREATE TABLE IF NOT EXISTS public.curated_articles (
  id text PRIMARY KEY,
  title text NOT NULL,
  summary text,
  link text,
  pub_date timestamptz,
  feed_name text,
  hatebu integer DEFAULT 0,
  x_count integer DEFAULT 0,
  threads_count integer DEFAULT 0,
  emotion text,
  score double precision DEFAULT 0,
  category text,
  metadata jsonb DEFAULT '{}'::jsonb,
  inserted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- updated_at を自動更新するトリガー
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_timestamp ON public.curated_articles;
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON public.curated_articles
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

-- インデックス: スコア順取得、挿入日時、カテゴリ、タイトル検索用
CREATE INDEX IF NOT EXISTS idx_curated_articles_score ON public.curated_articles (score DESC);
CREATE INDEX IF NOT EXISTS idx_curated_articles_inserted_at ON public.curated_articles (inserted_at DESC);
CREATE INDEX IF NOT EXISTS idx_curated_articles_category ON public.curated_articles (category);

-- タイトルに対する高速検索（pg_trgm を使用した部分一致、高頻度検索向け）
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_curated_articles_title_trgm ON public.curated_articles USING gin (lower(title) gin_trgm_ops);

-- JSONB のメタデータ検索を高速化するための GIN インデックス
CREATE INDEX IF NOT EXISTS idx_curated_articles_metadata_gin ON public.curated_articles USING gin (metadata);

-- 保守用: 古いレコードを削除する簡易関数（スケジュールは Supabase の Cron / 外部スケジューラで呼ぶ）
CREATE OR REPLACE FUNCTION public.delete_old_curated_articles(retention_days integer)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.curated_articles WHERE inserted_at < now() - (retention_days || ' days')::interval;
END;
$$;

-- 使用例（手動実行）:
-- SELECT public.delete_old_curated_articles(30); -- 30日より古い行を削除

COMMIT;
