import { useEffect, useRef } from "react";
import { currentFiscalYear } from "../core/initiatives";

export function FiscalYearSlot({ value, onChange, disabled }: {
  value: number; onChange: (year: number) => void; disabled: boolean;
}) {
  const slot = useRef<HTMLDivElement>(null);
  const dragY = useRef<number | null>(null);
  const wheelDelta = useRef(0);
  const change = (year: number) => {
    if (!disabled) onChange(Math.max(1, Math.min(9998, year)));
  };
  useEffect(() => {
    const element = slot.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (disabled) return;
      event.preventDefault();
      wheelDelta.current += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 120 : 1);
      if (Math.abs(wheelDelta.current) < 32) return;
      onChange(Math.max(1, Math.min(9998, value + Math.sign(wheelDelta.current))));
      wheelDelta.current = 0;
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [value, disabled, onChange]);
  return <div className="year-picker">
    <div ref={slot} className="year-slot" role="spinbutton" aria-label="年度" aria-valuemin={1} aria-valuemax={9998}
      aria-valuenow={value} aria-valuetext={`${value}年度`} aria-disabled={disabled} tabIndex={disabled ? -1 : 0}
      onKeyDown={event => {
        const steps: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, PageUp: -10, PageDown: 10 };
        const step = steps[event.key];
        if (step !== undefined) { event.preventDefault(); change(value + step); }
      }}
      onPointerDown={event => { if (event.target instanceof Element && event.target.closest("button")) return; if (!disabled) { dragY.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); } }}
      onPointerMove={event => {
        if (dragY.current === null || Math.abs(event.clientY - dragY.current) < 24) return;
        change(value + (event.clientY < dragY.current ? 1 : -1));
        dragY.current = event.clientY;
      }}
      onPointerUp={() => { dragY.current = null; }} onPointerCancel={() => { dragY.current = null; }}>
      <button className="year-slot-adjacent" type="button" tabIndex={-1} aria-label="前の年度" disabled={disabled || value === 1} onClick={() => change(value - 1)}>{value > 1 ? value - 1 : "—"}</button>
      <div className="year-slot-selected" aria-hidden="true"><span>{value}</span><span className="year-slot-unit">年度</span></div>
      <button className="year-slot-adjacent" type="button" tabIndex={-1} aria-label="次の年度" disabled={disabled || value === 9998} onClick={() => change(value + 1)}>{value < 9998 ? value + 1 : "—"}</button>
    </div>
    <div className="year-slot-footer">
      <p className="year-period">{value}年4月–{value + 1}年3月</p>
      <button className="year-current" type="button" disabled={disabled} onClick={() => change(currentFiscalYear())}>当年度</button>
    </div>
  </div>;
}
