import { createContext, useContext } from "react";

export interface TransactionActivityValue {
  active: boolean;
  setActive: (active: boolean) => void;
}

export const TransactionActivityContext = createContext<TransactionActivityValue | null>(null);

export function useCrossTransactionActivity() {
  const value = useContext(TransactionActivityContext);
  if (!value) throw new Error("useCrossTransactionActivity must be used within CrossProvider");
  return value;
}
