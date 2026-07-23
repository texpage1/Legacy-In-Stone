PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS collection_types (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ownership_collections (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS display_locations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  parent_id INTEGER REFERENCES display_locations(id) ON DELETE SET NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS specimens (
  id INTEGER PRIMARY KEY,
  specimen_code TEXT NOT NULL UNIQUE,
  legacy_number INTEGER,
  name TEXT NOT NULL,
  collection_type_id INTEGER NOT NULL REFERENCES collection_types(id),
  ownership_collection_id INTEGER REFERENCES ownership_collections(id) ON DELETE SET NULL,
  display_location_id INTEGER REFERENCES display_locations(id) ON DELETE SET NULL,
  classification TEXT,
  identification TEXT,
  locality TEXT,
  accessory_minerals TEXT,
  color TEXT,
  luster TEXT,
  size_class TEXT,
  formula TEXT,
  crystal_system TEXT,
  mineral_group TEXT,
  provenance TEXT,
  acquisition_date TEXT,
  acquisition_price_cents INTEGER,
  acquisition_price_original TEXT,
  status TEXT,
  notes TEXT,
  story TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0,1)),
  needs_review INTEGER NOT NULL DEFAULT 0 CHECK (needs_review IN (0,1)),
  source_system TEXT,
  source_row_number INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS specimen_photos (
  id INTEGER PRIMARY KEY,
  specimen_id INTEGER NOT NULL REFERENCES specimens(id) ON DELETE CASCADE,
  photo_type TEXT NOT NULL DEFAULT 'specimen' CHECK (photo_type IN ('specimen','close_up','fluorescence','historical','other')),
  original_filename TEXT NOT NULL,
  normalized_filename TEXT NOT NULL,
  source_archive TEXT,
  storage_key TEXT,
  mime_type TEXT,
  sequence_number INTEGER NOT NULL DEFAULT 1,
  caption TEXT,
  photographer TEXT,
  date_taken TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
  checksum_sha256 TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(specimen_id, normalized_filename)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_one_primary_photo_per_specimen
ON specimen_photos(specimen_id) WHERE is_primary = 1;

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('historical_label','dealer_label','field_tag','catalog_card','newspaper_article','research_paper','correspondence','map','book','catalog','family_photo','other')),
  description TEXT,
  original_filename TEXT,
  storage_key TEXT,
  mime_type TEXT,
  document_date TEXT,
  source_or_citation TEXT,
  transcription TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS specimen_documents (
  specimen_id INTEGER NOT NULL REFERENCES specimens(id) ON DELETE CASCADE,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  relationship_note TEXT,
  PRIMARY KEY(specimen_id, document_id)
);

CREATE TABLE IF NOT EXISTS references_library (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  authors TEXT,
  publication TEXT,
  publication_year INTEGER,
  url TEXT,
  citation TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS specimen_references (
  specimen_id INTEGER NOT NULL REFERENCES specimens(id) ON DELETE CASCADE,
  reference_id INTEGER NOT NULL REFERENCES references_library(id) ON DELETE CASCADE,
  page_or_section TEXT,
  relationship_note TEXT,
  PRIMARY KEY(specimen_id, reference_id)
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS specimen_tags (
  specimen_id INTEGER NOT NULL REFERENCES specimens(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY(specimen_id, tag_id)
);

CREATE TABLE IF NOT EXISTS collection_history (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('biography','collection_history','family_memory','milestone','article','photograph','other')),
  event_date TEXT,
  body TEXT,
  document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS specimen_change_log (
  id INTEGER PRIMARY KEY,
  specimen_id INTEGER NOT NULL REFERENCES specimens(id) ON DELETE CASCADE,
  changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  change_type TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  note TEXT
);

CREATE INDEX IF NOT EXISTS ix_specimens_name ON specimens(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS ix_specimens_collection_type ON specimens(collection_type_id);
CREATE INDEX IF NOT EXISTS ix_specimens_ownership_collection ON specimens(ownership_collection_id);
CREATE INDEX IF NOT EXISTS ix_specimens_display_location ON specimens(display_location_id);
CREATE INDEX IF NOT EXISTS ix_specimens_locality ON specimens(locality COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS ix_specimens_status ON specimens(status COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS ix_photos_specimen_sequence ON specimen_photos(specimen_id, sequence_number);
CREATE INDEX IF NOT EXISTS ix_documents_type ON documents(document_type);

CREATE VIEW IF NOT EXISTS specimen_catalog_view AS
SELECT
  s.specimen_code,
  s.legacy_number,
  s.name,
  ct.name AS collection_type,
  oc.name AS ownership_collection,
  dl.name AS display_location,
  s.classification,
  s.identification,
  s.locality,
  s.provenance,
  s.status,
  COUNT(p.id) AS photo_count,
  MAX(CASE WHEN p.is_primary = 1 THEN p.storage_key END) AS primary_photo_storage_key
FROM specimens s
JOIN collection_types ct ON ct.id = s.collection_type_id
LEFT JOIN ownership_collections oc ON oc.id = s.ownership_collection_id
LEFT JOIN display_locations dl ON dl.id = s.display_location_id
LEFT JOIN specimen_photos p ON p.specimen_id = s.id
GROUP BY s.id;
