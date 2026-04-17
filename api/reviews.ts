import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db, reviewsTable } from "./_db";
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
    const reviews = await db.select().from(reviewsTable).orderBy(reviewsTable.createdAt);
    return res.json(reviews.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
  }

  if (req.method === "POST") {
    if (!(await isAdminRequest(req))) return res.status(401).json({ error: "Unauthorized" });
    const { authorName, authorTitle, content, rating, photoUrl } = req.body ?? {};
    if (!authorName || !content) return res.status(400).json({ error: "authorName and content are required" });
    const [review] = await db.insert(reviewsTable).values({
      authorName, authorTitle: authorTitle ?? null, content,
      rating: Number(rating ?? 5), photoUrl: photoUrl ?? null,
    }).returning();
    return res.status(201).json({ ...review, createdAt: review.createdAt.toISOString() });
  }

  if (!id) return res.status(400).json({ error: "Invalid id" });

  if (req.method === "PATCH") {
    if (!(await isAdminRequest(req))) return res.status(401).json({ error: "Unauthorized" });
    const { authorName, authorTitle, content, rating, photoUrl } = req.body ?? {};
    const update: Record<string, unknown> = {};
    if (authorName != null) update.authorName = authorName;
    if (authorTitle !== undefined) update.authorTitle = authorTitle;
    if (content != null) update.content = content;
    if (rating != null) update.rating = Number(rating);
    if (photoUrl !== undefined) update.photoUrl = photoUrl;
    const [review] = await db.update(reviewsTable).set(update).where(eq(reviewsTable.id, id)).returning();
    if (!review) return res.status(404).json({ error: "Not found" });
    return res.json({ ...review, createdAt: review.createdAt.toISOString() });
  }

  if (req.method === "DELETE") {
    if (!(await isAdminRequest(req))) return res.status(401).json({ error: "Unauthorized" });
    await db.delete(reviewsTable).where(eq(reviewsTable.id, id));
    return res.status(204).end();
  }

  return res.status(405).json({ error: "Method not allowed" });
}
