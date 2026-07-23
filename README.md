# Legacy in Stone Browser v0.2

This is the first usable collection browser built from the production database.

## Preview on Windows

Because browsers block local JSON loading when a page is opened directly, start a simple local server:

1. Open the `legacy-in-stone-browser` folder in File Explorer.
2. Click the address bar, type `cmd`, and press Enter.
3. Run: `python -m http.server 8000`
4. Open `http://localhost:8000` in your browser.

If Python is not installed, this folder can be opened with Visual Studio Code and the Live Server extension.

## Included

- 420 real specimen records
- 354 optimized specimen photographs
- Search and filtering
- Minerals and Geodes & Agates categories
- Jane Freese and Eric Page collection filters
- Specimen detail pages
- Collection statistics
- About the Collection placeholder
- Related-materials placeholder for labels, articles, and research

The included SQLite database remains the source of truth. `data/specimens.json` is a browser-friendly export.
