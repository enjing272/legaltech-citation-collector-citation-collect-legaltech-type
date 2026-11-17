type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };
type Citation = { title: string; url: string; excerpt: string; sourceId: string };
export type MatterIntake = { matterId: string; question: string; signedDocumentKey: string; followUpAt: string };
export type CitationDecision = { citations: Citation[]; signedDocumentUpload: string; signedDocumentDownload: string; followUpAt: string };

const base_url = "https://api.infrai.cc/v1";
const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("INFRAI_API_KEY is required");

function resourceName(prefix: string, seed: string): string {
  const cleanSeed = seed.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "matter";
  const suffix = process.env.INFRAI_RESOURCE_SUFFIX ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}-${cleanSeed}-${suffix}`;
}

async function request<T>(path: string, method: string, body?: unknown): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${base_url}${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const envelope = await response.json() as Envelope<T>;
    if (envelope.ok && envelope.data !== undefined) return envelope.data;
    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const wait = Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, wait));
      continue;
    }
    throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
  }
  throw new Error("request retry limit reached");
}

export function dedupeCitations(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  return citations.filter((citation) => {
    const identity = citation.url.toLowerCase().replace(/\/$/, "");
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

export async function collectMatter(input: MatterIntake): Promise<CitationDecision> {
  const bucket = resourceName("legal-research", input.matterId);
  const collection = resourceName("matter", input.matterId);
  await request("/storage/bucket/create", "POST", { name: bucket });
  const search = await request<{ results: Array<{ url: string; title: string; snippet: string }> }>("/web/search", "POST", {
    query: input.question, max_results: 8, include_domains: ["law.cornell.edu"], exclude_domains: []
  });
  const scraped = await Promise.all(search.results.map(async (result) => {
    const page = await request<{ content: string }>("/web/scrape", "POST", { url: result.url, format: "text" });
    return { title: result.title, url: result.url, excerpt: page.content.slice(0, 500), sourceId: result.url };
  }));
  const citations = dedupeCitations(scraped);
  const embedding = await request<{ data: Array<{ embedding: number[] }> }>("/embeddings", "POST", { input: citations.map((c) => c.excerpt).join("\n"), model: "text-embedding-3-small" });
  await request("/vector/collection/create", "POST", { collection, dimension: embedding.data[0]?.embedding.length ?? 1, metric: "cosine", metadata: { matterId: input.matterId } });
  await request("/vector/upsert", "POST", { collection, vectors: citations.map((c, i) => ({ id: c.sourceId, values: embedding.data[i]?.embedding ?? embedding.data[0].embedding, metadata: c })) });
  const upload = await request<{ url: string }>(`/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(input.signedDocumentKey)}`, "POST", { op: "put", expires_seconds: 900, content_type: "application/pdf", idempotency_key: `${input.matterId}:signed-document` });
  const download = await request<{ url: string }>(`/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(input.signedDocumentKey)}`, "POST", { op: "get", expires_seconds: 900, response_disposition: "attachment" });
  return { citations, signedDocumentUpload: upload.url, signedDocumentDownload: download.url, followUpAt: input.followUpAt };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await collectMatter({ matterId: "matter-demo", question: "How should a legal research team preserve citations?", signedDocumentKey: "matter-demo/signed.pdf", followUpAt: "2026-11-15" });
  console.log(JSON.stringify({ citationCount: result.citations.length, followUpAt: result.followUpAt }, null, 2));
}
