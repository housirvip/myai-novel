export const CHAPTER_STATUS = {
  TODO: "todo",
  PLANNED: "planned",
  DRAFTED: "drafted",
  REVIEWED: "reviewed",
  REPAIRED: "repaired",
  APPROVED: "approved",
} as const;

export const CHAPTER_SOURCE_TYPE = {
  AI_GENERATED: "ai_generated",
  REPAIRED: "repaired",
  IMPORTED: "imported",
  APPROVED: "approved",
} as const;

export const PLAN_INTENT_SOURCE = {
  USER_INPUT: "user_input",
  AI_GENERATED: "ai_generated",
  MANUAL_IMPORT: "manual_import",
} as const;
