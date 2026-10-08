import { createRemoteJWKSet, jwtVerify } from "jose";

const googleJwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

export interface GoogleUserClaims {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture: string;
  exp: number;
  hd?: string;
}

export class GoogleAuthService {
  public async verifyIdToken(idToken: string): Promise<GoogleUserClaims> {
    const clientId = Bun.env.GOOGLE_CLIENT_ID?.trim();
    if (!clientId) {
      throw new Error("Google sign-in is not configured: GOOGLE_CLIENT_ID is missing.");
    }

    const { payload } = await jwtVerify(idToken, googleJwks, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: clientId,
    });

    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      payload.email_verified !== true ||
      typeof payload.exp !== "number"
    ) {
      throw new Error("Google ID token is missing required verified user claims.");
    }

    return {
      sub: payload.sub,
      email: payload.email,
      email_verified: true,
      name: typeof payload.name === "string" ? payload.name : "",
      picture: typeof payload.picture === "string" ? payload.picture : "",
      exp: payload.exp,
      hd: typeof payload.hd === "string" ? payload.hd : undefined,
    };
  }
}
