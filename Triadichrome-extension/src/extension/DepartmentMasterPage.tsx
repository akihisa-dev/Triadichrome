import type { Industry } from "../core/domain/industryMaster";
import { type Department, type DepartmentChange } from "../core/domain/departmentMaster";
import { type AutoSaveProps } from "./useAutoSave";
import { NamedMasterPage } from "./NamedMasterPage";
type Props = AutoSaveProps & { departments: Department[]; industries: Industry[]; isSaving: boolean; onChange: (change: DepartmentChange) => Promise<void>; onBack: () => void };
export function DepartmentMasterPage({ departments, industries, onChange, ...props }: Props) {
  return <NamedMasterPage {...props} subject="部署" slug="department" coded={false} relationOptions={industries.map(item => ({ id: item.id, name: item.industryName }))}
    rows={departments.map(item => ({ id: item.id, name: item.departmentName, code: "", relationIds: item.industryIds }))}
    onChange={change => change.type === "delete" ? onChange(change) : onChange({
      type: change.type, ...(change.type === "update" ? { id: change.id } : {}), departmentName: change.name, industryIds: change.relationIds,
    } as DepartmentChange)} />;
}
