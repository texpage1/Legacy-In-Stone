# Legacy in Stone — Database Foundation v0.1

This package contains the first populated production database foundation for **Legacy in Stone**.

## Included

- `database/legacy_in_stone.sqlite` — populated SQLite database
- `database/schema.sql` — complete reproducible schema
- `scripts/build_database.py` — rebuilds the database from the catalog and photo manifest
- `data/mineral_catalog.csv` — current 420-record source catalog
- `data/photo_manifest.csv` — normalized photo-link manifest for 354 images
- `docs/validation.txt` — import and integrity results

## Current import

- 420 mineral catalog records
- 354 photo records
- 263 specimens with at least one photo
- 270 specimens assigned to **Jane Freese Collection**
- 150 specimens assigned to **Eric Page Collection**
- 377 classified as **Minerals**
- 43 classified as **Geodes & Agates**

Catalog numbers remain `M-001` through `M-420`. Moving a record into **Geodes & Agates** does not change its identifier.

## Classification rule used for v0.1

A record is assigned to **Geodes & Agates** when either:

1. `ROCK/ MINERAL` is exactly `Rock (Agate)`, or
2. the specimen name explicitly contains `geode`.

Everything else remains in **Minerals**. This is intentionally conservative and can be corrected record by record without changing the schema.

## Important design choices

- Photos are stored as separate records, not as columns on specimens.
- Image files are not embedded in SQLite. Each photo record contains a future storage key such as `specimens/M-001/001.jpg`.
- Historical labels, newspaper articles, research papers, correspondence, maps, and family photographs use the `documents` table.
- A document can link to multiple specimens through `specimen_documents`.
- Display locations use their own table and support parent/child organization.
- Tags and references use many-to-many relationships.
- `story` is optional. No specimen requires narrative text.
- The CSV column `Original Note` is intentionally not imported.
- Change history is supported through `specimen_change_log`.

## Rebuild command

```bash
python scripts/build_database.py \
  --catalog data/mineral_catalog.csv \
  --manifest data/photo_manifest.csv \
  --schema database/schema.sql \
  --output database/legacy_in_stone.sqlite
```

## Suggested GitHub location

Copy this folder into the repository root, or merge its contents into an existing structure:

```text
legacy-in-stone/
  database/
  scripts/
  data/
  docs/
```

Do not commit the four full-resolution photo archives to ordinary Git history. The manifest is sufficient for development; the images can later be uploaded to application storage.
