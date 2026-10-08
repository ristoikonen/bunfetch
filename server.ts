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
    "/api/glow": {
      POST: async (req) => {
        if (!db) {
          return Response.json(
            { error: "Turso is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN." },
            { status: 503 },
          );
        }

        let body: unknown;
        try {
          body = await req.json();
        } catch {
          return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
        }

        if (typeof body !== "object" || body === null) {
          return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
        }

        const payload = body as Record<string, unknown>;
        const { message, locale, timestamp, user_email, anonymous_id, created_at } = payload;
        if (typeof message !== "string" || !message.trim() || message.length > 2000) {
          return Response.json({ error: "Message is required and must be at most 2000 characters." }, { status: 400 });
        }
        if (typeof locale !== "string" || !locale.trim() || locale.length > 100) {
          return Response.json({ error: "Locale is required and must be at most 100 characters." }, { status: 400 });
        }
        if (
          typeof timestamp !== "string" ||
          !/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(timestamp)
        ) {
          return Response.json({ error: "Timestamp must use HH:MM:SS (24-hour time)." }, { status: 400 });
        }
        if (typeof user_email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user_email)) {
          return Response.json({ error: "A valid user email is required." }, { status: 400 });
        }
        if (typeof anonymous_id !== "string" || !anonymous_id.trim() || anonymous_id.length > 200) {
          return Response.json({ error: "A valid anonymous ID is required." }, { status: 400 });
        }
        if (
          typeof created_at !== "string" ||
          Number.isNaN(Date.parse(created_at))
        ) {
          return Response.json({ error: "A valid event date is required." }, { status: 400 });
        }

        try {
          const result = await db.execute({
            sql: `INSERT INTO glow_logs (message, locale, timestamp, user_email, created_at, anonymous_id)
                  VALUES (?, ?, ?, ?, ?, ?)`,
            args: [
              message.trim(),
              locale.trim(),
              timestamp,
              user_email.trim(),
              created_at,
              anonymous_id,
            ],
          });
          return Response.json(
            { success: true, message: `${result.rowsAffected} row(s) inserted` },
            { status: 201 },
          );
        } catch (error) {
          console.error("Failed to insert Glow log into Turso.", error);
          return Response.json({ error: "Could not save Glow log." }, { status: 500 });
        }
      },
    },
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
            SELECT id, message, user_email, locale, created_at AS last_seen
            FROM glow_logs
            ORDER BY created_at DESC, id DESC
          `);

          return Response.json({
            logs: result.rows.map((row) => ({
              id: Number(row.id),
              message: String(row.message ?? ""),
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
