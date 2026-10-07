import { type Expansion, type ExpansionChange } from "../core/domain/expansionMaster";
import { type AutoSaveProps } from "./useAutoSave";
import { NamedMasterPage } from "./NamedMasterPage";
type Props = AutoSaveProps & { expansions: Expansion[]; usedExpansionIds: Set<number>; isSaving: boolean; onChange: (change: ExpansionChange) => Promise<void>; onBack: () => void };
export function ExpansionMasterPage({ expansions, usedExpansionIds, onChange, ...props }: Props) {
  return <NamedMasterPage {...props} subject="展開" slug="expansion" coded={true} usedIds={usedExpansionIds}
    rows={expansions.map(item => ({ id: item.id, name: item.expansionName, code: item.expansionCode }))}
    onChange={change => change.type === "delete" ? onChange(change) : onChange({
      type: change.type, ...(change.type === "update" ? { id: change.id } : {}), expansionCode: change.code, expansionName: change.name,
    } as ExpansionChange)} />;
}
