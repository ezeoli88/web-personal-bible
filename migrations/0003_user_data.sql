-- Datos de cada lector, por correo (siempre en minúsculas).

-- Subrayados, marcadores y notas. Un versículo es el mismo en todas las traducciones.
CREATE TABLE verse_annotations (
  email       TEXT NOT NULL,
  book        INTEGER NOT NULL,
  chapter     INTEGER NOT NULL,
  verse       INTEGER NOT NULL,
  text        TEXT NOT NULL,                     -- el versículo como se leyó al marcarlo
  translation TEXT NOT NULL,
  highlight   TEXT,
  bookmarked  INTEGER NOT NULL DEFAULT 0 CHECK (bookmarked IN (0, 1)),
  note        TEXT,
  updated_at  INTEGER NOT NULL,                  -- milisegundos
  PRIMARY KEY (email, book, chapter, verse)
);

-- Cuaderno de estudio.
CREATE TABLE notebook_entries (
  id          TEXT NOT NULL,
  email       TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('ai', 'ask', 'word')),
  title       TEXT NOT NULL,
  reference   TEXT NOT NULL,
  translation TEXT NOT NULL,
  place       TEXT,                              -- JSON { bookNumber, chapter, verses }
  content     TEXT NOT NULL,
  tags        TEXT NOT NULL DEFAULT '[]',        -- JSON array
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (email, id)
);

-- «Seguir leyendo»: el último lugar leído.
CREATE TABLE reading_progress (
  email       TEXT PRIMARY KEY,
  slug        TEXT NOT NULL,
  chapter     INTEGER NOT NULL,
  verse       INTEGER NOT NULL,
  translation TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);
