# 💰 Money Record

A personal finance + homework tracker built as an installable Progressive Web App (PWA) — a single-file vanilla JavaScript front end backed by Supabase, with full offline support.

## Overview

Money Record started as an expense tracker and grew into a small personal dashboard with four sections: **Transactions**, **Homework**, **Charts**, and **Goals**. It's built with no framework and no build step — one `index.html` file holds all the markup, styles, and logic — and it keeps working even without an internet connection thanks to a service worker and a local sync queue.

## Features

### 🧾 Transactions
- Add income/expense entries with category, amount, description, and date
- Default categories for income and expense, plus your own custom categories
- Quick-amount buttons (+1 / +2 / +5 / +10 / +50) for fast entry
- Recurring transactions (daily/weekly/monthly) that auto-generate and queue offline
- Optional receipt photo attached to any transaction — compressed in the browser, then uploaded to Supabase Storage
- Swipe-to-delete on transaction cards
- Search by description/category, and filter by All / Income / Expense / Recurring / Pending
- Month navigation with a "Today" shortcut and an "All time" view
- Balance card with this month's balance, a savings-rate indicator, a month-over-month comparison, and an end-of-month forecast
- CSV export, and CSV import (`Date, Type, Category, Description, Amount`)
- Pagination (100 per page) with a "Load older" button

### 📚 Homework
- Quick-add with compound subject shortcut chips (Math Lecture, Math Tutorial, Chem Lecture, Chem Tutorial, Physics Lecture/Tutorial, CS Lecture/Tutorial, Kulliah) that also pre-fill and focus the title field
- Quick due-date chips (Today / Tomorrow / In 2 Days / Next Week)
- Press Enter in Title or Subject to submit instantly
- Apple Notes–style circular checkbox to mark items done
- Filters: Today / Upcoming / Done / All

### 📊 Charts
- Spending breakdown by category (pie chart) and over time (bar chart)
- Chart.js is loaded lazily — only fetched the first time the Charts tab is opened, to keep initial load fast

### 🏦 Goals
- Create savings goals with an emoji, name, and target amount
- Track progress and add contributions toward each goal

### Offline & PWA
- Installable on mobile and desktop (`manifest.json` + service worker)
- Works offline: cache-first for the app shell (HTML, manifest, CDN libraries), network-first for Supabase API calls
- Transactions made while offline are queued locally and synced automatically once the connection returns
- Dark mode that respects the device's system preference on first visit, with a manual override toggle
- Built with accessibility in mind: ARIA roles/labels, live regions for toast notifications, focus handling on modals

### Settings & Data
- First-run setup screen to connect your own Supabase project (URL + anon key) — credentials are stored only in the browser's `localStorage`, never hardcoded in the source
- Manage custom categories from the Settings panel
- Full settings backup/restore as JSON (categories, goals, recurring templates)
- Reset or reconnect Supabase credentials at any time

## Tech Stack

| Layer | Choice |
|---|---|
| Front end | Vanilla HTML, CSS, JavaScript — no framework, no build step |
| Backend | Supabase (Postgres + Storage), called directly from the browser |
| Charts | Chart.js 4 (via CDN, lazy-loaded) |
| Offline / installability | Service Worker + Web App Manifest |
| Local persistence | `localStorage` for settings, recurring templates, a goals cache, and the offline transaction queue |

## How It Works

- **No build tooling.** `index.html` is the entire app — markup, `<style>`, and `<script>` all in one file — so it runs by opening it directly or hosting it as a static file.
- **Backend-as-a-service.** Instead of writing a server, the app talks to Supabase directly with the public anon key. Row Level Security (RLS) policies on each table control what that key is allowed to do.
- **Offline-first transactions.** If you're offline, a new transaction is stored in a local queue and shown immediately as "pending." When the app detects you're back online, it replays the queue against Supabase automatically.
- **Service worker caching strategy.** Static assets (app shell, manifest, CDN scripts) are served cache-first for instant loads; everything else (Supabase API calls) is network-first, so data is always fresh when online and only falls back to cache if the network request fails.

## Project Structure

```
money-record/
├── index.html      # the entire app: markup + CSS + JavaScript
├── sw.js           # service worker — caching & offline strategy
├── manifest.json   # PWA manifest — icons, name, theme colors
├── icon-192.png    # app icon
└── icon-512.png    # app icon
```

## Getting Started

1. **Create a Supabase project** at [supabase.com](https://supabase.com) (the free tier is enough).
2. **Set up the database** — create the tables the app expects (`transactions`, `homework`), enable Row Level Security, and add a public Storage bucket for receipt photos.
3. **Serve the app locally.** Service workers require `http://`/`https://`, not `file://`, so use any static server, for example:
   ```bash
   python3 -m http.server 8000
   ```
   then open `http://localhost:8000`.
4. **Connect Supabase.** On first load, the app shows a setup screen — enter your project URL and anon public key (Supabase → Project Settings → API). These are saved locally on your device only, never sent anywhere else.
5. **(Optional) Install it.** Most browsers offer an "Install" prompt once the manifest and service worker are detected, adding it as a standalone app icon.

## Notes on Security & Privacy

- The Supabase anon key is designed to be used client-side, but it's only as safe as the RLS policies behind it. This project's policies are intentionally permissive (anyone with the URL + key can read/write), which is appropriate for a single-user personal project but **not** suitable for a multi-user or public deployment without adding proper authentication.
- No credentials are hardcoded anywhere in the source — they're entered once through the setup screen and stored in the browser's `localStorage`.

## Possible Future Improvements

- Real user authentication (Supabase Auth) if this ever needs to support more than one person
- Per-category budgets with alerts when you're close to a limit
- Push notifications for upcoming homework due dates
- Printable/exportable monthly summary reports

## Authors

- Claude
- Matthias — S2K3T3

Built as a personal project to track everyday expenses and homework in one place.
