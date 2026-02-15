export const SQL = {
	CREATE_TABLE: `
      CREATE TABLE IF NOT EXISTS kv (
        pk BLOB PRIMARY KEY,
        key_json TEXT NOT NULL,
        value_json TEXT,
        version TEXT NOT NULL,
        date_created INTEGER,
        date_updated INTEGER,
        date_expired INTEGER
      ) WITHOUT ROWID;
    `,
	MIGRATE_ADD_VERSION: "ALTER TABLE kv ADD COLUMN version TEXT",
	MIGRATE_ADD_DATE_CREATED: "ALTER TABLE kv ADD COLUMN date_created INTEGER",
	MIGRATE_ADD_DATE_UPDATED: "ALTER TABLE kv ADD COLUMN date_updated INTEGER",
	MIGRATE_ADD_DATE_EXPIRED: "ALTER TABLE kv ADD COLUMN date_expired INTEGER",
	SELECT_GET: "SELECT value_json, version, date_expired FROM kv WHERE pk = ?",
	SELECT_META_CHECK: "SELECT version, date_expired FROM kv WHERE pk = ?",
	UPSERT: `
      INSERT INTO kv (pk, key_json, value_json, version, date_created, date_updated, date_expired)
      VALUES ($pk, $key_json, $value_json, $version, $now, $now, $date_expired)
      ON CONFLICT(pk) DO UPDATE SET
        value_json = excluded.value_json,
        version = excluded.version,
        date_updated = excluded.date_updated,
        date_expired = excluded.date_expired
    `,
	DELETE: "DELETE FROM kv WHERE pk = ?",
	SELECT_LIST_BASE:
		"SELECT key_json, value_json, version, date_expired FROM kv",
};
