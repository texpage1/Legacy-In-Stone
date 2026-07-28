# Legacy in Stone v0.6 — Cross-Platform Application Build

This package converts the approved v0.55.1 interface into a deployable Progressive Web App while preserving the collection, photographs, articles, and About page.

## What works now

- All 594 specimen records and existing media from v0.55.1
- Editing and adding specimen records on the current device
- Permanent local saving of photographs, camera images, labels, articles, and other documents using IndexedDB
- CSV catalog export
- Full JSON application backup, including locally added attachments
- Progressive Web App manifest and offline service worker
- Install prompts on supported hosted browsers
- Private-cloud sign-in and synchronization adapter
- Supabase database/storage schema with owner-only security policies

## Important deployment distinction

The app can be previewed locally, but cross-device synchronization requires a private Supabase project and HTTPS hosting. The files in `supabase/schema.sql` and `cloud-config.js` are prepared for that deployment step. Until connected, each device keeps its own local edits and attachments.

## Preview

Open `OPEN_LEGACY_IN_STONE_PREVIEW.html` or `index.html` in Edge. The collection browser and local saving work. Service-worker installation is only available when hosted over HTTPS or localhost.

## Deployment package

Upload the contents of this folder to a static host. Then:

1. Create a private Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Create the owner account in Supabase Authentication.
4. Put the project URL and anonymous public key into `cloud-config.js` and set `enabled: true`.
5. Deploy the updated folder over HTTPS.
6. Sign in from Settings & Backup, synchronize the catalog, and install the app on each device.

## Backup strategy

- **Export CSV**: portable catalog table.
- **Export Full Backup**: local edits, added records, and locally stored attachments.
- **Cloud synchronization**: shared working copy across devices after deployment.
- **GitHub/static host**: application code and bundled historical media.
