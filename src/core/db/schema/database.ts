import type { Generated } from "kysely";

export interface BooksTable {
  id: Generated<number>;
  title: string;
  summary: string | null;
  target_chapter_count: number | null;
  current_chapter_count: number;
  status: string;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

export interface OutlinesTable {
  id: Generated<number>;
  book_id: number;
  volume_no: number | null;
  volume_title: string | null;
  chapter_start_no: number | null;
  chapter_end_no: number | null;
  outline_level: string;
  title: string;
  story_core: string | null;
  main_plot: string | null;
  sub_plot: string | null;
  foreshadowing: string | null;
  expected_payoff: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorldSettingsTable {
  id: Generated<number>;
  book_id: number;
  title: string;
  category: string;
  content: string;
  status: string;
  append_notes: string | null;
  keywords: string | null;
  created_at: string;
  updated_at: string;
}

export interface CharactersTable {
  id: Generated<number>;
  book_id: number;
  name: string;
  alias: string | null;
  gender: string | null;
  age: number | null;
  personality: string | null;
  background: string | null;
  current_location: string | null;
  status: string;
  professions: string | null;
  levels: string | null;
  currencies: string | null;
  abilities: string | null;
  goal: string | null;
  append_notes: string | null;
  keywords: string | null;
  created_at: string;
  updated_at: string;
}

export interface FactionsTable {
  id: Generated<number>;
  book_id: number;
  name: string;
  category: string | null;
  core_goal: string | null;
  description: string | null;
  leader_character_id: number | null;
  headquarter: string | null;
  status: string | null;
  append_notes: string | null;
  keywords: string | null;
  created_at: string;
  updated_at: string;
}

export interface RelationsTable {
  id: Generated<number>;
  book_id: number;
  source_type: string;
  source_id: number;
  target_type: string;
  target_id: number;
  relation_type: string;
  intensity: number | null;
  status: string | null;
  description: string | null;
  append_notes: string | null;
  keywords: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItemsTable {
  id: Generated<number>;
  book_id: number;
  name: string;
  category: string | null;
  description: string | null;
  owner_type: string;
  owner_id: number | null;
  rarity: string | null;
  status: string | null;
  append_notes: string | null;
  keywords: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoryHooksTable {
  id: Generated<number>;
  book_id: number;
  title: string;
  hook_type: string | null;
  description: string | null;
  source_chapter_no: number | null;
  target_chapter_no: number | null;
  status: string;
  importance: string | null;
  append_notes: string | null;
  keywords: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChaptersTable {
  id: Generated<number>;
  book_id: number;
  chapter_no: number;
  title: string | null;
  summary: string | null;
  word_count: number | null;
  status: string;
  current_plan_id: number | null;
  current_draft_id: number | null;
  current_review_id: number | null;
  current_final_id: number | null;
  actual_character_ids: string | null;
  actual_faction_ids: string | null;
  actual_item_ids: string | null;
  actual_hook_ids: string | null;
  actual_world_setting_ids: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChapterPlansTable {
  id: Generated<number>;
  book_id: number;
  chapter_id: number;
  chapter_no: number;
  version_no: number;
  status: string;
  author_intent: string | null;
  intent_source: string;
  intent_keywords: string | null;
  manual_entity_refs: string | null;
  retrieved_context: string | null;
  content: string;
  model: string | null;
  provider: string | null;
  source_type: string;
  created_at: string;
  updated_at: string;
}

export interface ChapterDraftsTable {
  id: Generated<number>;
  book_id: number;
  chapter_id: number;
  chapter_no: number;
  version_no: number;
  based_on_plan_id: number | null;
  based_on_draft_id: number | null;
  based_on_review_id: number | null;
  status: string;
  content: string;
  summary: string | null;
  word_count: number | null;
  model: string | null;
  provider: string | null;
  source_type: string;
  created_at: string;
  updated_at: string;
}

export interface ChapterReviewsTable {
  id: Generated<number>;
  book_id: number;
  chapter_id: number;
  chapter_no: number;
  draft_id: number;
  version_no: number;
  status: string;
  summary: string | null;
  issues: string | null;
  risks: string | null;
  continuity_checks: string | null;
  repair_suggestions: string | null;
  raw_result: string;
  model: string | null;
  provider: string | null;
  source_type: string;
  created_at: string;
  updated_at: string;
}

export interface ChapterFinalsTable {
  id: Generated<number>;
  book_id: number;
  chapter_id: number;
  chapter_no: number;
  version_no: number;
  based_on_draft_id: number | null;
  status: string;
  content: string;
  summary: string | null;
  word_count: number | null;
  source_type: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseSchema {
  books: BooksTable;
  outlines: OutlinesTable;
  world_settings: WorldSettingsTable;
  characters: CharactersTable;
  factions: FactionsTable;
  relations: RelationsTable;
  items: ItemsTable;
  story_hooks: StoryHooksTable;
  chapters: ChaptersTable;
  chapter_plans: ChapterPlansTable;
  chapter_drafts: ChapterDraftsTable;
  chapter_reviews: ChapterReviewsTable;
  chapter_finals: ChapterFinalsTable;
}
