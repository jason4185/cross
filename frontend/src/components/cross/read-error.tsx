import { Button } from "@/components/ui/button";
import { formatCrossError, isRateLimitError } from "@/lib/cross/errors";
import { Panel } from "./primitives";

export function CrossReadError({
  error,
  onRetry,
  isRetrying = false,
}: {
  error: unknown;
  onRetry: () => void;
  isRetrying?: boolean;
}) {
  const rateLimited = isRateLimitError(error);
  return (
    <Panel className="mt-6 border-destructive/30 bg-destructive/5 p-4">
      <p className="text-sm font-semibold text-destructive">
        {rateLimited ? "Studio Next is temporarily busy" : "CROSS contract data unavailable"}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {rateLimited
          ? "We couldn't refresh the contract right now. Wait a few seconds and try again."
          : formatCrossError(error)}
      </p>
      <Button className="mt-3" size="sm" variant="outline" onClick={onRetry} disabled={isRetrying}>
        {isRetrying ? "Retrying…" : "Retry"}
      </Button>
    </Panel>
  );
}
