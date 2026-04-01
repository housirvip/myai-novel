export const migrations = [
  {
    id: '001_initial_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS books (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        genre TEXT NOT NULL,
        style_guide_json TEXT NOT NULL,
        default_chapter_word_count INTEGER NOT NULL,
        chapter_word_count_tolerance_ratio REAL NOT NULL,
        model_provider TEXT NOT NULL,
        model_name TEXT NOT NULL,
        model_temperature REAL,
        model_max_tokens INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS outlines (
        book_id TEXT PRIMARY KEY,
        premise TEXT NOT NULL,
        theme TEXT NOT NULL,
        worldview TEXT NOT NULL,
        core_conflicts_json TEXT NOT NULL,
        ending_vision TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS volumes (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        title TEXT NOT NULL,
        goal TEXT NOT NULL,
        summary TEXT NOT NULL,
        chapter_ids_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS chapters (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        volume_id TEXT NOT NULL,
        chapter_index INTEGER NOT NULL,
        title TEXT NOT NULL,
        objective TEXT NOT NULL,
        planned_beats_json TEXT NOT NULL,
        status TEXT NOT NULL,
        current_plan_version_id TEXT,
        current_version_id TEXT,
        draft_path TEXT,
        final_path TEXT,
        approved_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (volume_id) REFERENCES volumes(id) ON DELETE CASCADE,
        UNIQUE (book_id, chapter_index)
      );

      CREATE TABLE IF NOT EXISTS chapter_plans (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        chapter_id TEXT NOT NULL,
        version_id TEXT NOT NULL,
        objective TEXT NOT NULL,
        scene_cards_json TEXT NOT NULL,
        required_character_ids_json TEXT NOT NULL,
        required_location_ids_json TEXT NOT NULL,
        required_faction_ids_json TEXT NOT NULL,
        required_item_ids_json TEXT NOT NULL,
        event_outline_json TEXT NOT NULL,
        hook_plan_json TEXT NOT NULL,
        state_predictions_json TEXT NOT NULL,
        memory_candidates_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        approved_by_user INTEGER NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
        UNIQUE (chapter_id, version_id)
      );

      CREATE TABLE IF NOT EXISTS chapter_drafts (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        chapter_id TEXT NOT NULL,
        version_id TEXT NOT NULL,
        chapter_plan_id TEXT NOT NULL,
        content TEXT NOT NULL,
        actual_word_count INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
        FOREIGN KEY (chapter_plan_id) REFERENCES chapter_plans(id) ON DELETE CASCADE,
        UNIQUE (chapter_id, version_id)
      );
    `,
  },
] as const
