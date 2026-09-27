import assert from "node:assert/strict";
import test from "node:test";
import { cryptoAllowedOutcomes, marketIdentityKey, marketRoute, validStake } from "./identity.ts";

test("market identity keeps independent contract IDs separate", () => {
  assert.notEqual(marketIdentityKey("CROSS", 1), marketIdentityKey("CRYPTO", 1));
  assert.equal(marketRoute("CROSS", 1), "/markets/cross/1");
  assert.equal(marketRoute("CRYPTO", 1), "/markets/crypto/1");
});

test("crypto outcome sets are contract-shaped", () => {
  assert.deepEqual(cryptoAllowedOutcomes("UP_DOWN", "BTC"), ["UP", "DOWN"]);
  assert.deepEqual(cryptoAllowedOutcomes("DOMINANCE", "MAJORS"), ["BTC", "ETH", "SOL"]);
  assert.deepEqual(cryptoAllowedOutcomes("DOMINANCE", "LARGE_CAP_ALTS"), ["BNB", "XRP", "DOGE"]);
});

test("new positions require one GEN while top-ups may be smaller", () => {
  const gen = 1_000_000_000_000_000_000n;
  assert.equal(validStake(gen, gen, 0n, 70n * gen, null), true);
  assert.equal(validStake(gen / 10n, gen, 0n, 70n * gen, null), false);
  assert.equal(validStake(gen / 10n, gen, gen, 70n * gen, null), true);
  assert.equal(validStake(71n * gen, gen, 0n, 70n * gen, null), false);
});
