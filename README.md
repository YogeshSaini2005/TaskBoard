# Taskboard — Trello-style project management

Boards → lists → cards, drag-and-drop (within and between lists), persistent data, and **role-based access** (owner / member / viewer) as the bonus feature.

**Live:** https://taskboard-omega-rouge.vercel.app  · **Stack:** vanilla HTML/CSS/JS, no build step, no dependencies.

## Features
- Multiple boards; lists and cards can be created, renamed, edited, deleted
- Card details: description, colour label, due date (overdue highlighted), assignee
- Drag-and-drop with a live drop placeholder (native HTML5 DnD), including reordering inside a list
- Search/filter cards
- Data saved in `localStorage`; also syncs across open tabs via the `storage` event
- Roles per board:
  | Role | Cards & lists | Rename/delete board | Manage members |
  |---|---|---|---|
  | owner | edit | yes | yes |
  | member | edit | no | no |
  | viewer | read-only (can open cards, cannot drag/edit) | no | no |
- "Viewing as" switcher in the header lets reviewers try each role instantly

## Run locally
Open `index.html` in a browser, or `npx serve .`

## Design notes
- State is one JSON object (`users`, `boards[].members{userId: role}`, `lists[].cards[]`).
- Every mutation function checks the role (`guard(...)`), not just the UI, so hiding buttons isn't the only protection.
- All user text is HTML-escaped before rendering (XSS-safe).
- The board must always keep at least one owner.

## Known limitations / what I'd improve
- Roles are enforced client-side only: with no backend there is no real authentication, so a user could edit localStorage. Next step: Supabase/Firebase auth + row-level security so roles are enforced on the server.
- Data is per-browser; a real DB would give shared boards and real-time collaboration.
- Add list reordering by drag, card comments/activity log, touch-device drag support, keyboard-accessible moves, and an AI board summary.
- Add automated tests (Playwright for drag-and-drop, unit tests for the permission logic).
