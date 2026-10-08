# bunfetch

Local React/shadcn dashboard for `glow_logs` in Turso. A Bun API returns all
rows, ordered by activity time with future-dated rows first. The UI can filter
the list by user email.

Create a local `.env` file with the Turso credentials (never commit it):

```dotenv
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token
```

Start the API and Vite UI in separate terminals:

```sh
bun run api
bun run dev
```

Open <http://localhost:5173>. The Vite development proxy forwards `/api/*` to
the Bun API on port 3000, so Turso credentials remain server-side. The API
binds to `127.0.0.1` by default; set `HOST` explicitly if you intend to expose
it to another device.

The dashboard reads `id`, `user_email`, `locale`, and `created_at` from
`glow_logs`.
