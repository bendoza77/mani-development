# Project order and gallery slider (design)

Approved in conversation on 2026-11-26. Small change: short design.

## Why

The company wants to choose which projects come first on the website, and a project page with many photos shows them all at once in one long grid.

## Goals

1. **Manual project order.** The admin sets each project's place with a number (1, 2, 3…). Typing a number moves the project to that place and the others shift.
2. **Gallery slider.** The project page shows one large photo, a row of thumbnails below it, and previous/next arrows (swipe on phones). Clicking the large photo opens the existing full-screen view.

## Non-goals

- Drag-and-drop ordering (numbers were asked for).
- Changing the gallery order editor in the project form (it already orders photos).

## Decisions

- **Data:** a `position` integer on `Project` (default 0, indexed). The migration numbers existing projects in their current public order: houses first, then newest. A new project goes to the end (max + 1).
- **API:** `PUT /api/admin/projects/order` with `{ ids: uuid[] }`, the full list of project ids in the new order. The server rejects a list that does not hold every project exactly once (400) and writes positions 0..n-1 in one transaction. The admin list and the public list both sort by `position` and then by `updatedAt desc`.
- **Public order:** the Projects page uses the server order (it drops "houses first, newest first"). On the homepage, starred projects still come first, each group in the manual order.
- **Admin list:** a "#" column with a number input, shown only on the All tab with no search, category filter or column sort. On a filtered or sorted list, a "Show order" link resets the view. Typing a number and pressing Enter or leaving the box (blur) moves the row, saves the order, and rolls back with a toast if the save fails.
- **Gallery:** the `Gallery` component is rebuilt as a large slide (16:10), arrows, a counter, and a scrollable thumbnail strip. The active thumbnail is outlined and scrolled into view. Arrow keys work when the slider has focus, and swipe works on touch. The full-screen dialog stays.

## Approaches considered

- Number inputs (chosen): matches the request ("like number system"), works with a keyboard, and is simple.
- Drag-and-drop: nicer with a mouse, but needs a library and extra accessibility work.
- Up/down arrows only: slow when there are many projects.
