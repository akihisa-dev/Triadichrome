import { useLayoutEffect, useRef, useState } from "react";

export function GlidingKindSlot({ id, label, value, options, onChange, disabled, allowEmpty = true }: {
  id: string; label: string; value: number | undefined;
  options: { id: number; name: string }[]; onChange: (value: number | null) => void;
  disabled: boolean; allowEmpty?: boolean;
}) {
  const items = [...(allowEmpty ? [{ id: null, name: "未選択" }] : []), ...options];
  const index = Math.max(0, items.findIndex(item => item.id === (value ?? null)));
  const container = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const select = (next: number) => {
    if (!disabled) onChange(items[Math.max(0, Math.min(items.length - 1, next))]!.id);
  };
  const optionKey = items.map(item => item.id).join(",");
  useLayoutEffect(() => {
    const measure = () => {
      const button = buttons.current[index];
      if (button) setIndicator(previous => previous.left === button.offsetLeft && previous.width === button.offsetWidth
        ? previous : { left: button.offsetLeft, width: button.offsetWidth });
    };
    measure();
    const observer = new ResizeObserver(measure);
    buttons.current.forEach(button => { if (button) observer.observe(button); });
    return () => observer.disconnect();
  }, [index, optionKey]);
  return <div className="kind-selection-field">
    <label id={`${id}-label`}>{label}</label>
    <div ref={container} id={id} className="gliding-kind-slot" role="spinbutton"
      tabIndex={disabled ? -1 : 0} aria-labelledby={`${id}-label`} aria-disabled={disabled}
      aria-valuemin={0} aria-valuemax={items.length - 1} aria-valuenow={index} aria-valuetext={items[index]!.name}
      onKeyDown={event => {
        const next = ["ArrowLeft", "ArrowUp"].includes(event.key) ? index - 1
          : ["ArrowRight", "ArrowDown"].includes(event.key) ? index + 1
            : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : null;
        if (next !== null) { event.preventDefault(); select(next); }
      }}>
      <span className="gliding-kind-indicator" aria-hidden="true" style={{ ...indicator, visibility: indicator.width ? "visible" : "hidden" }} />
      {items.map((item, itemIndex) => <button key={item.id ?? "empty"} type="button"
        ref={element => { buttons.current[itemIndex] = element; }} disabled={disabled}
        aria-pressed={itemIndex === index} tabIndex={-1}
        onClick={() => { container.current?.focus({ preventScroll: true }); select(itemIndex); }}>{item.name}</button>)}
    </div>
  </div>;
}
