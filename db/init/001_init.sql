-- Intentionally simplistic schema for the case study (ripe for improvement)
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source JSONB NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS template_categories (
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  title TEXT
);

-- Seed data
INSERT INTO categories (slug) VALUES
  ('instagram'),
  ('story'),
  ('minimal'),
  ('collage'),
  ('photo'),
  ('promo')
ON CONFLICT DO NOTHING;

INSERT INTO templates (id, title, source, order_index)
VALUES
  ('tpl_001', 'Instagram Story Minimal', '{"type":"canvas","width":1080,"height":1920,"layers":[]}', 1),
  ('tpl_002', 'Photo Collage Grid', '{"type":"grid","rows":2,"columns":2}', 2),
  ('tpl_003', 'Promo Post Bold', '{"type":"canvas","width":1080,"height":1080,"typography":"bold"}', 3)
ON CONFLICT (id) DO NOTHING;

-- Link categories
WITH cat AS (
  SELECT id, slug FROM categories
)
INSERT INTO template_categories (template_id, category_id)
SELECT x.tpl, c.id FROM (
  VALUES
    ('tpl_001','instagram'),
    ('tpl_001','story'),
    ('tpl_001','minimal'),
    ('tpl_002','collage'),
    ('tpl_002','photo'),
    ('tpl_003','promo'),
    ('tpl_003','instagram')
) x(tpl, slug)
JOIN cat c ON c.slug = x.slug
ON CONFLICT DO NOTHING;
