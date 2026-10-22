import { createContext, useContext } from "react";
import type { Store } from "./api";

export interface StoreContextValue {
  store: Store;
  setStore: (store: Store) => void;
  logout: () => Promise<void>;
}

export const StoreContext = createContext<StoreContextValue | null>(null);

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore 必须在 StoreGate 内使用");
  return value;
}
