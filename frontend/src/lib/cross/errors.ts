function textFromError(error: unknown, seen = new Set<object>(), depth = 0): string {
  if (depth > 4) return "";
  if (error instanceof Error) {
    const cause = error.cause ? textFromError(error.cause, seen, depth + 1) : "";
    return [error.message, cause].filter(Boolean).join(" ");
  }
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    if (seen.has(error)) return "";
    seen.add(error);
    const record = error as Record<string, unknown>;
    const fields = [
      record["message"],
      record["details"],
      record["reason"],
      record["shortMessage"],
    ].filter((value): value is string => typeof value === "string");
    const nested = [record["cause"], record["data"]]
      .map((value) => textFromError(value, seen, depth + 1))
      .filter(Boolean);
    return [...fields, ...nested].join(" ");
  }
  return String(error);
}

function decodedReceiptResult(error: unknown, seen = new Set<object>(), depth = 0): string {
  if (depth > 6 || error === null || error === undefined) return "";
  if (typeof error !== "object") return "";
  if (seen.has(error)) return "";
  seen.add(error);

  const record = error as Record<string, unknown>;
  const receipt = record["receipt"];
  if (typeof receipt === "object" && receipt !== null) {
    const result = (receipt as Record<string, unknown>)["result"];
    if (typeof result === "string") {
      try {
        const binary = globalThis.atob(result);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        return new TextDecoder().decode(bytes);
      } catch {
        return "";
      }
    }
  }

  for (const nested of [record["cause"], record["data"]]) {
    const decoded = decodedReceiptResult(nested, seen, depth + 1);
    if (decoded) return decoded;
  }
  return "";
}

export function contractErrorText(error: unknown) {
  return textFromError(error).toLowerCase();
}

export function isMarketNotFoundError(error: unknown) {
  return (
    contractErrorText(error).includes("market not found") ||
    decodedReceiptResult(error).toLowerCase().includes("market not found")
  );
}

export function isRateLimitError(error: unknown) {
  const message = contractErrorText(error);
  return (
    message.includes("rate limit exceeded") ||
    message.includes("30 requests per minute") ||
    message.includes("too many requests") ||
    message.includes("http 429") ||
    message.includes("status code 429") ||
    message.includes("429 too")
  );
}

export function formatCrossError(error: unknown): string {
  const message = contractErrorText(error);
  if (isRateLimitError(error))
    return "Studio Next is receiving too many requests right now. Please wait a few seconds and try again.";
  if (message.includes("market not found"))
    return "This CROSS market could not be found. It may not exist on Studio Next.";
  if (message.includes("market start must be exact utc hour"))
    return "Markets can only start on an exact UTC hour.";
  if (message.includes("market start must be next utc hour"))
    return "CROSS only allows creation of the next exact UTC-hour market.";
  if (message.includes("market already exists"))
    return "A CROSS market has already been created for the next UTC hour.";
  if (message.includes("maximum market count reached"))
    return "The protocol has reached its maximum number of markets.";
  if (message.includes("market is not open"))
    return "This market is no longer open for this action.";
  if (message.includes("betting is closed")) return "Betting has closed for this market.";
  if (message.includes("minimum bet is 1 gen")) return "The minimum stake is 1 GEN.";
  if (message.includes("maximum cumulative stake is 70 gen"))
    return "You can stake a maximum of 70 GEN in total on each market.";
  if (message.includes("wallet outcome already selected"))
    return "You already selected the other side in this market. You can only top up your existing position.";
  if (message.includes("market has not ended"))
    return "This market is still live. Settlement becomes available after the one-hour window ends.";
  if (message.includes("settlement is not ready"))
    return "The market has ended, but the 60-second candle finalization period is still in progress.";
  if (message.includes("market is not settled"))
    return "This market has not reached a settled result yet.";
  if (message.includes("payout already claimed"))
    return "You have already claimed your winnings from this market.";
  if (message.includes("position already refunded"))
    return "This position has already been refunded.";
  if (message.includes("not a winning bettor"))
    return "This position did not win, so there are no winnings to claim.";
  if (message.includes("market is not inconclusive"))
    return "Refunds are only available when a market is officially inconclusive.";
  if (message.includes("refund already claimed")) return "You have already claimed this refund.";
  if (message.includes("no bettor stake")) return "No refundable stake was found for this wallet.";
  if (message.includes("source evidence unavailable"))
    return "Settlement evidence is not available for this source yet.";
  if (message.includes("finished_with_error"))
    return "Consensus accepted the transaction, but contract execution failed. No state change was applied.";
  if (message.includes("timeout"))
    return "The transaction timed out before a successful execution result was reached.";
  if (message.includes("undetermined"))
    return "The transaction did not reach a valid consensus result.";
  if (
    message.includes("user rejected") ||
    message.includes("rejected the request") ||
    message.includes("cancelled")
  )
    return "Transaction cancelled. No changes were made.";
  if (
    message.includes("wallet network setup failed") ||
    message.includes("wallet is on chain") ||
    message.includes("unrecognized chain") ||
    message.includes("chain not added") ||
    message.includes("unsupported chain") ||
    message.includes("wallet_switchethereumchain") ||
    message.includes("wallet_addethereumchain")
  )
    return "Switch your wallet to GenLayer Studio Next (chain 61997) to continue.";
  if (
    message.includes("network") ||
    message.includes("rpc") ||
    message.includes("fetch failed") ||
    message.includes("failed to fetch")
  )
    return "Studio Next is temporarily unreachable. Please check your connection and try again.";
  return "Something went wrong while communicating with the CROSS contract. Please try again.";
}
