import { type Database } from "sql.js";

export type Kind = { id: number; kindName: string };
export type KindChange =
  | { type: "add"; kindName: string }
  | { type: "update"; id: number; kindName: string }
  | { type: "delete"; id: number };

export function listKinds(database: Database): Kind[] {
  return (database.exec("SELECT id, name FROM kind_types ORDER BY id")[0]?.values ?? [])
    .map(([id, name]) => ({ id: Number(id), kindName: String(name) }));
}

export function validateKindChange(_items: Kind[], _change: KindChange): void {
  throw new Error("種別は固定の2件です。追加・変更・削除はできません。");
}
export async function changeKindMaster(_bytes: Uint8Array, _change: KindChange): Promise<Uint8Array> {
  throw new Error("種別は固定の2件です。追加・変更・削除はできません。");
}
