import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc, eq } from "drizzle-orm";
import { db, newsTable } from "./_db";
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
    const articles = await db.select().from(newsTable).orderBy(desc(newsTable.publishedAt));
    return res.json(articles.map(a => ({
      ...a,
      publishedAt: a.publishedAt.toISOString(),
      createdAt: a.createdAt.toISOString(),
    })));
  }

  if (req.method === "POST") {
    if (!(await isAdminRequest(req))) return res.status(401).json({ error: "Unauthorized" });
    const { title, summary, content, imageUrl, publishedAt } = req.body ?? {};
    if (!title) return res.status(400).json({ error: "title is required" });
    const [article] = await db.insert(newsTable).values({
      title,
      summary: summary ?? "",
      content: content ?? "",
      imageUrl: imageUrl ?? null,
      publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
    }).returning();
    return res.status(201).json({
      ...article,
      publishedAt: article.publishedAt.toISOString(),
      createdAt: article.createdAt.toISOString(),
    });
  }

  if (!id) return res.status(400).json({ error: "Invalid id" });

  if (req.method === "PATCH") {
    if (!(await isAdminRequest(req))) return res.status(401).json({ error: "Unauthorized" });
    const { title, summary, content, imageUrl, publishedAt } = req.body ?? {};
    const update: Record<string, unknown> = {};
    if (title != null) update.title = title;
    if (summary !== undefined) update.summary = summary;
    if (content !== undefined) update.content = content;
    if (imageUrl !== undefined) update.imageUrl = imageUrl;
    if (publishedAt !== undefined) update.publishedAt = new Date(publishedAt);
    const [article] = await db.update(newsTable).set(update).where(eq(newsTable.id, id)).returning();
    if (!article) return res.status(404).json({ error: "Not found" });
    return res.json({ ...article, publishedAt: article.publishedAt.toISOString(), createdAt: article.createdAt.toISOString() });
  }

  if (req.method === "DELETE") {
    if (!(await isAdminRequest(req))) return res.status(401).json({ error: "Unauthorized" });
    await db.delete(newsTable).where(eq(newsTable.id, id));
    return res.status(204).end();
  }

  return res.status(405).json({ error: "Method not allowed" });
}
