import type { ExpansionCategory, ExpansionCategoryChange } from "../core/domain/expansionCategoryMaster";
import type { AutoSaveProps } from "./useAutoSave";
import { NamedMasterPage } from "./NamedMasterPage";
type Props = AutoSaveProps & { expansionCategories: ExpansionCategory[]; usedIds: Set<number>; isSaving: boolean; onChange: (change: ExpansionCategoryChange) => Promise<void>; onBack: () => void };
export function ExpansionCategoryMasterPage({ expansionCategories, onChange, ...props }: Props) {
  return <NamedMasterPage {...props} subject="展開区分" slug="expansion-category"
    rows={expansionCategories.map(item => ({ id: item.id, name: item.categoryName, code: "" }))}
    onChange={change => change.type === "delete" ? onChange(change) : onChange({
      type: change.type, ...(change.type === "update" ? { id: change.id } : {}), categoryName: change.name,
    } as ExpansionCategoryChange)} />;
}
