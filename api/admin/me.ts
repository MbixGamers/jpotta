import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isAdminRequest } from "../_auth";

const cors = (res: VercelResponse) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  const authenticated = await isAdminRequest(req);
  return res.json({ authenticated, username: authenticated ? "admin" : null });
}
