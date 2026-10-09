import { readMasterPresentation } from "./masterPresentation";
import type { Database } from "./sqliteRuntime";
import type { Aggregation, RequiredAggregation } from "../domain/aggregations";
export function listAggregations(database: Database): Aggregation[] {
  const {ranks} = readMasterPresentation(database);
  const members = database.exec("SELECT parent_id, account_id, group_id, sign FROM aggregation_members ORDER BY parent_id, position")[0]?.values ?? [];
  return (database.exec(`SELECT id, name, required_key, display_name FROM aggregation_groups ORDER BY sort_order, id`)[0]?.values ?? []).map(([id, name, required, displayName]) => ({
    ...(ranks.has(`group:${id}`) ? {masterOrder:ranks.get(`group:${id}`)!} : {}),
    ...(displayName === null ? {} : { displayName: String(displayName) }),
    id: Number(id), name: String(name), required: required === null ? null : required as RequiredAggregation,
    members: members.filter(row => row[0] === id).map(([, accountId, groupId, sign]) => ({
      kind: accountId === null ? "group" : "account", id: Number(accountId ?? groupId), sign: Number(sign) as 1 | -1,
    })),
  }));
}
