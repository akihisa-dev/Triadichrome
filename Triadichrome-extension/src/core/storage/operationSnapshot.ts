import { DATA_HISTORY_SQL } from "./dataHistorySchema";
import { exportTriadicDatabase, openBusinessSnapshot, openTriadicDatabase } from "./triadicDatabase";

/** Replace business data while retaining the current checkpoints and their recording deadline. */
export async function applyOperationSnapshot(bytes: Uint8Array, snapshot: Uint8Array): Promise<Uint8Array> {
  const current = await openTriadicDatabase(bytes);
  try {
    const restored = await openBusinessSnapshot(snapshot);
    try {
      const year = (database: typeof current) => database.exec("SELECT fiscal_year FROM plan WHERE id = 1")[0]!.values[0]![0];
      if (year(current) !== year(restored)) throw new Error("操作履歴の基準年度が一致しません。");
      restored.run("UPDATE triadic_metadata SET value = 'plan' WHERE key = 'document_type'");
      restored.exec(DATA_HISTORY_SQL);
      for (const row of current.exec("SELECT id, recorded_at, snapshot FROM data_history ORDER BY id")[0]?.values ?? []) {
        restored.run("INSERT INTO data_history VALUES (?, ?, ?)", row);
      }
      const state = current.exec("SELECT id, version, next_id, dirty_since, saved_at FROM data_history_state")[0]!.values[0]!;
      restored.run("INSERT INTO data_history_state VALUES (?, ?, ?, ?, ?)", state);
      return exportTriadicDatabase(restored);
    } finally { restored.close(); }
  } finally { current.close(); }
}
