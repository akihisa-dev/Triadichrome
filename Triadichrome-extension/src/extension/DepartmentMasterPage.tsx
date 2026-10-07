import { type Department, type DepartmentChange } from "../core/domain/departmentMaster";
import { type AutoSaveProps } from "./useAutoSave";
import { NamedMasterPage } from "./NamedMasterPage";
type Props = AutoSaveProps & { departments: Department[]; isSaving: boolean; onChange: (change: DepartmentChange) => Promise<void>; onBack: () => void };
export function DepartmentMasterPage({ departments, onChange, ...props }: Props) {
  return <NamedMasterPage {...props} subject="部署" slug="department" coded={false}
    rows={departments.map(item => ({ id: item.id, name: item.departmentName, code: "" }))}
    onChange={change => change.type === "delete" ? onChange(change) : onChange({
      type: change.type, ...(change.type === "update" ? { id: change.id } : {}), departmentName: change.name,
    } as DepartmentChange)} />;
}
