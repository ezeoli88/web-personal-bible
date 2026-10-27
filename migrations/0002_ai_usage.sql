-- Consultas de IA por usuario y mes (UTC), para el cupo mensual.
CREATE TABLE ai_usage (
  email TEXT NOT NULL,                           -- siempre en minúsculas
  month TEXT NOT NULL,                           -- 'YYYY-MM'
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (email, month)
);
