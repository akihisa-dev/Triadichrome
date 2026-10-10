import { useLayoutEffect, useRef, useState } from "react";

type Props = { name: string; value: 1 | -1 | null; disabled: boolean; onChange: (value: 1 | -1) => Promise<boolean> };

/** Respond immediately, then return to the saved value after success or failure. */
export function MasterSignSelector({ name, value, disabled, onChange }: Props) {
  const [pending, setPending] = useState<1 | -1 | null>(null);
  const selected = pending ?? value;
  const busy = disabled || pending !== null;
  const select = async (sign: 1 | -1) => {
    if (busy || selected === sign) return;
    setPending(sign);
    try { await onChange(sign); }
    finally { setPending(null); }
  };
  const container = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const keyboardTarget = useRef<1 | -1 | null>(null);
  useLayoutEffect(() => {
    if (busy || keyboardTarget.current === null) return;
    container.current!.querySelector<HTMLButtonElement>(keyboardTarget.current === 1 ? "button:first-of-type" : "button:last-of-type")!.focus({ preventScroll: true });
    keyboardTarget.current = null;
  }, [busy, value]);
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
  }, [selected]);
  return <div ref={container} className="master-sign-selector" role="group" aria-label={`${name}の加減`}>
    <span ref={pill} className="pill" aria-hidden="true" />
    {([1, -1] as const).map(sign => <button key={sign} type="button" aria-label={sign === 1 ? "加算" : "減算"} aria-pressed={selected === sign} disabled={busy} onClick={() => { void select(sign); }} onKeyDown={event => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const next = event.key === "ArrowLeft" ? 1 : -1;
      container.current!.querySelector<HTMLButtonElement>(next === 1 ? "button:first-of-type" : "button:last-of-type")!.focus();
      if (selected !== next) { keyboardTarget.current = next; void select(next); }
    }}>{sign === 1 ? "＋" : "−"}</button>)}
  </div>;
}
