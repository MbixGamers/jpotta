import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db, committeeTable } from "./_db";
import { isAdminRequest } from "./_auth";

const cors = (res: VercelResponse) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
};

function getId(req: VercelRequest): number | null {
  if (req.query.id != null) {
    const fromQuery = Number(req.query.id);
    return Number.isFinite(fromQuery) && fromQuery > 0 ? fromQuery : null;
  }

  const pathname = (req.url ?? "").split("?")[0] ?? "";
  const segments = pathname.split("/").filter(Boolean);
  const fromPath = Number(segments[2]);
  return Number.isFinite(fromPath) && fromPath > 0 ? fromPath : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  const id = getId(req);

  if (req.method === "GET" && !id) {
    const members = await db.select().from(committeeTable).orderBy(committeeTable.displayOrder, committeeTable.id);
    return res.json(members.map(m => ({
      ...m,
      order: m.displayOrder,
      createdAt: m.createdAt.toISOString(),
    })));
  }

  if (req.method === "POST") {
    if (!(await isAdminRequest(req))) return res.status(401).json({ error: "Unauthorized" });
    const { name, role, bio, photoUrl, order } = req.body ?? {};
    if (!name || !role) return res.status(400).json({ error: "name and role are required" });
    const [member] = await db.insert(committeeTable).values({
      name, role, bio: bio ?? null, photoUrl: photoUrl ?? null,
      displayOrder: Number(order ?? 10),
    }).returning();
    return res.status(201).json({ ...member, order: member.displayOrder, createdAt: member.createdAt.toISOString() });
  }

  if (!id) return res.status(400).json({ error: "Invalid id" });

  if (req.method === "PATCH") {
    if (!(await isAdminRequest(req))) return res.status(401).json({ error: "Unauthorized" });
    const { name, role, bio, photoUrl, order } = req.body ?? {};
    const update: Record<string, unknown> = {};
    if (name != null) update.name = name;
    if (role != null) update.role = role;
    if (bio !== undefined) update.bio = bio;
    if (photoUrl !== undefined) update.photoUrl = photoUrl;
    if (order != null) update.displayOrder = Number(order);
    const [member] = await db.update(committeeTable).set(update).where(eq(committeeTable.id, id)).returning();
    if (!member) return res.status(404).json({ error: "Not found" });
    return res.json({ ...member, order: member.displayOrder, createdAt: member.createdAt.toISOString() });
  }

  if (req.method === "DELETE") {
    if (!(await isAdminRequest(req))) return res.status(401).json({ error: "Unauthorized" });
    await db.delete(committeeTable).where(eq(committeeTable.id, id));
    return res.status(204).end();
  }

  return res.status(405).json({ error: "Method not allowed" });
}
