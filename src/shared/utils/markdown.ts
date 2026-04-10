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
