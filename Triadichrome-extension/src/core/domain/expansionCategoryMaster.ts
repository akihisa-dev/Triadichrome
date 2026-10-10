export type ExpansionCategory = { id: number; categoryName: string };
export type ExpansionCategoryChange =
  | { type: "add"; categoryName: string }
  | { type: "update"; id: number; categoryName: string }
  | { type: "delete"; id: number };
export function validateExpansionCategoryChange(items: ExpansionCategory[], change: ExpansionCategoryChange): void {
  if (change.type !== "add" && !items.some(item => item.id === change.id)) throw new Error("展開区分が見つかりません。");
  if (change.type === "delete") return;
  const name = change.categoryName.trim();
  if (!name) throw new Error("展開区分名を入力してください。");
  if (items.some(item => (change.type === "add" || item.id !== change.id) && item.categoryName === name)) throw new Error("同じ展開区分名が登録されています。");
}
