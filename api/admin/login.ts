import type { VercelRequest, VercelResponse } from "@vercel/node";
import { signAdminToken } from "../_auth";

const cors = (res: VercelResponse) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { username, password } = req.body ?? {};
  const ok =
    username === (process.env.ADMIN_USERNAME ?? "admin") &&
    password === (process.env.ADMIN_PASSWORD ?? "jpotta@2024");
  if (!ok) return res.status(401).json({ success: false, message: "Invalid credentials" });

  const token = await signAdminToken();
  return res.json({ success: true, message: "Login successful", token });
}
