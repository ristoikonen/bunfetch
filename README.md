# bunfetch

Local React/shadcn dashboard for `glow_logs` in Turso. A Bun API returns all
rows, ordered by activity time with future-dated rows first. The UI can filter
the list by user email.

The `/glow2` page recreates the IGlowData payload form with shadcn components,
locale presets, editable 24-hour time, live JSON preview, clipboard copy, and
submission status. It sends `POST /api/glow` to insert the payload into
`glow_logs`; the browser's anonymous ID is stored in local storage.

Create a local `.env` file with the Turso credentials (never commit it):

```ts
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token
GOOGLE_CLIENT_ID=your-google-oauth-client-id
```

Google sign-in is optional and available at <http://localhost:5173/signin.html>.
Create a Google OAuth web client and add the app's origin (for local
development, `http://localhost:5173`) to its authorized JavaScript origins.
The sign-in page uses Google Identity Services and the Bun API verifies its ID
credential. It sets an HttpOnly session cookie, but signing in does not gate
the dashboard, Glow form, or their APIs.

Start the API and Vite UI in separate terminals:

```sh
bun run api
bun run dev
```

Open <http://localhost:5173> for activity, or <http://localhost:5173/glow2>
for the payload form. The Vite development proxy forwards `/api/*` to the Bun
API on port 3000, so Turso credentials remain server-side. The API
binds to `127.0.0.1` by default; set `HOST` explicitly if you intend to expose
it to another device.

The dashboard reads `id`, `user_email`, `locale`, and `created_at` from
`glow_logs`.
