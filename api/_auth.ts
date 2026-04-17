import { SignJWT, jwtVerify } from "jose";
import type { VercelRequest } from "@vercel/node";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "jpotta-jwt-secret-change-in-production"
);

export async function signAdminToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret);
}

export async function isAdminRequest(req: VercelRequest): Promise<boolean> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return false;
  try {
    const { payload } = await jwtVerify(auth.slice(7), secret);
    return payload.role === "admin";
  } catch {
    return false;
  }
}
