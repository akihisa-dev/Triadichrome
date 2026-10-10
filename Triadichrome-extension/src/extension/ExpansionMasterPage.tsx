import type { ExpansionCategory } from "../core/domain/expansionCategoryMaster";
import { type Expansion, type ExpansionChange } from "../core/domain/expansionMaster";
import { type AutoSaveProps } from "./useAutoSave";
import { NamedMasterPage } from "./NamedMasterPage";
type Props = AutoSaveProps & { expansions: Expansion[]; expansionCategories: ExpansionCategory[]; usedExpansionIds: Set<number>; isSaving: boolean; onChange: (change: ExpansionChange) => Promise<void>; onBack: () => void };
export function ExpansionMasterPage({ expansions, expansionCategories, usedExpansionIds, onChange, ...props }: Props) {
  return <NamedMasterPage {...props} subject="展開" slug="expansion" coded={true} relationLabel="展開区分" relationRequired={false} relationOptions={expansionCategories.map(item => ({ id: item.id, name: item.categoryName }))} usedIds={usedExpansionIds}
    rows={expansions.map(item => ({ id: item.id, name: item.expansionName, code: item.expansionCode, relationIds: item.categoryIds ?? [] }))}
    onChange={change => change.type === "delete" ? onChange(change) : onChange({
      type: change.type, ...(change.type === "update" ? { id: change.id } : {}), expansionCode: change.code, expansionName: change.name, categoryIds: change.relationIds,
    } as ExpansionChange)} />;
}
