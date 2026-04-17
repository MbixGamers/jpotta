import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isAdminRequest, signAdminToken } from "./_auth";

const ALLOWED_METHODS = "GET, POST, OPTIONS";

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function getAction(req: VercelRequest): string | null {
  const requestUrl = req.url ?? "";
  const pathname = requestUrl.split("?")[0] ?? "";
  const segments = pathname.split("/").filter(Boolean);
  const action = segments[2];
  return action ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const action = getAction(req);

  if (action === "login") {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { username, password } = req.body ?? {};
    const isValid =
      username === (process.env.ADMIN_USERNAME ?? "admin") &&
      password === (process.env.ADMIN_PASSWORD ?? "jpotta@2024");

    if (!isValid) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = await signAdminToken();
    return res.status(200).json({ success: true, message: "Login successful", token });
  }

  if (action === "logout") {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    return res.status(200).json({ success: true, message: "Logged out" });
  }

  if (action === "me") {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const authenticated = await isAdminRequest(req);
    return res.status(200).json({ authenticated, username: authenticated ? "admin" : null });
  }

  return res.status(404).json({ error: "Not found" });
}
