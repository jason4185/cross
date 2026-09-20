import { useMemo, useState, type ReactNode } from "react";
import { TransactionActivityContext } from "./transaction-context";

export function CrossTransactionProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const value = useMemo(() => ({ active, setActive }), [active]);
  return (
    <TransactionActivityContext.Provider value={value}>
      {children}
    </TransactionActivityContext.Provider>
  );
}
