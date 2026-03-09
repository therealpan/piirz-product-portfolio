# PROJECT_STATE — PiirZ Product Portfolio

## Current Architecture
- **Single-page static site** hosted on GitHub Pages
- **1 main file**: `index.html` (1490 lines) — all HTML, CSS, JS in one self-contained file
- **38 products** hardcoded as HTML `<div class="card">` elements with `data-tags` and `data-key` attributes
- **i18n system**: `LANGS` JS object with 5 languages (IT, EN, FR, DE, ES), ~120 keys per language
- **Product data**: split between HTML (name, icon, tags) and JS `LANGS` object (descriptions, translated names, categories)
- **12 products** have i18n-translated names via `data-i18n`; 26 have hardcoded names
- **Filters**: category (6), sector (6), technology (9) — all client-side via `data-tags`
- **Search**: autocomplete built from card names + tags
- **Email CTA**: per-card mailto link with i18n subject, plus global CTA banner
- **Assets**: favicon.ico, icon.png (96px), icon-192.png, apple-touch-icon.png

## Completed Components
- [x] Multilingual portfolio with 5 languages
- [x] Interactive filters (category, sector, technology)
- [x] Live search with autocomplete
- [x] Per-card email contact link with i18n
- [x] Favicon and SEO/OG metadata
- [x] GitHub Pages deployment

## Planned: Flat-File Database Migration
See implementation plan (pending approval)

## Known Issues
- `piirz_portfolio.html` (1.2MB) appears to be an older/alternative version — relationship unclear
- Product data is duplicated: structure in HTML, content in LANGS JS object

## Lessons Learned
- `icon.png` was a JPEG mislabeled as PNG — always verify file format with `file` command
- Cards with `data-i18n` names have empty textContent at JS init time — read from DOM after applyLang
- Git lock files can persist in sandboxed environments — clean before every commit
