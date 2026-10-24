import { GoogleAuthService } from "./googleauth";
import { jwtVerify, createRemoteJWKSet } from "jose";

const authService = new GoogleAuthService();
const sessionCookieName = "google_session";

const iapJwks = createRemoteJWKSet(
  new URL("https://www.gstatic.com/iap/verify/public_key-jwk")
);

const IAP_ISSUER = "https://cloud.google.com/iap";


// const user_email = await extractIapUserEmail(req);
// if (!user_email || !/^([^\s@]+)@([^\s@]+)\.[^\s@]+$/.test(user_email)) {
//   return Response.json({ error: "A valid IAP authenticated user email is required." }, { status: 400 });
// }

async function extractIapUserEmail(req: Request): Promise<string> {
  const jwt = req.headers.get("x-goog-authenticated-user-jwt");
  if (jwt) {
    try {
      const { payload } = await jwtVerify(jwt, iapJwks, {
        issuer: IAP_ISSUER,
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
  const rawEmail = req.headers.get("x-goog-authenticated-user-email") || "";
  return rawEmail.replace(/^accounts\.google\.com:/, "");
}

function cookieOptions(maxAge: number): string {
  const secure = Bun.env.VITE_APP_STAGE === "production" ? "; Secure" : "";
  return `${sessionCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

function readCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  for (const cookie of cookieHeader.split(";")) {
    const separator = cookie.indexOf("=");
    if (separator < 0 || cookie.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(cookie.slice(separator + 1).trim());
  }
  return null;
}

export async function handleGoogleSignIn(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("credential" in body) ||
    typeof body.credential !== "string" ||
    body.credential.length > 10_000
  ) {
    return Response.json({ error: "A Google ID credential is required." }, { status: 400 });
  }

  try {
    const user = await authService.verifyIdToken(body.credential);
    const maxAge = Math.max(0, user.exp - Math.floor(Date.now() / 1000));
    const secure = Bun.env.VITE_APP_STAGE === "production" ? "; Secure" : "";
    const headers = new Headers({
      "Set-Cookie": `${sessionCookieName}=${encodeURIComponent(body.credential)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`,
    });

    // const sessionData = {
    //   email: user.email,
    //   name: user.name,
    //   picture: user.picture,
    // };

    //const cookies = request.cookies;
    //const cookies = new Bun.CookieMap(sessionData);

    // Save the verified details inside an HttpOnly cookie session
    // setCookie(c, 'user_session', JSON.stringify(sessionData), {
    //   httpOnly: true, // Safe from cross-site scripting (XSS)
    //   secure: true,   // Only sent over HTTPS
    //   sameSite: 'Lax',
    //   maxAge: 60 * 60 * 24, // 1 day
    // });



    // const cookies2 = cookies.set({
    //   httpOnly: true, // Safe from cross-site scripting (XSS)
    //   secure: true,   // Only sent over HTTPS
    //   sameSite: 'lax',
    //   maxAge: 60 * 60 * 24, // 1 day
    // });


          //const client = new OAuth2Client(Bun.env.GOOGLE_CLIENT_ID);

          //const body = await response.json();

          //const ticket = await client.verifyIdToken({
          //  idToken: body,
          //  audience: Bun.env.GOOGLE_CLIENT_ID,
          //});


    return Response.json(
      {
        user: {
          email: user.email,
          name: user.name,
          picture: user.picture,
        },
      },
      { headers },
    );
  } catch (error) {
    //console.error("Google ID token verification failed.", error);
    return Response.json({ error: "Google sign-in could not be verified." }, { status: 401 });
  }
}

export async function handleGoogleSession(request: Request): Promise<Response> {

  //console.log(request);
  const credential = readCookie(request, sessionCookieName);
  if (!credential) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    //console.log(credential);

    const user = await authService.verifyIdToken(credential);
    return Response.json({
      user: {
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    });
  } catch {
    return Response.json(
      { error: "Google session is invalid or expired." },
      {
        status: 401,
        headers: { "Set-Cookie": cookieOptions(0) },
      },
    );
  }
}

export function handleGoogleSignOut(): Response {
  return Response.json(
    { success: true },
    { headers: { "Set-Cookie": cookieOptions(0) } },
  );
}
