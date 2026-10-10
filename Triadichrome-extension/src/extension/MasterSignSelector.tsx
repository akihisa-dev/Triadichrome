import { useLayoutEffect, useRef } from "react";

type Props = { name: string; value: 1 | -1 | null; disabled: boolean; onChange: (value: 1 | -1) => void };

/** Selection follows the saved value, including failed saves and operation undo. */
export function MasterSignSelector({ name, value, disabled, onChange }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const keyboardTarget = useRef<1 | -1 | null>(null);
  useLayoutEffect(() => {
    if (disabled || keyboardTarget.current === null) return;
    container.current!.querySelector<HTMLButtonElement>(keyboardTarget.current === 1 ? "button:first-of-type" : "button:last-of-type")!.focus({ preventScroll: true });
    keyboardTarget.current = null;
  }, [disabled, value]);
  useLayoutEffect(() => {
    const element = container.current!;
    const update = () => {
      const active = element.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
      pill.current!.style.visibility = active ? "visible" : "hidden";
      if (active) {
        pill.current!.style.left = `${active.offsetLeft}px`;
        pill.current!.style.width = `${active.offsetWidth}px`;
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [value]);
  return <div ref={container} className="master-sign-selector" role="group" aria-label={`${name}の加減`}>
    <span ref={pill} className="pill" aria-hidden="true" />
    {([1, -1] as const).map(sign => <button key={sign} type="button" aria-label={sign === 1 ? "加算" : "減算"} aria-pressed={value === sign} disabled={disabled} onClick={() => { if (value !== sign) onChange(sign); }} onKeyDown={event => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const next = event.key === "ArrowLeft" ? 1 : -1;
      container.current!.querySelector<HTMLButtonElement>(next === 1 ? "button:first-of-type" : "button:last-of-type")!.focus();
      if (value !== next) { keyboardTarget.current = next; onChange(next); }
    }}>{sign === 1 ? "＋" : "−"}</button>)}
  </div>;
}
