import { type PeriodType, type PeriodTypeChange } from "../core/domain/periodMaster";
import { type AutoSaveProps } from "./useAutoSave";
import { NamedMasterPage } from "./NamedMasterPage";
type Props = AutoSaveProps & { periodTypes: PeriodType[]; isSaving: boolean; onChange: (change: PeriodTypeChange) => Promise<void>; onBack: () => void };
export function PeriodMasterPage({ periodTypes, onChange, ...props }: Props) {
  return <NamedMasterPage {...props} subject="期間" slug="period" coded={false}
    rows={periodTypes.map(item => ({ id: item.id, name: item.periodName, code: "" }))}
    onChange={change => change.type === "delete" ? onChange(change) : onChange({
      type: change.type, ...(change.type === "update" ? { id: change.id } : {}), periodName: change.name,
    } as PeriodTypeChange)} />;
}
