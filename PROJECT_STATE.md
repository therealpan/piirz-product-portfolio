# PROJECT_STATE — PiirZ Product Portfolio

## Current Architecture
- **Data-driven static site** hosted on GitHub Pages
- **`index.html`** (~780 lines) — fetches `data/products.json` and renders cards dynamically
- **`data/products.json`** (93KB) — flat-file database with 38 products, 5 languages, UI translations
- **`admin/index.html`** — full admin SPA for product CRUD (General, Details, Attachments tabs)
- **`worker/`** — Cloudflare Worker API (auth, CRUD, file upload to R2, event logging to KV)
- **i18n system**: 5 languages (IT, EN, FR, DE, ES) from `products.json` `ui` section
- **Filters**: category (7), sector (8), technology (8) — all client-side from `data-tags`
- **Search**: autocomplete built from card names + tags
- **Modal**: product detail overlay with description, rich HTML details, attachments
- **Email CTA**: per-card mailto link with i18n subject, plus global CTA banner
- **Event logging**: `navigator.sendBeacon()` to Worker API (when configured)

## Product Data Structure
```json
{
  "meta": { "version": 1, "lastModified": "...", "languages": [...] },
  "ui": { "it": {...}, "en": {...}, ... },
  "products": [{
    "key": "swarmOS",
    "icon": "fa-solid fa-hexagon-nodes",
    "iconColor": "orange",
    "tags": ["piattaforma","enterprise",...],
    "techTags": ["Agenti AI","LLM",...],
    "section": "existing|capabilities",
    "name": { "it": "...", "en": "...", ... },
    "category": { "it": "...", "en": "...", ... },
    "description": { "it": "...", "en": "...", ... },
    "details": { "it": { "html": "", "links": [], "images": [] }, ... },
    "attachments": []
  }]
}
```

## Completed Components
- [x] Multilingual portfolio with 5 languages
- [x] Interactive filters (category, sector, technology)
- [x] Live search with autocomplete
- [x] Per-card email contact link with i18n
- [x] Favicon and SEO/OG metadata
- [x] GitHub Pages deployment
- [x] Flat-file database migration (products.json)
- [x] Data-driven card rendering from JSON
- [x] Product detail modal (description + details + attachments)
- [x] Admin panel SPA (login, product list, editor with 3 tabs)
- [x] Cloudflare Worker API code (auth, CRUD, R2 upload, KV logging)
- [x] Analytics dashboard in admin panel
- [x] Removed legacy piirz_portfolio.html

## Pending: Cloudflare Deployment
To activate the Worker API:
1. `cd worker && npx wrangler login`
2. `npx wrangler kv namespace create LOGS` → update `wrangler.toml` with real ID
3. `npx wrangler r2 bucket create piirz-attachments`
4. `npx wrangler secret put ADMIN_PASS` → set admin password
5. Upload initial `products.json` to R2: `npx wrangler r2 object put piirz-attachments/products.json --file ../data/products.json`
6. `npx wrangler deploy`
7. Set `API_BASE` in both `index.html` and `admin/index.html`

## Known Issues
- Admin panel works in "static mode" (reads products.json directly, downloads updated JSON on save) until Worker is deployed
- `icon.png` was a JPEG mislabeled as PNG — always verify file format with `file` command

## Lessons Learned
- Cards with `data-i18n` names have empty textContent at JS init time — read from DOM after applyLang
- Git lock files can persist in sandboxed environments — clean before every commit
- HTML entities (`&amp;`) from extraction must be decoded in JSON since `textContent` doesn't parse them
