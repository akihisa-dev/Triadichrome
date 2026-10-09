export type Industry = { id: number; identity?: string; industryCode: string; industryName: string };
export type IndustryChange =
  | { type: "add"; industryCode: string; industryName: string }
  | { type: "update"; id: number; industryCode: string; industryName: string }
  | { type: "delete"; id: number };

export function validateIndustryChange(items: Industry[], change: IndustryChange): void {
  if (change.type !== "add" && !items.some(item => item.id === change.id)) throw new Error("業種が見つかりません。");
  if (change.type === "delete") return;
  const code = change.industryCode.trim();
  const name = change.industryName.trim();
  if (!/^[0-9]+$/.test(code)) throw new Error("業種コードは半角数字で入力してください。");
  if (!name) throw new Error("業種名を入力してください。");
  const others = items.filter(item => change.type === "add" || item.id !== change.id);
  if (others.some(item => item.industryCode === code)) throw new Error("同じ業種コードが登録されています。");
  if (others.some(item => item.industryName === name)) throw new Error("同じ業種名が登録されています。");
}
