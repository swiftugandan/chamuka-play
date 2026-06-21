# Chamuka Play — Progressive Web App (PWA)

**Date:** 2026-06-21
**Status:** Approved design, ready for implementation plan

## Goal

Make Chamuka Play installable to a device home screen and playable offline,
so a child can launch it like a native app (no browser chrome) and play their
already-made games with no network connection. This leans into the app's
**local-first** architecture: games live in IndexedDB; only AI generation needs
the server.

## Scope

**In scope**

- Web app manifest (installable, standalone display, brand colors).
- App icons (192, 512, maskable 512, Apple touch 180) generated from the
  existing Mishi mascot SVG on the app's cream background.
- A hand-rolled service worker that caches the app shell so launching and
  playing saved games works offline.
- Offline-aware copy: when a child tries to make/change a game while offline,
  show a warm "you can still play your saved games" message instead of a
  generic error.

**Explicitly out of scope (YAGNI)**

- Web push notifications.
- A custom in-app "Install" button/banner — rely on the browser's native
  install prompt (Android/Chromium auto-prompts once criteria are met; iOS uses
  Share → Add to Home Screen).
- An "update available, tap to refresh" flow / offline indicator (the silent
  update model is sufficient for v1).

## Approach decision

Use a **hand-rolled `public/sw.js`**, not Serwist or `next-pwa`. The Next.js PWA
guide notes Serwist "currently requires webpack configuration," and this project
runs **Turbopack** (`turbopack.root` is pinned in `next.config.ts`). Forcing a
webpack config solely for a service worker would be a structural regression and
add a heavy dependency to an otherwise lean, local-first app. A small, readable
service worker matches the codebase ethos and is easy to reason about.

## Components

### 1. Web app manifest — `src/app/manifest.ts`

Next.js 16 app-router file convention (`MetadataRoute.Manifest`). It is
auto-linked into `<head>` — no manual `<link rel="manifest">`.

| Field | Value |
|---|---|
| `name` | `Chamuka Play` |
| `short_name` | `Chamuka` |
| `description` | kid-friendly one-liner (matches site metadata) |
| `start_url` | `/` |
| `display` | `standalone` |
| `theme_color` | `#7a3cf0` (grape — matches `viewport.themeColor`) |
| `background_color` | `#fbf3ff` (cream / `--color-cloud` — splash + icon bg) |
| `categories` | `["games", "education"]` |
| `icons` | 192 (`any`), 512 (`any`), 512 (`maskable`) |

### 2. Icons — `public/` + `scripts/generate-icons.mjs`

A committed Node script rasterizes the Mishi SVG via `sharp` (already a
dependency) onto the cream background and writes:

- `public/icon-192.png` (192×192, purpose `any`)
- `public/icon-512.png` (512×512, purpose `any`)
- `public/icon-maskable-512.png` (512×512, extra safe-zone padding for Android
  circle/squircle masks — mascot occupies ~60% of the canvas)
- `public/apple-icon-180.png` (180×180, Apple touch icon)

The script re-derives the Mishi artwork as a standalone SVG string (the same
paths/colors as `Mascot.tsx`, `mood: "happy"`). PNGs are **committed** so
production builds need no generation step; the script exists for reproducibility
and is runnable via `node scripts/generate-icons.mjs`.

Apple touch icon and iOS standalone behavior are wired through Next metadata in
`layout.tsx`:

```ts
export const metadata: Metadata = {
  // ...existing
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Chamuka" },
  icons: { apple: "/apple-icon-180.png" },
};
```

### 3. Service worker — `public/sw.js`

Minimal, versioned, app-shell offline. Plain JS (no build step).

- **Cache name** carries a version string (e.g. `chamuka-v1`); bump to
  invalidate.
