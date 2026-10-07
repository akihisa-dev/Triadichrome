import { type Industry, type IndustryChange } from "../core/domain/industryMaster";
import { type AutoSaveProps } from "./useAutoSave";
import { NamedMasterPage } from "./NamedMasterPage";
type Props = AutoSaveProps & { industries: Industry[]; isSaving: boolean; onChange: (change: IndustryChange) => Promise<void>; onBack: () => void };
export function IndustryMasterPage({ industries, onChange, ...props }: Props) {
  return <NamedMasterPage {...props} subject="業種" slug="industry" coded={true}
    rows={industries.map(item => ({ id: item.id, name: item.industryName, code: item.industryCode }))}
    onChange={change => change.type === "delete" ? onChange(change) : onChange({
      type: change.type, ...(change.type === "update" ? { id: change.id } : {}), industryCode: change.code, industryName: change.name,
    } as IndustryChange)} />;
}
