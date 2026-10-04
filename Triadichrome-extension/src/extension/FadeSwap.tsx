import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

type FadeSwapProps<T> = {
  value: T;
  children: (value: T) => ReactNode;
  className?: string;
};

// Keep the outgoing content until it is transparent. A new request during the
// fade uses the latest value; returning to the displayed value reverses the fade.
export function FadeSwap<T>({ value, children, className = "" }: FadeSwapProps<T>) {
  const [displayed, setDisplayed] = useState(value);
  const element = useRef<HTMLDivElement>(null);
  const leaving = !Object.is(value, displayed);

  useLayoutEffect(() => {
    // An interrupted entrance can already be transparent, so no transitionend
    // will occur in that case. Commit the latest content while it is invisible.
    if (leaving && element.current && getComputedStyle(element.current).opacity === "0") {
      setDisplayed(() => value);
    }
  }, [leaving, value]);

  return (
    <div
      ref={element}
      className={`fade-swap ${className}${leaving ? " is-leaving" : ""}`}
      inert={leaving}
      aria-hidden={leaving || undefined}
      onTransitionEnd={(event) => {
        if (leaving && event.target === event.currentTarget && event.propertyName === "opacity") {
          setDisplayed(() => value);
        }
      }}
    >
      {children(displayed)}
    </div>
  );
}
