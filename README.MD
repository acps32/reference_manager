# Reference Manager

An **open source** and **local** visual reference management tool, for artists, animators, designers and developers who need to gather, organize and browse large numbers of images (poses, character design, anatomy, inspiration, concept art, front-end visual benchmarks, etc.).

Final training project (Full Stack Python Developer program).

## Pitch

Display as many images as possible on a 2D canvas without slowdown, even at large scale.

The real technical challenge isn't displaying images on a canvas, it's doing so performantly once their number grows large.

## Positioning

The market leader for this type of tool is **PureRef**, proprietary and closed source.

This project differentiates itself on three axes:

- **Open source**: auditable and modifiable code
- **Local**: no data sent to a third-party server
- **Extensible**: future potential to integrate into an existing ecosystem (e.g. an Obsidian plugin, out of scope for now)

## MVP features

- [x] Zoomable/pannable grid canvas
- [x] Image import with editable coordinates (position, scale)
- [x] Basic transformations (translation, scaling, horizontal/vertical flip) — applied as metadata, never on the source file
- [x] Multi-selection (shift-click and marquee), with grouped move and resize
- [ ] **Dynamic image loading based on viewport (server-side filtering)** — the remaining piece

Also implemented along the way: text elements (inline editing, word wrapping), undo/redo, reversible delete, snapping, and an in-app help panel documenting shortcuts, known limitations and planned features.

Out of scope for this version: Obsidian plugin, visual similarity search, multi-user support. Groups are fully specified but not implemented — see `docs/Backlog.md`.

## Architecture

```
Frontend (HTML/CSS/JS-TS + Canvas 2D)
        │
        │  sends: current viewport (x, y, width, height, zoom)
        ▼
Backend (FastAPI)
        │
        │  filters in the database which images fall within that area
        ▼
        SQLAlchemy
        │
        ▼
      SQLite
```

The frontend stays a simple executor. All spatial filtering logic lives on the server.

## Design constraint: API-first backend

The backend never renders HTML (no server-side templating). It only exposes a JSON API.

The frontend is a fully standalone set of static files (HTML/CSS/JS) that talks to the API exclusively through `fetch()`.

This is a deliberate choice: keeping frontend and backend strictly decoupled means the same frontend code could later be dropped into an Obsidian plugin view (an Electron desktop app with Node.js access can spawn the Python backend as a child process and talk to it over localhost), without rewriting the UI. Not part of this project's scope, but the architecture is kept compatible with it at no extra cost.

## Tech stack

- **Backend**: Python, FastAPI, SQLAlchemy, SQLite
- **Frontend**: HTML, CSS, JavaScript/TypeScript, Canvas 2D (no framework for the MVP)
- **Image processing**: Pillow (multi-resolution thumbnail generation)

## Documentation

- [`docs/Decisions.md`](docs/Decisions.md): technical decisions and the reasoning behind each one
- [`docs/Roadmap.md`](docs/Roadmap.md): schedule, and what is done versus what remains
- [`docs/Backlog.md`](docs/Backlog.md): ticket-level backlog — done, planned, and deliberately dropped
- [`docs/Optimisations.md`](docs/Optimisations.md): scaling analysis (memory, rendering, network) and prioritisation
- [`docs/Schema.md`](docs/Schema.md): entity-relationship diagram

## Running it

```bash
source .venv/Scripts/activate     # Git Bash on Windows
cd backend
uvicorn app.main:app --reload
```

Then open `frontend/index.html` in a browser. `backend/reset.py` wipes the database and the image store, for repeatable load tests.

## Status

In development — project started September 9, 2026, deadline September 25, 2026. The canvas, import, transformations and multi-selection are functional; viewport-based loading is analysed and planned but not implemented.