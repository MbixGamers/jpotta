import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc, eq } from "drizzle-orm";
import { db, achievementsTable, achievementPlayersTable } from "./_db";
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
    const achievements = await db.select().from(achievementsTable).orderBy(desc(achievementsTable.year));
    const mappings = await db.select().from(achievementPlayersTable);
    return res.json(achievements.map(a => ({
      ...a,
      taggedPlayerIds: mappings.filter(m => m.achievementId === a.id).map(m => m.playerId),
      createdAt: a.createdAt.toISOString(),
    })));
  }

  if (req.method === "POST") {
    if (!(await isAdminRequest(req))) return res.status(401).json({ error: "Unauthorized" });
    const { title, shortDescription, longDescription, year, category, mainImageUrl, additionalImages, taggedPlayerIds } = req.body ?? {};
    if (!title || !year) return res.status(400).json({ error: "title and year are required" });
    const [ach] = await db.insert(achievementsTable).values({
      title,
      shortDescription: shortDescription ?? "",
      longDescription: longDescription ?? "",
      year: Number(year),
      category: category ?? null,
      mainImageUrl: mainImageUrl ?? null,
      additionalImages: additionalImages ?? [],
    }).returning();
    if (Array.isArray(taggedPlayerIds) && taggedPlayerIds.length > 0) {
      await db.insert(achievementPlayersTable).values(
        taggedPlayerIds.map((pid: number) => ({ achievementId: ach.id, playerId: pid }))
      );
    }
    return res.status(201).json({
      ...ach,
      taggedPlayerIds: taggedPlayerIds ?? [],
      createdAt: ach.createdAt.toISOString(),
    });
  }

  if (!id) return res.status(400).json({ error: "Invalid id" });

  if (req.method === "PATCH") {
    if (!(await isAdminRequest(req))) return res.status(401).json({ error: "Unauthorized" });
    const { title, shortDescription, longDescription, year, category, mainImageUrl, additionalImages, taggedPlayerIds } = req.body ?? {};
    const update: Record<string, unknown> = {};
    if (title != null) update.title = title;
    if (shortDescription !== undefined) update.shortDescription = shortDescription;
    if (longDescription !== undefined) update.longDescription = longDescription;
    if (year != null) update.year = Number(year);
    if (category !== undefined) update.category = category;
    if (mainImageUrl !== undefined) update.mainImageUrl = mainImageUrl;
    if (additionalImages !== undefined) update.additionalImages = additionalImages;

    const [ach] = await db.update(achievementsTable).set(update).where(eq(achievementsTable.id, id)).returning();
    if (!ach) return res.status(404).json({ error: "Not found" });

    if (Array.isArray(taggedPlayerIds)) {
      await db.delete(achievementPlayersTable).where(eq(achievementPlayersTable.achievementId, id));
      if (taggedPlayerIds.length > 0) {
        await db.insert(achievementPlayersTable).values(
          taggedPlayerIds.map((pid: number) => ({ achievementId: id, playerId: pid }))
        );
      }
    }

    const mappings = await db.select().from(achievementPlayersTable).where(eq(achievementPlayersTable.achievementId, id));
    return res.json({ ...ach, taggedPlayerIds: mappings.map(m => m.playerId), createdAt: ach.createdAt.toISOString() });
  }

  if (req.method === "DELETE") {
    if (!(await isAdminRequest(req))) return res.status(401).json({ error: "Unauthorized" });
    await db.delete(achievementPlayersTable).where(eq(achievementPlayersTable.achievementId, id));
    await db.delete(achievementsTable).where(eq(achievementsTable.id, id));
    return res.status(204).end();
  }

  return res.status(405).json({ error: "Method not allowed" });
}
