import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db, playersTable, achievementPlayersTable } from "./_db";
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
    const players = await db.select().from(playersTable).orderBy(playersTable.displayOrder, playersTable.id);
    const mappings = await db.select().from(achievementPlayersTable);
    const result = players.map(p => ({
      ...p,
      achievementIds: mappings.filter(m => m.playerId === p.id).map(m => m.achievementId),
      createdAt: p.createdAt.toISOString(),
    }));
    return res.json(result);
  }

  if (req.method === "POST") {
    if (!(await isAdminRequest(req))) return res.status(401).json({ error: "Unauthorized" });
    const { name, photoUrl, district, state, districtRank, stateRank, nationalRank, internationalRank, blade, fhRubber, bhRubber, displayOrder } = req.body ?? {};
    if (!name) return res.status(400).json({ error: "name is required" });
    const [player] = await db.insert(playersTable).values({
      name, photoUrl, district, state,
      districtRank: districtRank || null,
      stateRank: stateRank || null,
      nationalRank: nationalRank || null,
      internationalRank: internationalRank || null,
      blade, fhRubber, bhRubber,
      displayOrder: displayOrder ?? 0,
    }).returning();
    return res.status(201).json({ ...player, achievementIds: [], createdAt: player.createdAt.toISOString() });
  }

  if (!id) return res.status(400).json({ error: "Invalid id" });

  if (req.method === "GET") {
    const [player] = await db.select().from(playersTable).where(eq(playersTable.id, id));
    if (!player) return res.status(404).json({ error: "Not found" });
    const mappings = await db.select().from(achievementPlayersTable).where(eq(achievementPlayersTable.playerId, id));
    return res.json({ ...player, achievementIds: mappings.map(m => m.achievementId), createdAt: player.createdAt.toISOString() });
  }

  if (req.method === "PATCH") {
    if (!(await isAdminRequest(req))) return res.status(401).json({ error: "Unauthorized" });
    const { name, photoUrl, district, state, districtRank, stateRank, nationalRank, internationalRank, blade, fhRubber, bhRubber, displayOrder } = req.body ?? {};
    const update: Record<string, unknown> = {};
    if (name != null) update.name = name;
    if (photoUrl !== undefined) update.photoUrl = photoUrl;
    if (district !== undefined) update.district = district;
    if (state !== undefined) update.state = state;
    if (districtRank !== undefined) update.districtRank = districtRank || null;
    if (stateRank !== undefined) update.stateRank = stateRank || null;
    if (nationalRank !== undefined) update.nationalRank = nationalRank || null;
    if (internationalRank !== undefined) update.internationalRank = internationalRank || null;
    if (blade !== undefined) update.blade = blade;
    if (fhRubber !== undefined) update.fhRubber = fhRubber;
    if (bhRubber !== undefined) update.bhRubber = bhRubber;
    if (displayOrder != null) update.displayOrder = Number(displayOrder);
    const [player] = await db.update(playersTable).set(update).where(eq(playersTable.id, id)).returning();
    if (!player) return res.status(404).json({ error: "Not found" });
    const mappings = await db.select().from(achievementPlayersTable).where(eq(achievementPlayersTable.playerId, id));
    return res.json({ ...player, achievementIds: mappings.map(m => m.achievementId), createdAt: player.createdAt.toISOString() });
  }

  if (req.method === "DELETE") {
    if (!(await isAdminRequest(req))) return res.status(401).json({ error: "Unauthorized" });
    await db.delete(achievementPlayersTable).where(eq(achievementPlayersTable.playerId, id));
    await db.delete(playersTable).where(eq(playersTable.id, id));
    return res.status(204).end();
  }

  return res.status(405).json({ error: "Method not allowed" });
}
