# yooheyu-home

Personal homepage + private photo album, deployed on Cloudflare Workers + R2.

## Features

- **Homepage** (`/`) — animated landing page
- **Photo Album** (`/album`) — password-protected private photo album
  - Password authentication with signed session cookies
  - Photo upload with client-side thumbnail generation
  - Timeline gallery grouped by month
  - Lightbox viewer with keyboard & swipe navigation
  - Drag-and-drop & clipboard paste upload
  - Mobile responsive

## Setup

### 1. Create R2 Bucket

```bash
npx wrangler r2 bucket create yooheyu-photos
```

### 2. Set Album Password

```bash
npx wrangler secret put ALBUM_PASSWORD
```

Enter your desired password when prompted. This is the password you'll use to access the album.

### 3. Deploy

```bash
npx wrangler deploy
```

Or push to `main` to trigger the GitHub Actions workflow.

### Local Development

Create a `.dev.vars` file (gitignored) for local secrets:

```
ALBUM_PASSWORD=your-dev-password
```

Then run:

```bash
npx wrangler dev
```

## Architecture

```
Browser ──▶ Cloudflare Worker ──▶ R2 (photo storage)
               │
               ├─ /          → homepage
               ├─ /album     → photo album SPA
               ├─ /api/login → password auth
               └─ /api/*     → photo CRUD (auth required)
```

- **Zero server cost** — Cloudflare Workers free tier (100k req/day) + R2 free tier (10GB storage)
- **Privacy** — all photos stored in private R2 bucket, accessible only through authenticated API
- **No database** — photo metadata stored as R2 custom metadata
- **Thumbnails** — generated client-side during upload, stored separately in R2 for fast gallery loading
