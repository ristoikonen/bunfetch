# bunfetch

Local React/shadcn dashboard for `glow_logs` in Turso. A Bun API returns all
rows, ordered by activity time with future-dated rows first. The UI can filter
the list by user email.

The `/glow2` page recreates the IGlowData payload form with shadcn components,
locale presets, editable 24-hour time, live JSON preview, clipboard copy, and
submission status. It sends `POST /api/glow` to insert the payload into
`glow_logs`; the browser's anonymous ID is stored in local storage.

