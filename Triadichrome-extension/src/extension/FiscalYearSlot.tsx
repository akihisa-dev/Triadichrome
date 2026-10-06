import { useEffect, useRef, useState } from "react";
import { currentFiscalYear } from "../core/initiatives";

const ROW_HEIGHT = 36;
const clamp = (year: number) => Math.max(1, Math.min(9998, year));

export function FiscalYearSlot({ value, onChange, disabled }: {
  value: number; onChange: (year: number) => void; disabled: boolean;
}) {
  const slot = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(value);
  const [moving, setMoving] = useState(false);
  const motion = useRef({ position: value, velocity: 0, target: null as number | null, frame: 0, time: 0, published: value });
  const drag = useRef<{ y: number; time: number; moved: boolean } | null>(null);
  const callback = useRef(onChange);
  callback.current = onChange;
  const reduced = useRef(false);
  const stop = () => {
    cancelAnimationFrame(motion.current.frame);
    motion.current.frame = 0;
  };
  const display = (next: number) => {
    const state = motion.current;
    state.position = clamp(next);
    setPosition(state.position);
    const year = Math.round(state.position);
    if (year !== state.published) {
      state.published = year;
      callback.current(year);
    }
  };
  const animate = () => {
    const state = motion.current;
    if (state.frame) return;
    state.time = performance.now();
    setMoving(true);
    const tick = (time: number) => {
      const dt = Math.min(0.032, (time - state.time) / 1000);
      state.time = time;
      if (state.target === null) {
        state.velocity *= Math.exp(-6.5 * dt);
        display(state.position + state.velocity * dt);
        if (state.position === 1 || state.position === 9998 || Math.abs(state.velocity) < 0.5) state.target = Math.round(state.position);
      } else {
        const speed = reduced.current ? 32 : 15;
        const remaining = state.target - state.position;
        display(state.position + remaining * (1 - Math.exp(-speed * dt)));
        if (Math.abs(remaining) < 0.002) {
          display(state.target);
          state.velocity = 0;
          state.target = null;
          state.frame = 0;
          setMoving(false);
          return;
        }
      }
      state.frame = requestAnimationFrame(tick);
    };
    state.frame = requestAnimationFrame(tick);
  };
  const select = (year: number) => {
    if (disabled) return;
    motion.current.target = clamp(year);
    motion.current.velocity = 0;
    animate();
  };
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { reduced.current = query.matches; };
    update();
    query.addEventListener("change", update);
    return () => { stop(); query.removeEventListener("change", update); };
  }, []);
  useEffect(() => {
    if (value !== motion.current.published) {
      motion.current.published = value;
      motion.current.target = value;
      animate();
    }
  }, [value]);
  useEffect(() => {
    if (disabled) {
      stop();
      display(Math.round(motion.current.position));
      motion.current.velocity = 0;
      motion.current.target = null;
      drag.current = null;
      setMoving(false);
    }
  }, [disabled]);
  useEffect(() => {
    const element = slot.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (disabled) return;
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 120 : 1);
      if (reduced.current) select(Math.round(motion.current.position) + Math.sign(delta));
      else {
        motion.current.target = null;
        motion.current.velocity = Math.max(-24, Math.min(24, motion.current.velocity + delta * 0.1));
        animate();
      }
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [disabled]);
  const release = (cancelled = false) => {
    if (!drag.current) return;
    drag.current = null;
    if (cancelled || reduced.current || Math.abs(motion.current.velocity) < 0.5) motion.current.target = Math.round(motion.current.position);
    animate();
  };
  const center = Math.round(position);
  return <div className="year-picker">
    <div ref={slot} className="year-slot" role="spinbutton" aria-label="年度" aria-valuemin={1} aria-valuemax={9998}
      aria-valuenow={value} aria-valuetext={`${value}年度`} aria-disabled={disabled} data-moving={moving} tabIndex={disabled ? -1 : 0}
      onKeyDown={event => {
        const steps: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, PageUp: -10, PageDown: 10 };
        const step = steps[event.key];
        if (step !== undefined) { event.preventDefault(); select((motion.current.target ?? Math.round(motion.current.position)) + step); }
      }}
      onPointerDown={event => {
        if (disabled || (event.target instanceof Element && event.target.closest("button"))) return;
        stop();
        motion.current.target = null;
        motion.current.velocity = 0;
        drag.current = { y: event.clientY, time: event.timeStamp, moved: false };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.focus();
        setMoving(true);
      }}
      onPointerMove={event => {
        const previous = drag.current;
        if (!previous) return;
        const delta = (previous.y - event.clientY) / ROW_HEIGHT;
        const elapsed = Math.max(8, event.timeStamp - previous.time) / 1000;
        motion.current.velocity = Math.max(-24, Math.min(24, delta / elapsed));
        display(motion.current.position + delta);
        drag.current = { y: event.clientY, time: event.timeStamp, moved: previous.moved || Math.abs(delta) > 0.05 };
      }}
      onPointerUp={event => {
        if (drag.current && event.timeStamp - drag.current.time > 80) motion.current.velocity = 0;
        release();
      }} onPointerCancel={() => release(true)} onLostPointerCapture={() => release(true)}>
      <div className="year-slot-window" aria-hidden="true" />
      <div className="year-slot-reel" aria-hidden="true">
        {Array.from({ length: 7 }, (_, index) => center + index - 3).filter(year => year >= 1 && year <= 9998).map(year => {
          const distance = year - position;
          return <div key={year} className="year-slot-number" style={{
            transform: `translateY(${distance * ROW_HEIGHT}px) rotateX(${-distance * 22}deg) scale(${1 - Math.min(0.18, Math.abs(distance) * 0.09)})`,
            opacity: Math.max(0, 1 - Math.abs(distance) * 0.55),
          }}>{year}</div>;
        })}
      </div>
      <span className="year-slot-unit" aria-hidden="true">年度</span>
      <div className="year-slot-selected" aria-hidden="true" />
      <button className="year-slot-adjacent year-slot-previous" type="button" tabIndex={-1} aria-label="前の年度" disabled={disabled || value === 1} onClick={() => select(value - 1)} />
      <button className="year-slot-adjacent year-slot-next" type="button" tabIndex={-1} aria-label="次の年度" disabled={disabled || value === 9998} onClick={() => select(value + 1)} />
    </div>
    <div className="year-slot-footer">
      <p className="year-period">{value}年4月–{value + 1}年3月</p>
      <button className="year-current" type="button" disabled={disabled} onClick={() => select(currentFiscalYear())}>当年度</button>
    </div>
  </div>;
}
