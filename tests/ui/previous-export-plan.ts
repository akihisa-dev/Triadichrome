import { createCurrentEmptyTestPlan } from "./empty-plan";
import { openTriadicDatabase } from "../../Triadichrome-extension/src/core/storage/triadicDatabase";
import { savePreviousAmounts } from "../../Triadichrome-extension/src/core/storage/settings";

/** Accepted 330-account plan: all 18 pairs exceed the import cell limit. */
export async function createPreviousExportPlan(): Promise<Uint8Array> {
  const db = await openTriadicDatabase(await createCurrentEmptyTestPlan());
  let bytes: Uint8Array;
  try {
    db.exec("BEGIN");
    db.run("DELETE FROM master_order");
    for (let index = 0; index < 330; index++) {
      db.run("INSERT INTO accounts (id, code, name, attribute) VALUES (?, ?, ?, 'expense')", [index + 1, String(100 + index), `確認科目${index + 1}`]);
      db.run("INSERT INTO master_order(position,account_id) VALUES (?,?)",[index,index+1]);
    }
    db.run("INSERT INTO master_order(position,aggregation_group_id) SELECT id + 329,id FROM aggregation_groups");
    db.exec("COMMIT");
    bytes = db.export();
  } finally { db.close(); }
  return savePreviousAmounts(bytes, { industryId: 1, departmentId: 1, rows: [{ accountId: 1, amounts: { 4: "123.456" } }] });
}
