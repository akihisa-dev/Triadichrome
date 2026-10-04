import { useCallback, useState, type FocusEvent, type PointerEvent } from "react";

export function useSidebar() {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const expanded = pinned || (!dismissed && (hovered || focused));

  const collapse = useCallback(() => {
    setPinned(false);
    setFocused(false);
    // Closing under the pointer must hold until it leaves and re-enters.
    setDismissed(true);
  }, []);

  return {
    expanded,
    collapse,
    pin: () => { setPinned(true); setDismissed(false); },
    onPointerEnter: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType === "touch") return;
      setHovered(true);
      setDismissed(false);
    },
    onPointerLeave: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType === "touch") return;
      setHovered(false);
      setDismissed(false);
    },
    onFocusCapture: (event: FocusEvent<HTMLElement>) => {
      // Mouse/touch focus must not keep a hover-open sidebar expanded.
      const keyboardFocus = event.target.matches(":focus-visible");
      setFocused(keyboardFocus);
      if (keyboardFocus) setDismissed(false);
    },
    onBlurCapture: (event: FocusEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
    },
  };
}
