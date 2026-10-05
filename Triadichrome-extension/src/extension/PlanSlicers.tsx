import type { PlanContents } from "../core/initiatives";
import type { ClassificationFilter } from "../core/planTables";

export function PlanSlicers({ contents, selectedKinds, onKindsChange, filter, onFilterChange, disabled = false, includePrevious = false }: {
  contents: PlanContents; selectedKinds: number[]; onKindsChange: (kind: number) => void;
  filter: ClassificationFilter; onFilterChange: (filter: ClassificationFilter) => void; disabled?: boolean; includePrevious?: boolean;
}) {
  const kinds = [...(includePrevious ? [{ id: 0, kindName: "前年" }] : []), ...contents.kinds];
  const group = (label: string, items: { id: number; name: string }[], key: keyof ClassificationFilter) => <div className="plan-slicer" role="group" aria-label={label}>
    <span>{label}</span><button type="button" aria-pressed={filter[key] === null} disabled={disabled} onClick={() => onFilterChange({ ...filter, [key]: null })}>すべて</button>
    {items.map(item => <button type="button" key={item.id} disabled={disabled} aria-pressed={filter[key] === null || filter[key]!.includes(item.id)} onClick={() => {
      const selected = filter[key] ?? items.map(item => item.id);
      onFilterChange({ ...filter, [key]: selected.includes(item.id) ? selected.filter(id => id !== item.id) : [...selected, item.id] });
    }}>{item.name}</button>)}
  </div>;
  return <div className="plan-slicers">
    <div className="plan-slicer" role="group" aria-label="表示する種別"><span>種別</span>{kinds.map(kind => <button key={kind.id} type="button" disabled={disabled} aria-pressed={selectedKinds.includes(kind.id)} onClick={() => onKindsChange(kind.id)}>{kind.kindName}</button>)}</div>
    {group("業種", contents.industries.map(item => ({ id: item.id, name: item.industryName })), "industries")}
    {group("部署", contents.departments.map(item => ({ id: item.id, name: item.departmentName })), "departments")}
  </div>;
}
