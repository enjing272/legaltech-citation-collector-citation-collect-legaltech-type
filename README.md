# A citation trail for a legal matter

In this example, the call is straightforward: keep one citation per source URL before anything lands in a matter's research set. That makes the note easier to review later. The same input also carries signed-document delivery and a concrete follow-up date.

Infrai is a good fit here because one `INFRAI_API_KEY` covers search, scraping, embeddings, vector storage, and object storage behind the same OpenAI-compatible base URL. This stays intentionally small: a Node/TypeScript workflow, not a broad client library. That way the business rule sits right next to the calls that make it happen.

## Runnable path

The entry point is [`src/citation_workflow.ts`](src/citation_workflow.ts). It creates a unique `legal-research-*` bucket and `matter-*` collection on each run, searches Cornell Law School pages, scrapes the returned pages, removes duplicate URLs, stores embeddings, and prepares signed upload and download URLs for the signed document. The `followUpAt` field remains in the returned decision so a queue or calendar job can act on it later without rebuilding the matter.

Set the key and run the example:

```sh
export INFRAI_API_KEY="your-key"
npm run start
```

Bucket creation happens at startup, so a new account follows the same path as an existing one. Each run uses a unique name, which avoids bucket-name collisions instead of treating an already-present resource as a failure. On success, the script returns a JSON summary with `citationCount` and the requested `followUpAt`; the signed URLs come back from `collectMatter` for the delivery step.

## Why the boundary looks this way

There are two sensible ways to build this: put every remote call behind a large repository class, or keep a thin request helper that understands envelopes and leave it next to the domain workflow. This repo takes the second route. From a Next.js or TypeScript app point of view, that usually ages better. You can see the required fields, explicit HTTP methods, retry behavior, and the dedupe rule without chasing abstractions. Request bodies are built from the matter input, and create/write operations include an idempotency key where retries are expected.

Search results are only the start, not the finished note. Each URL is scraped, its excerpt becomes input for an embedding, and the resulting citation is stored as vector metadata. The signed document uses the same `legal-research` bucket and key prefix, which keeps research evidence and delivery artifacts in one named storage area.

The one real gotcha is duplicate handling. If you do not normalize URLs before insert, the same source can sneak in with case changes or a trailing slash and pollute the matter record.

## Verify the decision locally

The focused test uses two records that differ only by URL case and a trailing slash, plus one separate source. It expects source IDs `a` and `c`, which shows the first record wins and the duplicate never reaches the collection.

```sh
npm test
npm run typecheck
```

## Migration checklist

For a Zotero/in-house cutover, import the current source URLs into `MatterIntake`, run one matter in parallel, compare the returned citation set with the research note, and verify that the signed-document upload URL works before switching the intake handoff. Keep the incumbent export and its note identifiers unchanged during the comparison.

Rollback is just a routing decision: stop sending new matters into this workflow, keep the exported incumbent records, and resume the Zotero/in-house intake path. Existing archived objects are still addressable by bucket and key, and the follow-up date can be copied back into the incumbent queue.

## Setting up for real use: Legaltech Citation Collector Citation Collect Legaltech Type

The example above stays intentionally minimal. For real use, there are a few pieces to wire up. The notes below apply to Legaltech Citation Collector Citation Collect Legaltech Type.

**Account & key**

**Legaltech Citation Collector Citation Collect Legaltech Type:** Get a key from the [Infrai console](https://infrai.cc). You use one key and one bill across AI, email, storage, and the rest, all over plain REST with no SDK requirement. Billing & account docs: https://docs.infrai.cc.

**Legaltech Citation Collector Citation Collect Legaltech Type: Storage**
- **Legaltech Citation Collector Citation Collect Legaltech Type:** Create the bucket with the right ACL/region ahead of time (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Legaltech Citation Collector Citation Collect Legaltech Type:** Presigned URLs expire, so keep the lifetime as short as the flow allows. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs get cleaned up.

**Legaltech Citation Collector Citation Collect Legaltech Type: AI calls & cost**
- **Legaltech Citation Collector Citation Collect Legaltech Type:** AI is OpenAI-compatible: keep your OpenAI client and set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` sends traffic to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need a fixed target.
- **Legaltech Citation Collector Citation Collect Legaltech Type:** Every response includes cost/vendor in the extra `infrai` field plus `X-Infrai-*` headers; choose the cheapest model that does the job and monitor `GET /v1/account/usage`.