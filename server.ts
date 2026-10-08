import { createClient } from "@libsql/client";

const port = Number(Bun.env.PORT ?? 3000);
const databaseUrl = Bun.env.TURSO_DATABASE_URL;
const db = databaseUrl
  ? createClient({
      url: databaseUrl,
      authToken: Bun.env.TURSO_AUTH_TOKEN,
    })
  : null;

const server = Bun.serve({
  hostname: Bun.env.HOST ?? "127.0.0.1",
  port,
  routes: {
    "/api/glow/logs": {
      GET: async () => {
        if (!db) {
          return Response.json(
            { error: "Turso is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN." },
            { status: 503 },
          );
        }

        try {
          const result = await db.execute(`
            SELECT id, user_email, locale, created_at AS last_seen
            FROM glow_logs
            ORDER BY created_at DESC, id DESC
          `);

          return Response.json({
            logs: result.rows.map((row) => ({
              id: Number(row.id),
              userEmail: String(row.user_email ?? ""),
              locale: String(row.locale ?? ""),
              lastSeen: row.last_seen == null ? null : String(row.last_seen),
            })),
          });
        } catch (error) {
          console.error("Failed to query glow_logs from Turso.", error);
          return Response.json(
            { error: "Could not load Glow users." },
            { status: 500 },
          );
        }
      },
    },
  },
  fetch() {
    return Response.json({ error: "Not Found" }, { status: 404 });
  },
});

console.log(`bunfetch running at http://localhost:${port}`);
