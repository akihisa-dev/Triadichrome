import "./ChoiceChips.css";

export function ChoiceChips({ id, label, value, options, onChange, disabled, emptyLabel }: {
  id: string; label: string; value: number[]; options: { id: number; name: string }[];
  onChange: (value: number[]) => void; disabled: boolean; emptyLabel: string;
}) {
  const selected = new Set(value);
  const toggle = (option: number) => {
    const next = new Set(value);
    next.has(option) ? next.delete(option) : next.add(option);
    onChange([...next]);
  };
  return <div className="kind-selection-field">
    <label id={`${id}-label`}>{label}</label>
    <div id={id} className="choice-chips" role="group" aria-labelledby={`${id}-label`} aria-disabled={disabled}>
      <button type="button" className={selected.size ? "chip" : "chip on"}
        title={emptyLabel} aria-pressed={selected.size === 0} disabled={disabled} onClick={() => onChange([])}>{emptyLabel}</button>
      {options.map(option => <button key={option.id} type="button" className={selected.has(option.id) ? "chip on" : "chip"}
        title={option.name} aria-pressed={selected.has(option.id)} disabled={disabled} onClick={() => toggle(option.id)}>{option.name}</button>)}
    </div>
  </div>;
}
