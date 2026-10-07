import { createContext, useContext } from "react";

export const SavedOperationRevisionContext = createContext(0);
export function useSavedOperationRevision(): number { return useContext(SavedOperationRevisionContext); }
