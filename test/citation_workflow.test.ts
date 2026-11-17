import test from "node:test";
import assert from "node:assert/strict";
import { dedupeCitations } from "../src/citation_workflow.ts";

test("keeps the first citation for one source URL", () => {
  const citations = [
    { title: "A", url: "https://example.test/source/", excerpt: "first", sourceId: "a" },
    { title: "A copy", url: "https://EXAMPLE.test/source", excerpt: "duplicate", sourceId: "b" },
    { title: "B", url: "https://example.test/other", excerpt: "second", sourceId: "c" }
  ];
  assert.deepEqual(dedupeCitations(citations).map((citation) => citation.sourceId), ["a", "c"]);
});
