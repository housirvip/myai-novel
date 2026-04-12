import type { Insertable, Kysely, Selectable, Updateable } from "kysely";

import type { DatabaseSchema } from "../schema/database.js";

type TableName = keyof DatabaseSchema;

export async function insertAndFetchById<T extends TableName>(input: {
  db: Kysely<DatabaseSchema>;
  table: T;
  values: Insertable<DatabaseSchema[T]>;
}): Promise<Selectable<DatabaseSchema[T]>> {
  const result = await input.db
    .insertInto(input.table)
    .values(input.values as never)
    .executeTakeFirstOrThrow();
  const insertedId = normalizeInsertId(result.insertId);

  if (insertedId === null) {
    throw new Error(`Insert into ${String(input.table)} did not return insert id`);
  }

  const row = await input.db
    .selectFrom(input.table)
    .selectAll()
    .where("id", "=", insertedId as never)
    .executeTakeFirst();

  if (!row) {
    throw new Error(`Inserted row not found: table=${String(input.table)}, id=${insertedId}`);
  }

  return row as Selectable<DatabaseSchema[T]>;
}

export async function updateAndFetchById<T extends TableName>(input: {
  db: Kysely<DatabaseSchema>;
  table: T;
  id: number;
  values: Updateable<DatabaseSchema[T]>;
}): Promise<Selectable<DatabaseSchema[T]> | undefined> {
  const result = await input.db
    .updateTable(input.table)
    .set(input.values as never)
    .where("id", "=", input.id as never)
    .executeTakeFirst();

  if (Number(result.numUpdatedRows) === 0) {
    return undefined;
  }

  return input.db
    .selectFrom(input.table)
    .selectAll()
    .where("id", "=", input.id as never)
    .executeTakeFirst() as Promise<Selectable<DatabaseSchema[T]> | undefined>;
}

function normalizeInsertId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  return null;
}
