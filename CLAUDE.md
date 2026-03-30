# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

No build step required. Open `index.html` directly in any modern browser. All data is stored in localStorage.

## Project Structure

Four files, no external dependencies:

- `index.html` — HTML skeleton and tab structure
- `app.js` — All application logic (~33KB, organized as named modules)
- `data.js` — SOP task definitions and reference material content
- `styles.css` — All styling with CSS custom properties for theming

## Architecture

**app.js** is organized into self-contained manager modules:

| Module | Responsibility |
|---|---|
| `Storage` | localStorage read/write with auto-cleanup (6-month retention) |
| `ThemeManager` | Dark/light theme toggling via CSS class on `<body>` |
| `NavManager` | Tab switching between the 3 main sections |
| `SOPManager` | Daily task timeline rendering and checkbox state |
| `NotificationManager` | Browser push notification scheduling |
| `StatsManager` | Daily/monthly analytics, calendar heatmap, improvement tips |
| `ReferenceManager` | Accordion-based searchable reference content |

**data.js** contains:
- `SOP_TASKS` — Array of 13 daily task objects (time, title, details, science tags)
- `REFERENCE_DATA` — 5 sections of biohacking reference content

**Theming** uses CSS custom properties (`--bg-primary`, `--accent`, etc.) defined in `:root` and `[data-theme="light"]` selectors. The default theme is dark.

## LocalStorage Schema

- `sop_completion_YYYY-MM-DD` — JSON object `{ taskId: boolean }` per day
- `sop_theme` — `'dark'` | `'light'`
- `sop_notif_dismissed` — boolean, notification prompt dismissal
- `sop_last_reset_date` — date string for daily progress bar reset

## Key Conventions

- Chinese UI text throughout (app targets Chinese-speaking users)
- Task IDs in `SOP_TASKS` are the source of truth for storage keys
- Mobile breakpoint at 768px
- Accent color: `#f0a500` (golden)