- **`install`**: pre-cache the app shell entry (`/`) and call `skipWaiting()`.
- **`activate`**: delete caches whose name ≠ current version; `clients.claim()`.
- **`fetch`** routing (same-origin only; cross-origin requests pass through):
  - `mode === "navigate"` → **network-first**, fall back to cached `/` shell
    when offline.
  - `/_next/static/*` (immutable, content-hashed) → **cache-first**.
  - `/api/*` → **network-only** (never cache AI responses).
  - other same-origin GETs (icons, manifest, favicon) → **cache-first** with
    network fallback.
- Only `GET` requests are cached; non-GET pass through to network.

Self-hosted fonts (`next/font`) live under `/_next/static`, so they are covered
by the static cache-first rule — no cross-origin font handling needed.

### 4. Service worker registration — `src/components/ServiceWorkerRegister.tsx`

Tiny client component (`"use client"`), renders `null`, registers the SW on
mount:

- No-op when `"serviceWorker"` is not in `navigator`.
- No-op in development (`process.env.NODE_ENV !== "production"`) to avoid
  fighting Turbopack HMR and stale caches during dev.
- Registers `/sw.js` with `scope: "/"`.

Mounted once in `layout.tsx` (a server component can render a client child).

### 5. Service worker security headers — `next.config.ts`

Add `headers()` returning, for `source: "/sw.js"`:

- `Content-Type: application/javascript; charset=utf-8`
- `Cache-Control: no-cache, no-store, must-revalidate`
- `Content-Security-Policy: default-src 'self'; script-src 'self'`

(Per the Next.js PWA guide. Global security headers like `X-Frame-Options` are
out of scope here — the generated games already render in a sandboxed iframe,
and broad header changes are unrelated to this task.)

### 6. Offline-aware copy — `src/lib/net/networkErrorNotice.ts`

A pure helper so both entry points share one message and it stays testable:

```ts
export function networkErrorNotice(online: boolean): string {
  return online
    ? "Something went wrong. Try again!"
    : "You're offline — but you can still play your saved games! 🎮";
}
```

- `Shell.makeGame` catch → `setError(networkErrorNotice(navigator.onLine))`.
- `PlayView.changeIt` catch (and the `!res.ok` path) → uses it for the error
  notice. The existing `NOTICES.error` constant is replaced by this call at the
  catch sites; `NOTICES.unsafe` / `NOTICES.failed` are unchanged (those are not
  network failures).

This keeps the refine "couldn't apply" teaching message intact and only changes
the genuine network-failure path.

## Data flow

Nothing changes in the generate/refine/storage flows. The service worker sits
between the browser and network for static assets and navigations only; it never
touches IndexedDB (Dexie) or the AI API responses. Offline, navigations resolve
from the cached shell, the React app boots, Dexie reads saved games from
IndexedDB, and `PlayView` renders them — fully playable. Attempting to generate
or refine offline fails fast and shows the friendly offline notice.

## Error handling

- SW registration failure is swallowed (best-effort; the app works without it).
- Offline generation/refine: friendly notice (component 6); no crash.
- Old caches removed on activate, so a version bump cleanly replaces stale
  assets.

## Testing

- `src/app/manifest.test.ts` — calls the manifest function, asserts `name`,
  `display === "standalone"`, `theme_color`, `background_color`, and that the
  icon set includes 192, 512, and a maskable entry.
- `src/lib/net/networkErrorNotice.test.ts` — asserts both branches.
- `src/components/ServiceWorkerRegister.test.tsx` — asserts it renders null and
  that `register` is not called when unsupported / in dev (guard logic).
- **Manual verification (called out honestly):** the service worker runtime
  (Cache Storage, offline reload, install-to-home-screen) cannot be exercised in
  jsdom. Verified in a real browser: production build, Application → Manifest +
  Service Worker, then DevTools "Offline" + reload to confirm the shell loads
  and a saved game plays. Lighthouse "Installable" check.

## Verification gate

`npm run lint && npx tsc --noEmit && npm run test && npm run build` must pass,
plus the manual browser checks above.
