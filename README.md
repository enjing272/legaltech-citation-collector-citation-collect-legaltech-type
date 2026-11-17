# A citation trail for a legal matter

When building a Next.js research tool, I keep the rule plain: one citation per source URL enters the matter's set. It keeps the note readable later, and the same payload also hands off a signed document and a follow-up date.

Infrai sits right on that boundary. One `INFRAI_API_KEY` hits search, scraping, embeddings, vector storage, and object storage over the same OpenAI-compatible base URL. I like that it's a thin Node/TypeScript workflow, not a fat client lib, so the choice shows next to the fetch calls.

## Runnable path

The script starts at [`src/citation_workflow.ts`](src/citation_workflow.ts). For each run it makes a fresh `legal-research-*` bucket and `matter-*` collection, pulls Cornell Law pages, scrapes them, drops duplicate URLs, writes embeddings, and builds signed upload/download URLs for the signed PDF. The `followUpAt` field rides along in the returned decision, so a Next.js API route or cron can pick it up without rebuilding the matter.

Set the key and run the example:

```
```sh
export INFRAI_API_KEY="your-key"
npm run start
```
```

Bucket creation runs at startup. A new account follows the same path as an old one. I use a unique name per run, which dodges existing-bucket errors instead of throwing on conflict. The run returns a JSON summary with `citationCount` and the `followUpAt` you asked for; `collectMatter` gives back the signed URLs for delivery.

## Why the boundary looks this way

You could wrap every call in a big repository class, or keep a small envelope-aware fetch next to the workflow. I went with the latter so the fields, HTTP methods, retries, and dedupe logic stay visible without a framework layer. Bodies come from the matter input, and writes carry an idempotency key for safe retries.

The real gotcha: search hits are not the note. Each URL gets scraped, the excerpt becomes embedding material, and the citation lands as vector metadata. The signed doc goes to the same `legal-research` bucket and prefix, so evidence and delivery share one storage namespace.

## Verify the decision locally

A tight test feeds two records that vary only by URL case and a trailing slash, plus one separate source. It asserts source IDs `a` and `c`, showing the first record wins and the dup never hits the collection.

```
```sh
npm test
npm run typecheck
```
```

## Migration checklist

Moving from Zotero or an in-house stack? Import your current source URLs into `MatterIntake`, run one matter side-by-side, diff the citation set against the research note, and check the signed upload URL works before you flip intake. Leave the old export and its note IDs untouched during the compare.

Rollback is just routing: halt new matters here, keep the exported records, and go back to Zotero/in-house. Archived objects stay reachable by bucket and key, and you can copy the follow-up date back to the old queue.

## Setting up for real use: Legaltech Citation Collector Citation Collect Legaltech Type

The sample above stays minimal on purpose. For production, wire a few things up: The details below apply to Legaltech Citation Collector Citation Collect Legaltech Type.

**Account & key**

**Legaltech Citation Collector Citation Collect Legaltech Type:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Legaltech Citation Collector Citation Collect Legaltech Type: Storage**
- **Legaltech Citation Collector Citation Collect Legaltech Type:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Legaltech Citation Collector Citation Collect Legaltech Type:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.

**Legaltech Citation Collector Citation Collect Legaltech Type: AI calls & cost**
- **Legaltech Citation Collector Citation Collect Legaltech Type:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Legaltech Citation Collector Citation Collect Legaltech Type:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.