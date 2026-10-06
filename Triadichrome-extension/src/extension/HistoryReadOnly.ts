import { createContext, useContext } from "react";

export const HistoryReadOnlyContext = createContext(false);
export function useHistoryReadOnly(): boolean { return useContext(HistoryReadOnlyContext); }
