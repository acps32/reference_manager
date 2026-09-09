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

- [ ] Zoomable/pannable grid canvas
- [ ] Image import with editable coordinates (position, scale)
- [ ] Basic transformations via menu (translation, scaling) — applied as metadata, never on the source file
- [ ] Multi-selection (with grouped transformation)
- [ ] Dynamic image loading based on viewport (server-side filtering)

Out of scope for this version: horizontal/vertical flip, Obsidian plugin, visual similarity search, multi-user support.

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

## Tech stack

- **Backend**: Python, FastAPI, SQLAlchemy, SQLite
- **Frontend**: HTML, CSS, JavaScript/TypeScript, Canvas 2D (no framework for the MVP)
- **Image processing**: Pillow (multi-resolution thumbnail generation)

## Development order

1. Isolated proof of concept: image upload, disk storage (UUID-renamed copy), minimal persistence, serving route — Pillow/thumbnails deferred until there's a concrete performance need
2. Data model (positions, dimensions, file paths)
3. Canvas: grid, zoom, pan (no images yet)
4. Image import and simple display (database persistence)
5. Multi-selection and transformations (translation, scaling)
6. Dynamic viewport-based loading (backend filtering)

## Status

In development — project started September 9, 2026, deadline September 25, 2026.