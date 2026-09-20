import { useEffect, useState } from "react";
import type { DisplayMarketState } from "./types";
import { createMarketDataController, type LiveMarketSnapshot } from "./live-market-data";

export function useLiveMarketData(
  marketStart: number,
  marketEnd: number,
  state: DisplayMarketState,
) {
  const [retryKey, setRetryKey] = useState(0);
  const [snapshot, setSnapshot] = useState<LiveMarketSnapshot>(() =>
    createMarketDataController(marketStart, marketEnd, state).getSnapshot(),
  );

  useEffect(() => {
    const controller = createMarketDataController(marketStart, marketEnd, state);
    const unsubscribe = controller.subscribe(setSnapshot);
    void controller.start();
    return () => {
      unsubscribe();
      controller.stop();
    };
  }, [marketStart, marketEnd, state, retryKey]);

  return { ...snapshot, retry: () => setRetryKey((value) => value + 1) };
}
