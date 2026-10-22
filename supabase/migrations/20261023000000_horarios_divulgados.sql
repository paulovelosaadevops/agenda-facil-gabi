-- Horários que a Gabi costuma divulgar na arte de "Horários livres", por dia da semana:
-- {"2": ["09:00", "14:00"], "3": [...]}. A arte da semana já vem com esses horários marcados (quando livres).
alter table public.businesses add column poster_times jsonb not null default '{}'::jsonb;
