import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

// Measure the content, then let CSS interpolate the surrounding layout as text
// appears, disappears or wraps. The observer never measures its own output.
export function AnimatedHeight({ children }: { children: ReactNode }) {
  const content = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();

  useLayoutEffect(() => {
    const node = content.current;
    if (!node) return;
    const update = () => setHeight(node.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return <div className="animated-height" style={{ height }}><div ref={content}>{children}</div></div>;
}
