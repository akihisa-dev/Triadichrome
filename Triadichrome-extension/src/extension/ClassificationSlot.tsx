import { useEffect, useRef } from "react";

export function ClassificationSlot({ id, label, value, options, onChange, disabled, required = false, emptyLabel = "未選択", allowEmpty = true }: {
  id: string; label: string; value: number | null | undefined;
  options: { id: number; name: string }[]; onChange: (value: number | null) => void;
  disabled: boolean; required?: boolean; emptyLabel?: string; allowEmpty?: boolean;
}) {
  const rowHeight = 24;
  const items = [...(allowEmpty ? [{ id: null, name: emptyLabel }] : []), ...options];
  const index = Math.max(0, items.findIndex(item => item.id === (value ?? null)));
  const slot = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; index: number; moved: boolean; pointerId: number; capture: HTMLElement } | null>(null);
  const suppressClick = useRef(false);
  const endDrag = (cancelled = false) => {
    const active = drag.current;
    if (!active) return;
    suppressClick.current = cancelled || active.moved;
    drag.current = null;
    if (active.capture.hasPointerCapture(active.pointerId)) active.capture.releasePointerCapture(active.pointerId);
  };
  useEffect(() => { if (disabled) endDrag(true); }, [disabled]);
  useEffect(() => () => endDrag(true), []);
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
      remainder += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rowHeight * 3 : 1);
      if (Math.abs(remainder) >= rowHeight) {
        current.current.select(current.current.index + Math.sign(remainder));
        remainder = 0;
      }
    };
    const element = slot.current!;
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);
  return <div className="classification-field">
    <label id={`${id}-label`}>{label}</label>
    <div ref={slot} id={id} className="classification-slot" data-disabled={disabled}
      role="spinbutton" tabIndex={disabled ? -1 : 0} aria-labelledby={`${id}-label`}
      aria-valuemin={0} aria-valuemax={items.length - 1} aria-valuenow={index} aria-valuetext={items[index]!.name}
      aria-disabled={disabled} aria-invalid={required && items[index]!.id === null}
      onKeyDown={event => {
        const next = event.key === "ArrowUp" ? index - 1 : event.key === "ArrowDown" ? index + 1 : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : null;
        if (next !== null) { event.preventDefault(); select(next); }
      }}
      onPointerDown={event => {
        if (disabled || event.button !== 0) return;
        suppressClick.current = false;
        endDrag(true);
        const capture = event.target instanceof HTMLElement ? event.target : event.currentTarget;
        capture.setPointerCapture(event.pointerId);
        suppressClick.current = false;
        drag.current = { y: event.clientY, index, moved: false, pointerId: event.pointerId, capture };
        slot.current?.focus({ preventScroll: true });
      }}
      onPointerMove={event => {
        if (!drag.current || drag.current.pointerId !== event.pointerId) return;
        if (disabled || (event.pointerType === "mouse" && (event.buttons & 1) === 0)) { endDrag(true); return; }
        const distance = drag.current.y - event.clientY;
        if (Math.abs(distance) > 6) {
          drag.current.moved = true;
        }
        if (drag.current.moved) select(drag.current.index + Math.round(distance / rowHeight));
      }}
      onPointerUp={event => { if (drag.current?.pointerId === event.pointerId) endDrag(); }}
      onPointerCancel={event => { if (drag.current?.pointerId === event.pointerId) endDrag(true); }}
      onLostPointerCapture={event => { if (drag.current?.pointerId === event.pointerId) endDrag(true); }}
      onClickCapture={event => {
        if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; }
      }}>
      <div className="classification-reel" aria-hidden="true" style={{ transform: `translateY(${rowHeight - index * rowHeight}px)` }}>
        {items.map(item => <div key={item.id ?? "empty"} className={item.id === (value ?? null) ? "is-selected" : ""}>{item.name}</div>)}
      </div>
      <button type="button" className="classification-previous" aria-label={`${label}の前の候補`} disabled={disabled || index === 0} tabIndex={-1} onClick={() => select(index - 1)} />
      <button type="button" className="classification-next" aria-label={`${label}の次の候補`} disabled={disabled || index === items.length - 1} tabIndex={-1} onClick={() => select(index + 1)} />
    </div>
  </div>;
}
