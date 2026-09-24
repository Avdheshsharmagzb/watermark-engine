# Chronicle CMS — Product Requirements Document

## Original Problem Statement
Implement a media processing feature that automatically handles photos (and videos) attached to news items. Apply a customizable text/logo watermark to all photos before they are finalized. Ensure the watermarked media is securely stored and linked to the respective news article.

## User Choices (locked)
- Build a complete news CMS with the media/watermark feature.
- **Text watermark only** (no logo).
- Watermark **bottom-right, semi-transparent, on every photo**.
- **Photos only** — videos out of scope.
- **No authentication** — all pages/APIs open by design.

## Architecture
- **Backend**: FastAPI (`/app/backend/server.py`), MongoDB (motor). Pillow for text watermarking. Emergent Object Storage for secure media storage.
- **Frontend**: React 19 + react-router + Tailwind + shadcn/ui + sonner. Editorial "Swiss newsroom" theme (Playfair Display / Manrope / JetBrains Mono, crimson accent).
- **Storage flow**: upload → Pillow watermark (bottom-right, opacity/size/position configurable) → convert to JPEG → PUT to object storage under `chronicle-cms/articles/{articleId}/{uuid}.jpg` → DB reference (soft-delete) linked to article → served via `GET /api/files/{path}`.

## User Personas
- Editors/journalists publishing stories and attaching press photos.
- News consumers reading the feed.

## Core Requirements (static)
- Article CRUD (title, category, author, summary, body).
- Photo upload with automatic text watermark, securely stored & linked to article.
- Configurable watermark settings (text, opacity, font size, position) with live preview.
- News feed with search + category filters; article detail; media library.

## Implemented (2026-09-24)
- Backend endpoints: `/api/categories`, `/api/settings/watermark` (GET/PUT with clamping), `/api/watermark/preview` (JPEG), articles CRUD + filters, `/api/articles/{id}/photos` (watermark+store), `/api/photos`, photo delete, `/api/files/{path}` serving.
- Pillow text watermark (bottom-right default, semi-transparent, scaled to image width, shadow for legibility).
- Emergent Object Storage integration (init at startup, force-reinit retry on 404).
- Frontend: Navbar + Create Article dialog (drag-drop upload), NewsFeed, ArticleDetail (gallery + lightbox), WatermarkSettings (live server-side preview), MediaLibrary.
- Tested: 12/12 backend pytest, 100% frontend flows. No bugs found.

## Backlog (prioritized)
- P1: Logo/image watermark option; per-article watermark override.
- P1: Video support (thumbnail extraction + watermark).
- P2: Authentication (JWT/Google) if access control is later desired.
- P2: Batch aggregation for article list (remove N+1 photo queries); Mongo indexes on `photos.article_id`, `articles.is_deleted`.
- P2: Article edit UI (currently create/delete only).

## Next Tasks
- Await user feedback on the MVP; then pick from backlog.
