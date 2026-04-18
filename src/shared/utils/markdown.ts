export type ChapterStage = "plan" | "draft" | "final";

export interface ChapterMarkdownMetadata {
  bookId: number;
  chapterNo: number;
  stage: ChapterStage;
  title: string | null;
  status: string;
  wordCount: number | null;
  updatedAt: string;
}

export interface ParsedChapterMarkdown {
  metadata: ChapterMarkdownMetadata;
  title: string | null;
  summary: string | null;
  content: string;
}

export function formatChapterMarkdown(input: {
  metadata: ChapterMarkdownMetadata;
  summary: string | null;
  content: string;
}): string {
  // 导出的 Markdown 需要同时满足“人可读编辑”和“机器可逆导入”，
  // 所以这里固定 front matter + Summary + Content 三段协议，而不是完全自由格式。
  const { metadata, summary, content } = input;
  const title = metadata.title ?? `Chapter ${metadata.chapterNo}`;
  const lines = [
    "---",
    `book_id: ${metadata.bookId}`,
    `chapter_no: ${metadata.chapterNo}`,
    `stage: ${metadata.stage}`,
    `title: ${escapeFrontMatterValue(metadata.title ?? "")}`,
    `status: ${escapeFrontMatterValue(metadata.status)}`,
    `word_count: ${metadata.wordCount ?? ""}`,
    `updated_at: ${escapeFrontMatterValue(metadata.updatedAt)}`,
    "---",
    "",
    `# ${title}`,
    "",
    "## Summary",
    "",
    summary ?? "",
    "",
    "## Content",
    "",
    content.trimEnd(),
    "",
  ];

  return lines.join("\n");
}

export function parseChapterMarkdown(markdown: string): ParsedChapterMarkdown {
  // 解析时按导出协议做严格匹配，
  // 目的是尽早暴露用户手改 Markdown 后破坏结构的问题，避免导入半成功半失败。
  const frontMatterMatch = markdown.match(/^---\n([\s\S]*?)\n---\n?/);

  if (!frontMatterMatch) {
    throw new Error("Invalid markdown: missing front matter");
  }

  const frontMatter = frontMatterMatch[1];
  const body = markdown.slice(frontMatterMatch[0].length);
  const metadata = parseMetadata(frontMatter);
  const titleMatch = body.match(/^#\s+(.+)$/m);
  const summaryMatch = body.match(/## Summary\s*\n([\s\S]*?)\n## Content\s*\n/);
  const contentMatch = body.match(/## Content\s*\n([\s\S]*)$/);

  if (!contentMatch) {
    throw new Error("Invalid markdown: missing ## Content section");
  }

  return {
    metadata,
    title: titleMatch?.[1]?.trim() || metadata.title,
    summary: normalizeSection(summaryMatch?.[1]),
    content: contentMatch[1].trim(),
  };
}

function parseMetadata(frontMatter: string): ChapterMarkdownMetadata {
  // front matter 这里只支持简单 key:value 结构，
  // 不打算做完整 YAML 解析，避免为了导入章节稿引入更宽但更难控的语法面。
  const records = Object.fromEntries(
    frontMatter
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separatorIndex = line.indexOf(":");

        if (separatorIndex === -1) {
          throw new Error(`Invalid front matter line: ${line}`);
        }

        const key = line.slice(0, separatorIndex).trim();
        const rawValue = line.slice(separatorIndex + 1).trim();
        const value = rawValue.replace(/^"(.*)"$/, "$1");
        return [key, value];
      }),
  );

  const stage = records.stage;

  if (stage !== "plan" && stage !== "draft" && stage !== "final") {
    throw new Error(`Invalid stage in front matter: ${stage}`);
  }

  const bookId = Number(records.book_id);
  const chapterNo = Number(records.chapter_no);
  const wordCount = records.word_count ? Number(records.word_count) : null;

  if (!Number.isFinite(bookId) || !Number.isFinite(chapterNo)) {
    throw new Error("Invalid book_id or chapter_no in front matter");
  }

  if (wordCount !== null && !Number.isFinite(wordCount)) {
    throw new Error("Invalid word_count in front matter");
  }

  return {
    bookId,
    chapterNo,
    stage,
    title: records.title || null,
    status: records.status || "unknown",
    wordCount,
    updatedAt: records.updated_at || new Date().toISOString(),
  };
}

function normalizeSection(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function escapeFrontMatterValue(value: string): string {
  if (!value.includes(":") && !value.includes("\"")) {
    return value;
  }

  return JSON.stringify(value);
}
