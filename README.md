# Reference Manager

A local visual reference board for artists: drop images onto an infinite canvas, move and resize them freely, zoom, flip, annotate with text.

The real subject of the project is **staying fluid when the board grows large**. Every image added costs network, memory and drawing time, so the tool only loads and keeps what is near the screen.

Final project of a Full Stack Python Developer training, built in three weeks (September 2026).

> **Status: completed and frozen.** The project was presented on September 28, 2026 and is no longer developed. It stays here as a working, documented reference.

## Features

- Infinite canvas with pan and cursor-centred zoom
- Image import by button, drag and drop, or clipboard paste
- Multi-selection (click, Shift+click, marquee), grouped move, proportional resize, horizontal and vertical flip
- Text elements with in-place editing and word wrapping
- Undo / redo (including deletion), snap to grid, light and dark canvas themes
- Status bar, help panel, fit-to-content (Shift+1)
- **Viewport-based loading**: the frontend only requests and keeps the elements near the visible area

## Measured results

Measured on a generated board of 1,000 images (`backend/seed.py`), before and after each fix:

| What | Before | After |
|---|---|---|
| SQL queries to load the board | 1,001 | 1 |
| Server response time | ~630 ms | ~65 ms |
| JSON transferred for a 1000 × 1000 view | 242 KB | 3.8 KB |
| Images loaded at startup (1920 × 1080 screen) | 1,000 | 84 |
| Requests for 300 mouse moves | 300 | 1 |
| Elements kept in memory after a long jump | 135 | 1 |

The full analysis, including what was identified but deliberately not built (image thumbnails / LOD, spatial index…), is in [`docs/Optimisations.md`](docs/Optimisations.md).

## Architecture

```
Browser: index.html + 17 scripts, everything drawn in one <canvas>
        │  fetch, JSON only (plus the image files)
        ▼
FastAPI ── SQLAlchemy 2.0 ── SQLite (database.db)
        └─ storage/images/ (imported files, copied and renamed with a UUID)
```

- The backend never renders HTML: the frontend is a standalone set of static files, and `api.js` is the only file that knows a server exists.
- Elements use joined-table inheritance: `Element` holds position and size, `Image` and `Texte` add their own fields.
- The same overlap test filters elements in SQL on the server and in JavaScript on the client.

Data model: [`docs/Schema.md`](docs/Schema.md).

## Tech stack

Python 3.12, FastAPI, SQLAlchemy 2.0, SQLite, Pillow. Vanilla JavaScript and the Canvas 2D API, no frontend framework.

## Running it

From the repository root (Git Bash on Windows shown here):

```bash
python -m venv .venv
source .venv/Scripts/activate        # macOS / Linux: source .venv/bin/activate
pip install -r backend/requirements.txt

cd backend
python -m uvicorn app.main:app
```

Then open `frontend/index.html` directly in a browser (not through a live-reload server: every database write would reload the page).

## Testing tools

All from `backend/`, with the server running:

- `python seed.py 1000`: generates 1,000 numbered test images in a regular grid, so the expected number of elements in any view can be computed in advance.
- `python reset.py`: empties the database and the image folder.
- `node ../tools/load-harness.js`: replays the frontend scripts in their real order with a stubbed DOM, then checks viewport loading against the real backend.

## Presentation

The defence slides were shown inside the tool itself, as images placed on the board. Their source is [`docs/slides/slides.html`](docs/slides/slides.html) (French): open it in a browser to see all slides, or add `#3` to the URL to view one.
