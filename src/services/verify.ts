import { GoogleAuthService } from "./googleauth";

const authService = new GoogleAuthService();
const sessionCookieName = "google_session";

function cookieOptions(maxAge: number): string {
  const secure = Bun.env.NODE_ENV === "production" ? "; Secure" : "";
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
    const secure = Bun.env.NODE_ENV === "production" ? "; Secure" : "";
    const headers = new Headers({
      "Set-Cookie": `${sessionCookieName}=${encodeURIComponent(body.credential)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`,
    });

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
    console.error("Google ID token verification failed.", error);
    return Response.json({ error: "Google sign-in could not be verified." }, { status: 401 });
  }
}

export async function handleGoogleSession(request: Request): Promise<Response> {

console.log(request);
  const credential = readCookie(request, sessionCookieName);
  if (!credential) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    console.log(credential);

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
