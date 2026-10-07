INSERT INTO categories (name) VALUES
  ('Web development'),
  ('Project management')
ON CONFLICT (name) DO NOTHING;