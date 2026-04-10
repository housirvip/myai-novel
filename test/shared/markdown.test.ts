import assert from "node:assert/strict";
import test from "node:test";

import { formatChapterMarkdown, parseChapterMarkdown } from "../../src/shared/utils/markdown.js";

test("chapter markdown can round-trip through format and parse", () => {
  const markdown = formatChapterMarkdown({
    metadata: {
      bookId: 7,
      chapterNo: 12,
      stage: "final",
      title: "黑铁令",
      status: "approved",
      wordCount: 1234,
      updatedAt: "2026-04-10T15:00:00.000Z",
    },
    summary: "本章总结",
    content: "这里是正文。",
  });

  const parsed = parseChapterMarkdown(markdown);

  assert.deepEqual(parsed.metadata, {
    bookId: 7,
    chapterNo: 12,
    stage: "final",
    title: "黑铁令",
    status: "approved",
    wordCount: 1234,
    updatedAt: "2026-04-10T15:00:00.000Z",
  });
  assert.equal(parsed.summary, "本章总结");
  assert.equal(parsed.content, "这里是正文。");
});

test("chapter markdown parser rejects markdown without content section", () => {
  assert.throws(
    () =>
      parseChapterMarkdown([
        "---",
        "book_id: 1",
        "chapter_no: 1",
        "stage: plan",
        "title: 测试",
        "status: planned",
        "word_count: ",
        "updated_at: 2026-04-10T00:00:00.000Z",
        "---",
        "",
        "# 测试",
      ].join("\n")),
    /missing ## Content section/,
  );
});
