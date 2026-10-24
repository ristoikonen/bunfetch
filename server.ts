import { createClient } from "@libsql/client";
import { createRemoteJWKSet, jwtVerify } from 'jose';
import {
  handleGoogleSession,
  handleGoogleSignIn,
  handleGoogleSignOut,
  //extractIapUserEmail,
} from "./src/services/verify";

const port = Number(process.env.PORT || Bun.env.PORT || 3000);
const host = process.env.VITE_APP_STAGE === "production" ? "0.0.0.0" : (Bun.env.HOST || "127.0.0.1");

// Get public keys
const IAP_JWKS_URL = new URL('https://www.gstatic.com/iap/verify/public_key-jwks');
const iapJwks = createRemoteJWKSet(IAP_JWKS_URL);
const issuer = "https://cloud.google.com/iap";

const databaseUrl = Bun.env.TURSO_DATABASE_URL;
const db = databaseUrl
  ? createClient({
      url: databaseUrl,
      authToken: Bun.env.TURSO_AUTH_TOKEN,
    })
  : null;

// Get your Project Number:
// bunfetch
// gcloud projects describe 260134623986 --format="value(projectNumber)"
// Get your Backend Service ID (if using a Load Balancer):
// gcloud compute backend-services describe YOUR_BACKEND_SERVICE_NAME --global --format="value(id)"
// authenticating-with-id-tokens

const EXPECTED_AUDIENCE = '';

export interface IapUser {
  email: string;
  sub: string;
}

export async function authenticateIapRequest(req: Request): Promise<IapUser | null> {
  const jwt = req.headers.get("x-goog-authenticated-user-jwt");
  if (!jwt) {
    return null;
  }

  const expectedAudience = Bun.env.IAP_AUDIENCE || EXPECTED_AUDIENCE;

  try {
    // Verify the token using Google's IAP keys
    const { payload } = await jwtVerify(jwt, iapJwks, {
      issuer: "https://cloud.google.com/iap",
      audience: expectedAudience || undefined,
      algorithms: ["ES256"],
    });

    const email = typeof payload.email === "string" ? payload.email : "";
    const sub = typeof payload.sub === "string" ? payload.sub : "";

    if (!email) {
      return null;
    }
    //console.log('IAP Token verified successfully:', payload);
    return { email, sub };
  } catch (error) {
    // Token signature mismatch, expired, or invalid audience
    console.error("IAP JWT verification failed:", error);
    return null;
  }
}

/*

interface IapPayload{
  email: string;
  sub: string;
  iss: string;
}


async function verifyIapToken(token: string, expectedAudience: string) {
  try {
    
    const { payload } = await jwtVerify(token, iapJwks, {
      audience: expectedAudience, // Your IAP backend audience string (PROJECT_NUMBER/RESOURCE_ID)
      issuer: 'https://cloud.google.com/iap',
      algorithms: ['ES256'],
    });

   
    return payload;
  } catch (error) {
    return null;
  }
}
*/


/*
async function verifyIapTokenCrypto(req: Request) :  Promise<IapPayload | null>{
  try {

  const jwtToken = req.headers.get("x-goog-authenticated-user-jwt") || null;

    const { payload } = await jwtVerify(
    jwtToken!, 
    iapJwks, 
    {
      audience: EXPECTED_AUDIENCE, // Your IAP backend audience string (PROJECT_NUMBER/RESOURCE_ID)
      issuer: 'https://cloud.google.com/iap',
      algorithms: ['ES256'],
    });

    return payload as unknown as IapPayload;

  } catch (error) {
    return null;
  }
}



async function extractIapUserEmail(req: Request): Promise<string> {
  const jwt = req.headers.get("x-goog-authenticated-user-jwt");
  if (jwt) {
    try {
      const { payload } = await jwtVerify(jwt, iapJwks, {
        issuer: issuer,
      });
      const emailClaim = payload.email;
      if (typeof emailClaim === "string" && emailClaim) {
        return emailClaim;
      }
    } catch (err) {
      //console.error("Failed to verify Google IAP JWT:", err);
    }
  }


  // Fallback to x-goog-authenticated-user-email header if JWT is missing or invalid
  const rawEmail = req.headers                                                                                                .get("x-goog-authenticated-user-email") || "";
  return rawEmail.replace(/^accounts\.google\.com:/, "");
}
*/


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
      POST: (req) => {
        return handleGoogleSignIn(req);
        },
    },
    "/api/auth/sessionOld": {
      GET: (req) => handleGoogleSession(req),
    },
    "/api/auth/session": {
    GET: async (req) => {
    // Check IAP header first (production behind IAP)
    const iapUser = await authenticateIapRequest(req);
    if (iapUser) {
      const authenticatedEmail = iapUser.email;
      return Response.json({
        user: {
          email: iapUser.email,
          name: iapUser.email.split("@")[0],
          picture: null,
        },
      });
    }

        // 2. Fall back to local cookie session (for local dev)
        return handleGoogleSession(req);
      },
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
          //console.error("Failed to insert Glow log into Turso.", error);
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
          //console.error("Failed to query glow_logs from Turso.", error);
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

    // Core Session Check: Inspect headers for your existing authentication tokens
    const cookieHeader = req.headers.get("Cookie") || "";
    const hasActiveSession = cookieHeader.includes("session_token"); // Adjust string match to match your verify utility cookie key

    // Default Root Path Handling
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

    // Serve your local frontend static web views safely out of your build/public directory
    if (url.pathname === "/signin.html" || url.pathname === "/index.html") {
      const file = Bun.file(`./public${url.pathname}`);
      if (await file.exists()) {
        return new Response(file);
      }
    }

    //return new Response("Not Found", { status: 404 });
    
    return new Response(JSON.stringify({ error: "Not Found" }), { 
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  },
});


console.log(`bunfetch running at http://localhost:${port}`);
