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

      CREATE TABLE IF NOT EXISTS characters (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        profile TEXT NOT NULL,
        motivation TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS character_current_state (
        book_id TEXT NOT NULL,
        character_id TEXT NOT NULL,
        current_location_id TEXT,
        status_notes_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (book_id, character_id),
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
        FOREIGN KEY (current_location_id) REFERENCES locations(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS locations (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS factions (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        objective TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS hooks (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        title TEXT NOT NULL,
        source_chapter_id TEXT,
        description TEXT NOT NULL,
        payoff_expectation TEXT NOT NULL,
        priority TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (source_chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
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

      CREATE TABLE IF NOT EXISTS chapter_reviews (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        chapter_id TEXT NOT NULL,
        draft_id TEXT NOT NULL,
        decision TEXT NOT NULL,
        consistency_issues_json TEXT NOT NULL,
        character_issues_json TEXT NOT NULL,
        pacing_issues_json TEXT NOT NULL,
        hook_issues_json TEXT NOT NULL,
        word_count_check_json TEXT NOT NULL,
        revision_advice_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
        FOREIGN KEY (draft_id) REFERENCES chapter_drafts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS chapter_rewrites (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        chapter_id TEXT NOT NULL,
        source_draft_id TEXT NOT NULL,
        source_review_id TEXT NOT NULL,
        version_id TEXT NOT NULL,
        strategy TEXT NOT NULL,
        goals_json TEXT NOT NULL,
        content TEXT NOT NULL,
        actual_word_count INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
        FOREIGN KEY (source_draft_id) REFERENCES chapter_drafts(id) ON DELETE CASCADE,
        FOREIGN KEY (source_review_id) REFERENCES chapter_reviews(id) ON DELETE CASCADE,
        UNIQUE (chapter_id, version_id)
      );

      CREATE TABLE IF NOT EXISTS chapter_outputs (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        chapter_id TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        final_path TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS story_current_state (
        book_id TEXT PRIMARY KEY,
        current_chapter_id TEXT NOT NULL,
        recent_events_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (current_chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS hook_current_state (
        book_id TEXT NOT NULL,
        hook_id TEXT NOT NULL,
        status TEXT NOT NULL,
        updated_by_chapter_id TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (book_id, hook_id),
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (hook_id) REFERENCES hooks(id) ON DELETE CASCADE,
        FOREIGN KEY (updated_by_chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS short_term_memory_current (
        book_id TEXT PRIMARY KEY,
        chapter_id TEXT NOT NULL,
        summaries_json TEXT NOT NULL,
        recent_events_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS long_term_memory_current (
        book_id TEXT PRIMARY KEY,
        chapter_id TEXT NOT NULL,
        entries_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
      );
    `,
  },
  {
    id: '002_item_state_closure',
    sql: `
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        name TEXT NOT NULL,
        unit TEXT NOT NULL,
        type TEXT NOT NULL,
        is_unique_worldwide INTEGER NOT NULL,
        is_important INTEGER NOT NULL,
        description TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS item_current_state (
        book_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        owner_character_id TEXT,
        location_id TEXT,
        quantity INTEGER NOT NULL,
        status TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (book_id, item_id),
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        FOREIGN KEY (owner_character_id) REFERENCES characters(id) ON DELETE SET NULL,
        FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL
      );

      ALTER TABLE chapter_reviews ADD COLUMN item_issues_json TEXT NOT NULL DEFAULT '[]';
    `,
  },
] as const
