export function ClassificationSelect({ id, label, value, options, onChange, disabled, required = false }: {
  id: string; label: string; value: number | null | undefined;
  options: { id: number; name: string }[]; onChange: (value: number | null) => void;
  disabled: boolean; required?: boolean;
}) {
  return <div className="classification-field">
    <label htmlFor={id}>{label}</label>
    <select id={id} value={value ?? ""} disabled={disabled} required={required}
      aria-invalid={required && value == null}
      onChange={event => onChange(event.target.value === "" ? null : Number(event.target.value))}>
      <option value="">未選択</option>
      {options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
  </div>;
}
