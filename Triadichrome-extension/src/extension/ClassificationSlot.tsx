import { useEffect, useRef } from "react";

export function ClassificationSlot({ id, label, value, options, onChange, disabled, required = false }: {
  id: string; label: string; value: number | null | undefined;
  options: { id: number; name: string }[]; onChange: (value: number | null) => void;
  disabled: boolean; required?: boolean;
}) {
  const items = [{ id: null, name: "未選択" }, ...options];
  const index = Math.max(0, items.findIndex(item => item.id === (value ?? null)));
  const slot = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; index: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const select = (next: number) => {
    if (!disabled) onChange(items[Math.max(0, Math.min(items.length - 1, next))]!.id);
  };
  const current = useRef({ index, select, disabled });
  current.current = { index, select, disabled };
  useEffect(() => {
    let remainder = 0;
    const wheel = (event: WheelEvent) => {
      if (current.current.disabled || !event.deltaY) return;
      event.preventDefault();
      remainder += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 108 : 1);
      if (Math.abs(remainder) >= 36) {
        current.current.select(current.current.index + Math.sign(remainder));
        remainder = 0;
      }
    };
    const element = slot.current!;
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);
  return <div className="classification-field">
    <label htmlFor={id}>{label}</label>
    <div ref={slot} className="classification-slot" data-disabled={disabled}
      onPointerDown={event => {
        if (disabled || event.button !== 0 || event.target instanceof HTMLSelectElement) return;
        suppressClick.current = false;
        drag.current = { y: event.clientY, index, moved: false };
        slot.current?.querySelector("select")?.focus({ preventScroll: true });
      }}
      onPointerMove={event => {
        if (!drag.current || disabled) return;
        const distance = drag.current.y - event.clientY;
        if (Math.abs(distance) > 6) {
          drag.current.moved = true;
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        if (drag.current.moved) select(drag.current.index + Math.round(distance / 36));
      }}
      onPointerUp={event => {
        suppressClick.current = drag.current?.moved ?? false;
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { drag.current = null; suppressClick.current = true; }}
      onLostPointerCapture={() => { drag.current = null; }}
      onClickCapture={event => {
        if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; }
      }}>
      <div className="classification-reel" aria-hidden="true" style={{ transform: `translateY(${36 - index * 36}px)` }}>
        {items.map(item => <div key={item.id ?? "empty"} className={item.id === (value ?? null) ? "is-selected" : ""}>{item.name}</div>)}
      </div>
      <button type="button" className="classification-previous" aria-label={`${label}の前の候補`} disabled={disabled || index === 0} tabIndex={-1} onClick={() => select(index - 1)} />
      <select id={id} value={value ?? ""} disabled={disabled} required={required}
        onChange={event => onChange(event.target.value ? Number(event.target.value) : null)}
        onKeyDown={event => {
          const next = event.key === "ArrowUp" ? index - 1 : event.key === "ArrowDown" ? index + 1 : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : null;
          if (next !== null) { event.preventDefault(); select(next); }
        }}>
        {items.map(item => <option key={item.id ?? "empty"} value={item.id ?? ""}>{item.name}</option>)}
      </select>
      <button type="button" className="classification-next" aria-label={`${label}の次の候補`} disabled={disabled || index === items.length - 1} tabIndex={-1} onClick={() => select(index + 1)} />
    </div>
  </div>;
}
