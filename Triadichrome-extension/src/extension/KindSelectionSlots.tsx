import type { KindId, KindScreen } from "../core/domain/kinds";
import { INITIAL_KINDS } from "../core/domain/kinds";
import { ClassificationSlot } from "./ClassificationSlot";
import "./KindSelectionSlots.css";

export function KindSelectionSlots({ screen, selected, disabled, onChange }: {
  screen: KindScreen; selected: KindId[]; disabled: boolean; onChange: (selected: KindId[]) => void;
}) {
  const options = INITIAL_KINDS.map(kind => ({ id: kind.id, name: kind.kindName }));
  return <div className="kind-selection-slots" role="group" aria-label={screen === "initiative-list" ? "表示種別" : "比較対象"}>
    <ClassificationSlot id={`${screen}-first-kind`} label={screen === "initiative-list" ? "種別" : "比較対象1"}
      value={selected[0]} options={options.filter(item => item.id !== selected[1])} allowEmpty={false} disabled={disabled}
      onChange={value => { if (value !== null && value !== selected[0]) onChange([value as KindId, ...selected.slice(1)]); }} />
    {screen !== "initiative-list" && <ClassificationSlot id={`${screen}-second-kind`} label="比較対象2"
      value={selected[1]} options={options.filter(item => item.id !== selected[0])} disabled={disabled}
      onChange={value => { if ((value ?? undefined) !== selected[1]) onChange([selected[0]!, ...(value === null ? [] : [value as KindId])]); }} />}
  </div>;
}
