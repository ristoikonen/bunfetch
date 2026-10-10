import { createClient } from "@libsql/client";
import {
  handleGoogleSession,
  handleGoogleSignIn,
  handleGoogleSignOut,
} from "./src/services/verify";

const port = Number(process.env.PORT || Bun.env.PORT || 3000);
const host = process.env.NODE_ENV === "production" ? "0.0.0.0" : (Bun.env.HOST || "127.0.0.1");
const databaseUrl = Bun.env.TURSO_DATABASE_URL;
const db = databaseUrl
  ? createClient({
      url: databaseUrl,
      authToken: Bun.env.TURSO_AUTH_TOKEN,
    })
  : null;

const server = Bun.serve({
  hostname: host,
  port,
  routes: {
    "/api/auth/config": {
      GET: () => {
        const clientId = Bun.env.GOOGLE_CLIENT_ID?.trim();
        if (!clientId) {
          return Response.json(
            { error: "Google sign-in is not configured." },
            { status: 503 },
          );
        }
        return Response.json({ clientId });
      },
    },
    "/api/auth/google": {
      POST: (req) => handleGoogleSignIn(req),
    },
    "/api/auth/session": {
      GET: (req) => handleGoogleSession(req),
    },
    "/api/auth/signout": {
      POST: () => handleGoogleSignOut(),
    },
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
  // This handles all page traffic that isn't caught by the '/api/...' definitions above
  async fetch(req) {
    const url = new URL(req.url);

    // 1. Core Session Check: Inspect headers for your existing authentication tokens
    const cookieHeader = req.headers.get("Cookie") || "";
    const hasActiveSession = cookieHeader.includes("session_token"); // Adjust string match to match your verify utility cookie key

    // 2. Default Root Path Handling
    if (url.pathname === "/") {
      if (hasActiveSession) {
        // Logged-in users skip authentication and land straight onto your application workspace
        return new Response(null, {
          status: 302,
          headers: { "Location": "/index.html" },
        });
      } else {
        // Force unauthenticated browser traffic directly to the signin route
        return new Response(null, {
          status: 302,
          headers: { "Location": "/signin.html" },
        });
      }
    }

    // 3. Serve your local frontend static web views safely out of your build/public directory
    if (url.pathname === "/signin.html" || url.pathname === "/index.html") {
      const file = Bun.file(`./public${url.pathname}`);
      if (await file.exists()) {
        return new Response(file);
      }
    }

    return new Response(JSON.stringify({ error: "Not Found" }), { 
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  },
});

console.log(`bunfetch running at http://localhost:${port}`);
