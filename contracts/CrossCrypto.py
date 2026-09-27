# v0.3.0
# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }

import json

import genlayer as gl
from genlayer import Address, u256
from genlayer.storage import TreeMap


TYPE_UP_DOWN = 0
TYPE_DOMINANCE = 1
TYPE_NAMES = ("UP_DOWN", "DOMINANCE")

UP = 0
DOWN = 1
ASSET_OUTCOME_BASE = 2
OUTCOME_NONE = 255
ASSETS = ("BTC", "ETH", "SOL", "BNB", "XRP", "DOGE")
MAJORS = (0, 1, 2)
LARGE_CAP_ALTS = (3, 4, 5)
CATEGORIES = ("MAJORS", "LARGE_CAP_ALTS")
DURATIONS = (3600, 7200)
SOURCE_BINANCE = "BINANCE"
SOURCE_GATE = "GATE"
SOURCE_BITGET = "BITGET"
SOURCES = (SOURCE_BINANCE, SOURCE_GATE, SOURCE_BITGET)
#Market Binance /fapi/v1/klines (ms; row 0/1/4/6=t/o/c/close-time)
#Gate /api/v4/futures/usdt/candlesticks (s; object t/o/c/h/l; from=to=T)
#Bitget /api/v3/market/candles (ms; row 0/1/4=t/o/c; type=market)
BINANCE_SYMBOLS = ("BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT")
GATE_SYMBOLS = ("BTC_USDT", "ETH_USDT", "SOL_USDT", "BNB_USDT", "XRP_USDT", "DOGE_USDT")
BITGET_SYMBOLS = ("BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT")
STATE_OPEN = "OPEN"
STATE_PENDING = "SETTLEMENT_PENDING"
STATE_SETTLED = "SETTLED"
STATE_INCONCLUSIVE = "INCONCLUSIVE"
REASON_NONE = ""
REASON_CONSENSUS = "CONSENSUS"
REASON_NO_CONSENSUS = "NO_CONSENSUS"
REASON_EXPIRED = "EXPIRED"
REASON_ZERO_BACKED = "ZERO_BACKED_WINNER"
SOURCE_VALID = "VALID"
SOURCE_TIE = "TIE"
SOURCE_UNAVAILABLE = "UNAVAILABLE"
SOURCE_INVALID = "INVALID"
ONE_HOUR = 3600
SETTLEMENT_GRACE_SECONDS = 60
SETTLEMENT_RETRY_WINDOW_SECONDS = 18000
GEN_SCALE = 1_000_000_000_000_000_000
MIN_BET = GEN_SCALE
MAX_BET_PER_MARKET = 70 * GEN_SCALE
PRICE_SCALE = GEN_SCALE
MAX_RESPONSE_BYTES = 65_536
MAX_PAGE_SIZE = 50
MAX_SOURCE_ATTEMPTS = 3
MAX_MARKETS = 1024
MAX_POSITIONS = 100_000
U256_MAX = 2**256 - 1
@gl.evm.contract_interface
class _Recipient:
    class View:
        pass
    class Write:
        pass
def _is_u256(value) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= U256_MAX
def _add_u256(left: int, right: int) -> int:
    if left < 0 or right < 0 or left > U256_MAX or right > U256_MAX - left:
        raise gl.vm.UserError("u256 addition overflow")
    return left + right
def _mul_u256(left: int, right: int) -> int:
    if left < 0 or right < 0 or left > U256_MAX or right > U256_MAX:
        raise gl.vm.UserError("u256 multiplication overflow")
    if right and left > U256_MAX // right:
        raise gl.vm.UserError("u256 multiplication overflow")
    return left * right
def _mul_div_u256(numerator: int, multiplier: int, denominator: int) -> int:
    if numerator < 0 or multiplier < 0 or denominator <= 0 or numerator > denominator:
        raise gl.vm.UserError("invalid payout arithmetic")
    quotient = 0
    remainder = 0
    for bit_index in range(256):
        bit = (numerator >> (255 - bit_index)) & 1
        carry = remainder * 2 + (multiplier if bit else 0)
        added, remainder = divmod(carry, denominator)
        quotient = quotient * 2 + added
    if quotient > U256_MAX:
        raise gl.vm.UserError("u256 payout overflow")
    return quotient
def _digits(text: str, start: int, end: int) -> int:
    if start < 0 or end > len(text) or start >= end:
        return -1
    value = 0
    for index in range(start, end):
        char = text[index]
        if char < "0" or char > "9":
            return -1
        value = value * 10 + ord(char) - ord("0")
    return value
def _days_since_epoch(year: int, month: int, day: int) -> int:
    adjusted = year - 1 if month <= 2 else year
    era = adjusted // 400
    year_of_era = adjusted - era * 400
    month_piece = month - 3 if month > 2 else month + 9
    day_of_year = (153 * month_piece + 2) // 5 + day - 1
    return era * 146097 + year_of_era * 365 + year_of_era // 4 - year_of_era // 100 + day_of_year - 719468
def _month_days(year: int, month: int) -> int:
    if month == 2:
        return 29 if year % 400 == 0 or (year % 4 == 0 and year % 100 != 0) else 28
    return 30 if month in (4, 6, 9, 11) else 31
def _parse_datetime(value) -> int:
    text = str(value)
    if len(text) < 20 or len(text) > 64:
        return -1
    if text[4] != "-" or text[7] != "-" or text[10] != "T" or text[13] != ":" or text[16] != ":":
        return -1
    year = _digits(text, 0, 4)
    month = _digits(text, 5, 7)
    day = _digits(text, 8, 10)
    hour = _digits(text, 11, 13)
    minute = _digits(text, 14, 16)
    second = _digits(text, 17, 19)
    if year < 1970 or month < 1 or month > 12 or day < 1 or day > _month_days(year, month):
        return -1
    if hour < 0 or hour > 23 or minute < 0 or minute > 59 or second < 0 or second > 59:
        return -1
    index = 19
    if index < len(text) and text[index] == ".":
        index += 1
        fraction_start = index
        for _ in range(18):
            if index < len(text) and "0" <= text[index] <= "9":
                index += 1
            else:
                break
        if index == fraction_start or (index < len(text) and "0" <= text[index] <= "9"):
            return -1
    if index >= len(text):
        return -1
    if text[index] == "Z" and index + 1 == len(text):
        offset = 0
    elif text[index] in ("+", "-") and index + 6 == len(text) and text[index + 3] == ":":
        offset_hour = _digits(text, index + 1, index + 3)
        offset_minute = _digits(text, index + 4, index + 6)
        if offset_hour < 0 or offset_minute < 0 or offset_hour > 23 or offset_minute > 59:
            return -1
        offset = offset_hour * 3600 + offset_minute * 60
        if text[index] == "-":
            offset = -offset
    else:
        return -1
    return _days_since_epoch(year, month, day) * 86400 + hour * 3600 + minute * 60 + second - offset
def _now() -> int:
    try:
        current = _parse_datetime(gl.message.raw["datetime"])
    except Exception:
        try:
            current = _parse_datetime(gl.message_raw["datetime"])
        except Exception:
            current = -1
    if current < 0:
        raise gl.vm.UserError("invalid transaction time")
    return current
def _is_digits(value: str) -> bool:
    if not value:
        return False
    for char in value:
        if char < "0" or char > "9":
            return False
    return True
def _parse_integer(value):
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if 0 <= value <= U256_MAX else None
    if not isinstance(value, str) or len(value) > 40 or not _is_digits(value):
        return None
    number = int(value)
    return number if number <= U256_MAX else None
def _parse_price(value):
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        text = str(value)
    elif isinstance(value, str):
        text = value
    else:
        return None
    if not text or len(text) > 40 or text.startswith(("+", "-")):
        return None
    pieces = text.split(".")
    if len(pieces) > 2 or not _is_digits(pieces[0]) or len(pieces[0]) > 21:
        return None
    fraction = pieces[1] if len(pieces) == 2 else ""
    if len(pieces) == 2 and not fraction:
        return None
    if fraction and (not _is_digits(fraction) or len(fraction) > 18):
        return None
    scaled = int(pieces[0]) * PRICE_SCALE + int((fraction + "0" * 18)[:18])
    if scaled <= 0 or scaled > 10**39:
        return None
    canonical_fraction = fraction.rstrip("0")
    canonical = str(int(pieces[0]))
    if canonical_fraction:
        canonical += "." + canonical_fraction
    return scaled, canonical
def _return_parts(open_scaled: int, close_scaled: int):
    return close_scaled - open_scaled, open_scaled
def _compare_fractions(left, right) -> int:
    left_value = left[0] * right[1]
    right_value = right[0] * left[1]
    return 1 if left_value > right_value else -1 if left_value < right_value else 0
def _asset_id(asset: str) -> int:
    if not isinstance(asset, str):
        raise gl.vm.UserError("asset must be a string")
    for index in range(len(ASSETS)):
        if asset == ASSETS[index]:
            return index
    raise gl.vm.UserError("unsupported asset")
def _category_id(category: str) -> int:
    if not isinstance(category, str):
        raise gl.vm.UserError("category must be a string")
    for index in range(len(CATEGORIES)):
        if category == CATEGORIES[index]:
            return index
    raise gl.vm.UserError("unsupported dominance category")
def _duration(duration_seconds: u256) -> int:
    if duration_seconds not in DURATIONS:
        raise gl.vm.UserError("duration must be 1H or 2H")
    return duration_seconds
def _required_assets(market_type: int, subject: int):
    if market_type == TYPE_UP_DOWN:
        return (subject,)
    return MAJORS if subject == 0 else LARGE_CAP_ALTS
def _type_id(value) -> int:
    if isinstance(value, int) and not isinstance(value, bool) and value in (TYPE_UP_DOWN, TYPE_DOMINANCE):
        return value
    if isinstance(value, str):
        for index in range(len(TYPE_NAMES)):
            if value == TYPE_NAMES[index]:
                return index
    raise gl.vm.UserError("invalid market type")
def _outcome_name(outcome: int) -> str:
    if outcome == UP:
        return "UP"
    if outcome == DOWN:
        return "DOWN"
    if ASSET_OUTCOME_BASE <= outcome < ASSET_OUTCOME_BASE + len(ASSETS):
        return ASSETS[outcome - ASSET_OUTCOME_BASE]
    raise gl.vm.UserError("invalid outcome")
def _is_outcome(outcome) -> bool:
    return isinstance(outcome, int) and not isinstance(outcome, bool) and 0 <= outcome < ASSET_OUTCOME_BASE + len(ASSETS)
def _outcome_for_market(market_type: int, subject: int, value: str) -> int:
    if not isinstance(value, str):
        raise gl.vm.UserError("outcome must be a string")
    if market_type == TYPE_UP_DOWN:
        if value == "UP":
            return UP
        if value == "DOWN":
            return DOWN
        raise gl.vm.UserError("UP/DOWN market accepts only UP or DOWN")
    for asset in _required_assets(market_type, subject):
        if value == ASSETS[asset]:
            return ASSET_OUTCOME_BASE + asset
    raise gl.vm.UserError("outcome is not valid for this category")
def _response_json(response):
    try:
        status = int(response.status)
        if status >= 500 or status in (408, 425, 429):
            return SOURCE_UNAVAILABLE, None
        body = response.body
        if not isinstance(body, bytes) or len(body) == 0 or len(body) > MAX_RESPONSE_BYTES:
            return SOURCE_INVALID, None
        if status != 200:
            return SOURCE_INVALID, None
        return "OK", json.loads(body.decode("utf-8"))
    except Exception:
        return SOURCE_INVALID, None
def _request_json(url: str):
    try:
        response = gl.nondet.web.get(url, headers={"Accept": "application/json"})
    except Exception:
        return SOURCE_UNAVAILABLE, None
    return _response_json(response)
def _binance_candles(payload, timestamps):
    if not isinstance(payload, list) or len(payload) != len(timestamps):
        return None
    candles = []
    for index in range(len(timestamps)):
        row = payload[index]
        timestamp_ms = timestamps[index]
        if not isinstance(row, list) or len(row) != 12 or _parse_integer(row[0]) != timestamp_ms or _parse_integer(row[6]) != timestamp_ms + 3_599_999:
            return None
        opening = _parse_price(row[1])
        high = _parse_price(row[2])
        low = _parse_price(row[3])
        closing = _parse_price(row[4])
        if opening is None or high is None or low is None or closing is None:
            return None
        candles.append((timestamp_ms, opening, closing))
    return candles
def _gate_candles(payload, timestamps):
    if not isinstance(payload, list) or len(payload) != len(timestamps):
        return None
    candles = []
    for index in range(len(timestamps)):
        row = payload[index]
        timestamp = timestamps[index]
        if not isinstance(row, dict) or _parse_integer(row.get("t")) != timestamp:
            return None
        opening = _parse_price(row.get("o"))
        high = _parse_price(row.get("h"))
        low = _parse_price(row.get("l"))
        closing = _parse_price(row.get("c"))
        if opening is None or high is None or low is None or closing is None:
            return None
        candles.append((timestamp, opening, closing))
    return candles
def _bitget_candles(payload, timestamps, symbol: str):
    if not isinstance(payload, dict) or payload.get("code") != "00000" or "data" not in payload:
        return None
    if payload.get("category", "USDT-FUTURES") != "USDT-FUTURES" or payload.get("symbol", symbol) != symbol or payload.get("interval", "1H") != "1H" or payload.get("type", "market") not in ("market", ""):
        return None
    rows = payload["data"]
    if not isinstance(rows, list) or len(rows) != len(timestamps):
        return None
    candles = []
    for index in range(len(timestamps)):
        row = rows[index]
        timestamp_ms = timestamps[index]
        if not isinstance(row, list) or len(row) != 7 or _parse_integer(row[0]) != timestamp_ms:
            return None
        opening = _parse_price(row[1])
        high = _parse_price(row[2])
        low = _parse_price(row[3])
        closing = _parse_price(row[4])
        if opening is None or high is None or low is None or closing is None:
            return None
        candles.append((timestamp_ms, opening, closing))
    return candles
def _symbol(source: str, asset: int) -> str:
    if source == SOURCE_BINANCE:
        return BINANCE_SYMBOLS[asset]
    if source == SOURCE_GATE:
        return GATE_SYMBOLS[asset]
    if source == SOURCE_BITGET:
        return BITGET_SYMBOLS[asset]
    raise gl.vm.UserError("invalid source")
def _fetch_candles(source: str, asset: int, start_seconds: int, count: int):
    end_seconds = _add_u256(start_seconds, _mul_u256(count, ONE_HOUR))
    start_ms = _mul_u256(start_seconds, 1000)
    end_ms = _mul_u256(end_seconds, 1000)
    timestamps = tuple(_add_u256(start_seconds, index * ONE_HOUR) for index in range(count))
    timestamps_ms = tuple(_mul_u256(timestamp, 1000) for timestamp in timestamps)
    symbol = _symbol(source, asset)
    if source == SOURCE_BINANCE:
        url = "https://fapi.binance.com/fapi/v1/klines?symbol=" + symbol + "&interval=1h&startTime=" + str(start_ms) + "&endTime=" + str(end_ms - 1) + "&limit=" + str(count)
        status, payload = _request_json(url)
        if status != "OK":
            return status, None
        rows = _binance_candles(payload, timestamps_ms)
    elif source == SOURCE_GATE:
        gate_end = _add_u256(start_seconds, (count - 1) * ONE_HOUR)
        url = "https://api.gateio.ws/api/v4/futures/usdt/candlesticks?contract=" + symbol + "&interval=1h&from=" + str(start_seconds) + "&to=" + str(gate_end)
        status, payload = _request_json(url)
        if status != "OK":
            return status, None
        rows = _gate_candles(payload, timestamps)
    elif source == SOURCE_BITGET:
        url = "https://api.bitget.com/api/v3/market/candles?category=USDT-FUTURES&symbol=" + symbol + "&interval=1H&type=market&startTime=" + str(start_ms) + "&endTime=" + str(end_ms - 1) + "&limit=" + str(count)
        status, payload = _request_json(url)
        if status != "OK":
            return status, None
        rows = _bitget_candles(payload, timestamps_ms, symbol)
    else:
        return SOURCE_INVALID, None
    return ("OK", rows) if rows is not None else (SOURCE_INVALID, None)
def _empty_asset(asset: int):
    return {
        "asset": ASSETS[asset], "asset_id": asset, "candles": [], "open": "", "close": "", "valid": False,
    }
def _empty_source_result(source: str, market_type: int, subject: int, duration: int, start: int, status: str, reason: str):
    return {
        "source": source, "market_type": TYPE_NAMES[market_type], "subject": ASSETS[subject] if market_type == TYPE_UP_DOWN else CATEGORIES[subject],
        "duration_seconds": duration, "market_start": start,
        "source_status": status, "source_winner": "",
        "source_winner_id": OUTCOME_NONE, "reason": reason,
        "assets": [_empty_asset(asset) for asset in _required_assets(market_type, subject)],
    }
def _source_once(source: str, market_type: int, subject: int, duration: int, start: int):
    required = _required_assets(market_type, subject)
    candle_count = 1 if duration == ONE_HOUR else 2
    rows = []
    for asset in required:
        status, candles = _fetch_candles(source, asset, start, candle_count)
        if status != "OK" or not isinstance(candles, list) or len(candles) != candle_count:
            return _empty_source_result(source, market_type, subject, duration, start, status, "ASSET_" + str(asset) + "_CANDLES")
        _, first_open, _ = candles[0]
        _, _, last_close = candles[-1]
        numerator, denominator = _return_parts(first_open[0], last_close[0])
        evidence_candles = [{"t": str(candle[0]), "o": candle[1][1], "c": candle[2][1]} for candle in candles]
        rows.append({
            "asset": ASSETS[asset], "asset_id": asset, "candles": evidence_candles,
            "open": first_open[1], "close": last_close[1], "valid": True,
            "_return": (numerator, denominator),
        })
    if market_type == TYPE_UP_DOWN:
        comparison = 1 if rows[0]["_return"][0] > 0 else -1 if rows[0]["_return"][0] < 0 else 0
        winner = UP if comparison > 0 else DOWN if comparison < 0 else OUTCOME_NONE
    else:
        winner_asset = -1
        comparison = 0
        for index in range(len(rows)):
            current = rows[index]["_return"]
            if winner_asset < 0:
                winner_asset = index
                comparison = 1
            else:
                relation = _compare_fractions(current, rows[winner_asset]["_return"])
                if relation > 0:
                    winner_asset = index
                    comparison = 1
                elif relation == 0:
                    comparison = 0
        winner = OUTCOME_NONE if comparison == 0 else ASSET_OUTCOME_BASE + rows[winner_asset]["asset_id"]
    for row in rows:
        del row["_return"]
    return {
        "source": source, "market_type": TYPE_NAMES[market_type], "subject": ASSETS[subject] if market_type == TYPE_UP_DOWN else CATEGORIES[subject],
        "duration_seconds": duration, "market_start": start,
        "source_status": SOURCE_TIE if winner == OUTCOME_NONE else SOURCE_VALID,
        "source_winner": "" if winner == OUTCOME_NONE else _outcome_name(winner),
        "source_winner_id": winner, "reason": "OK", "assets": rows,
    }
def _fetch_source(source: str, market_type: int, subject: int, duration: int, start: int):
    for _ in range(MAX_SOURCE_ATTEMPTS):
        try:
            result = _source_once(source, market_type, subject, duration, start)
        except Exception:
            result = _empty_source_result(source, market_type, subject, duration, start, SOURCE_INVALID, "PARSER_ERROR")
        if result["source_status"] != SOURCE_UNAVAILABLE:
            return result
    return _empty_source_result(source, market_type, subject, duration, start, SOURCE_UNAVAILABLE, "RETRIES_EXHAUSTED")
def _consensus_winner(results) -> int:
    for candidate in range(ASSET_OUTCOME_BASE + len(ASSETS)):
        votes = 0
        for result in results:
            if isinstance(result, dict) and result.get("source_status") == SOURCE_VALID and result.get("source_winner_id") == candidate:
                votes += 1
        if votes >= 2:
            return candidate
    return OUTCOME_NONE
def _evidence_key(evidence: dict, source: str, market_type: int, subject: int, duration: int, start: int):
    if not isinstance(evidence, dict) or evidence.get("source") != source:
        return None
    if evidence.get("market_type") != TYPE_NAMES[market_type] or evidence.get("duration_seconds") != duration or evidence.get("market_start") != start:
        return None
    if evidence.get("subject") != (ASSETS[subject] if market_type == TYPE_UP_DOWN else CATEGORIES[subject]):
        return None
    status = evidence.get("source_status")
    winner = evidence.get("source_winner")
    winner_id = evidence.get("source_winner_id")
    reason = evidence.get("reason")
    if status not in (SOURCE_VALID, SOURCE_TIE, SOURCE_INVALID, SOURCE_UNAVAILABLE) or not isinstance(winner, str) or not isinstance(reason, str) or not reason:
        return None
    if status == SOURCE_VALID:
        if not _is_outcome(winner_id) or winner != _outcome_name(winner_id):
            return None
    elif winner != "" or winner_id != OUTCOME_NONE:
        return None
    required = _required_assets(market_type, subject)
    rows = evidence.get("assets")
    if not isinstance(rows, list) or len(rows) != len(required):
        return None
    expected_count = 1 if duration == ONE_HOUR else 2
    parsed = []
    for index in range(len(required)):
        asset = required[index]
        row = rows[index]
        if not isinstance(row, dict) or row.get("asset_id") != asset or row.get("asset") != ASSETS[asset]:
            return None
        valid = row.get("valid")
        if not isinstance(valid, bool):
            return None
        if status in (SOURCE_VALID, SOURCE_TIE):
            if not valid:
                return None
            candles = row.get("candles")
            if not isinstance(candles, list) or len(candles) != expected_count:
                return None
            for candle_index in range(expected_count):
                candle = candles[candle_index]
                expected_seconds = _add_u256(start, candle_index * ONE_HOUR)
                expected_timestamp = expected_seconds if source == SOURCE_GATE else _mul_u256(expected_seconds, 1000)
                if not isinstance(candle, dict) or candle.get("t") != str(expected_timestamp):
                    return None
                opening = _parse_price(candle.get("o"))
                closing = _parse_price(candle.get("c"))
                if opening is None or closing is None or candle.get("o") != opening[1] or candle.get("c") != closing[1]:
                    return None
            first = _parse_price(row.get("open"))
            closing = _parse_price(row.get("close"))
            if first is None or closing is None or row.get("open") != first[1] or row.get("close") != closing[1]:
                return None
            if row.get("open") != candles[0]["o"] or row.get("close") != candles[-1]["c"]:
                return None
            parsed.append(_return_parts(first[0], closing[0]))
        else:
            if valid or row.get("candles") != [] or row.get("open") != "" or row.get("close") != "":
                return None
    if status in (SOURCE_VALID, SOURCE_TIE):
        if market_type == TYPE_UP_DOWN:
            relation = 1 if parsed[0][0] > 0 else -1 if parsed[0][0] < 0 else 0
            expected_winner = UP if relation > 0 else DOWN if relation < 0 else OUTCOME_NONE
        else:
            best = 0
            tie = False
            for index in range(1, len(parsed)):
                relation = _compare_fractions(parsed[index], parsed[best])
                if relation > 0:
                    best = index
                    tie = False
                elif relation == 0:
                    tie = True
            expected_winner = OUTCOME_NONE if tie else ASSET_OUTCOME_BASE + required[best]
        expected_status = SOURCE_TIE if expected_winner == OUTCOME_NONE else SOURCE_VALID
        if status != expected_status or winner_id != expected_winner or (winner_id == OUTCOME_NONE and winner != ""):
            return None
    return json.dumps(evidence, separators=(",", ":"), sort_keys=True)
def _proposal_valid(proposal: dict, market_type: int, subject: int, duration: int, start: int) -> bool:
    if not isinstance(proposal, dict) or not isinstance(proposal.get("source_results"), list) or len(proposal["source_results"]) != len(SOURCES):
        return False
    for index in range(len(SOURCES)):
        if _evidence_key(proposal["source_results"][index], SOURCES[index], market_type, subject, duration, start) is None:
            return False
    winner = _consensus_winner(proposal["source_results"])
    count = 2 if winner != OUTCOME_NONE else 0
    return proposal.get("consensus_winner") == winner and proposal.get("consensus_count") == count
def _settlement_proposal(market_type: int, subject: int, duration: int, start: int) -> dict:
    def leader_fn():
        results = [_fetch_source(source, market_type, subject, duration, start) for source in SOURCES]
        winner = _consensus_winner(results)
        return {"source_results": results, "consensus_winner": winner, "consensus_count": 2 if winner != OUTCOME_NONE else 0}
    def validator_fn(leaders_result) -> bool:
        try:
            if not isinstance(leaders_result, gl.vm.Return) or not isinstance(leaders_result.calldata, dict):
                return False
            leader = leaders_result.calldata
            if not _proposal_valid(leader, market_type, subject, duration, start):
                return False
            validator = leader_fn()
            if not _proposal_valid(validator, market_type, subject, duration, start):
                return False
            for index in range(len(SOURCES)):
                source = SOURCES[index]
                if _evidence_key(leader["source_results"][index], source, market_type, subject, duration, start) != _evidence_key(validator["source_results"][index], source, market_type, subject, duration, start):
                    return False
            return leader.get("consensus_winner") == validator.get("consensus_winner") and leader.get("consensus_count") == validator.get("consensus_count")
        except Exception:
            return False
    return gl.vm.run_nondet(leader_fn, validator_fn)
class CrossCrypto(gl.contract.Contract):
    market_count: u256
    position_count: u256
    market_type: TreeMap[u256, u256]
    market_subject: TreeMap[u256, u256]
    market_duration: TreeMap[u256, u256]
    market_start_seconds: TreeMap[u256, u256]
    market_end_seconds: TreeMap[u256, u256]
    market_state: TreeMap[u256, str]
    market_winner: TreeMap[u256, u256]
    market_reason: TreeMap[u256, str]
    market_identity: TreeMap[str, u256]
    market_source_evidence: TreeMap[str, str]
    market_pool: TreeMap[u256, u256]
    market_winning_pool: TreeMap[u256, u256]
    market_claimed_pool: TreeMap[u256, u256]
    market_claimed_winning_stake: TreeMap[u256, u256]
    market_refunded_pool: TreeMap[u256, u256]
    market_settlement_deadline: TreeMap[u256, u256]
    outcome_pool: TreeMap[str, u256]
    bettor_outcome: TreeMap[str, u256]
    bettor_stake: TreeMap[str, u256]
    bettor_claimed: TreeMap[str, bool]
    bettor_refunded: TreeMap[str, bool]
    user_market_count: TreeMap[str, u256]
    user_market_index: TreeMap[str, u256]
    def __init__(self):
        self.market_count = 0
        self.position_count = 0
    def _require_market(self, market_id: u256) -> None:
        if not _is_u256(market_id) or market_id == 0 or market_id > self.market_count:
            raise gl.vm.UserError("market not found")
    def _identity_key(self, market_type: int, subject: int, duration: int, start: int) -> str:
        return str(market_type) + ":" + str(subject) + ":" + str(duration) + ":" + str(start)
    def _position_key(self, market_id: u256, user: Address) -> str:
        return str(market_id) + ":" + user.as_hex
    def _outcome_key(self, market_id: u256, outcome: int) -> str:
        return str(market_id) + ":" + str(outcome)
    def _user_market_key(self, user: Address, index: u256) -> str:
        return user.as_hex + ":" + str(index)
    def _source_key(self, market_id: u256, source: str) -> str:
        return str(market_id) + ":" + source
    def _send_value(self, recipient: Address, amount: u256) -> None:
        _Recipient(recipient).emit_transfer(value=amount)
    def _allowed_ids(self, market_id: u256):
        market_type = self.market_type[market_id]
        subject = self.market_subject[market_id]
        return (UP, DOWN) if market_type == TYPE_UP_DOWN else tuple(ASSET_OUTCOME_BASE + asset for asset in _required_assets(market_type, subject))
    def _market_preview(self, market_id: u256) -> dict:
        self._require_market(market_id)
        market_type = self.market_type[market_id]
        subject = self.market_subject[market_id]
        start = self.market_start_seconds[market_id]
        end = self.market_end_seconds[market_id]
        state = self.market_state[market_id]
        now_seconds = _now()
        winning_pool = self.market_winning_pool.get(market_id, 0)
        claimed_pool = self.market_claimed_pool.get(market_id, 0)
        refunded_pool = self.market_refunded_pool.get(market_id, 0)
        total_pool = self.market_pool.get(market_id, 0)
        if claimed_pool > total_pool or refunded_pool > total_pool:
            raise gl.vm.UserError("market accounting exceeds pool")
        settlement_ready = _add_u256(end, SETTLEMENT_GRACE_SECONDS)
        deadline = self.market_settlement_deadline[market_id]
        consumed = claimed_pool if state == STATE_SETTLED else refunded_pool if state == STATE_INCONCLUSIVE else 0
        allowed = self._allowed_ids(market_id)
        return {
            "market_id": market_id, "market_type": TYPE_NAMES[market_type],
            "subject": ASSETS[subject] if market_type == TYPE_UP_DOWN else CATEGORIES[subject],
            "duration_seconds": self.market_duration[market_id], "market_start": start, "market_end": end,
            "settlement_ready": settlement_ready, "settlement_deadline": deadline,
            "state": state, "winner": "" if self.market_winner[market_id] == OUTCOME_NONE else _outcome_name(self.market_winner[market_id]),
            "reason": self.market_reason.get(market_id, REASON_NONE), "allowed_outcomes": [_outcome_name(outcome) for outcome in allowed],
            "betting_open": state == STATE_OPEN and now_seconds < start,
            "settlement_available": state in (STATE_OPEN, STATE_PENDING) and settlement_ready <= now_seconds < deadline,
            "market_pool": total_pool, "winning_pool": winning_pool, "claimed_pool": claimed_pool,
            "claimed_winning_stake": self.market_claimed_winning_stake.get(market_id, 0),
            "refunded_pool": refunded_pool, "remaining_pool": total_pool - consumed,
            "outcome_pools": {_outcome_name(outcome): self.outcome_pool.get(self._outcome_key(market_id, outcome), 0) for outcome in allowed},
        }
    def _position_view(self, market_id: u256, user: Address) -> dict:
        self._require_market(market_id)
        key = self._position_key(market_id, user)
        selected = self.bettor_outcome.get(key, OUTCOME_NONE)
        has_position = _is_outcome(selected)
        stake = self.bettor_stake.get(key, 0)
        state = self.market_state[market_id]
        winner = self.market_winner[market_id]
        claimed = self.bettor_claimed.get(key, False)
        refunded = self.bettor_refunded.get(key, False)
        total_pool = self.market_pool.get(market_id, 0)
        winning_pool = self.market_winning_pool.get(market_id, 0)
        claimed_pool = self.market_claimed_pool.get(market_id, 0)
        claimable = 0
        claim_available = False
        position_won = state == STATE_SETTLED and has_position and selected == winner
        if position_won and not claimed:
            claimed_stake = self.market_claimed_winning_stake.get(market_id, 0)
            new_stake = _add_u256(claimed_stake, stake)
            if winning_pool > 0 and claimed_pool <= total_pool and claimed_stake <= winning_pool and new_stake <= winning_pool:
                claimable = total_pool - claimed_pool if new_stake == winning_pool else _mul_div_u256(stake, total_pool, winning_pool)
                claim_available = claimable > 0
        refund_available = state == STATE_INCONCLUSIVE and has_position and stake > 0 and not refunded
        if refund_available:
            claimable = stake
        return {
            "market_id": market_id, "has_position": has_position,
            "selected_outcome": "" if not has_position else _outcome_name(selected), "total_stake": stake,
            "market_state": state, "winner": "" if winner == OUTCOME_NONE else _outcome_name(winner),
            "reason": self.market_reason.get(market_id, REASON_NONE), "market_pool": total_pool,
            "winning_pool": winning_pool, "position_won": position_won,
            "position_lost": state == STATE_SETTLED and has_position and selected != winner,
            "claim_available": claim_available, "refund_available": refund_available,
            "already_claimed": claimed, "refunded": refunded, "claimable_amount": claimable,
            "claim_type": "REFUND" if refund_available else "WINNINGS" if claim_available else "NONE",
        }
    def _page_bounds(self, offset: u256, limit: u256, count: u256):
        if not _is_u256(offset) or not _is_u256(limit) or limit > MAX_PAGE_SIZE:
            raise gl.vm.UserError("page limit exceeded")
        if offset >= count or limit == 0:
            return 0, 0
        return offset, min(count, _add_u256(offset, limit))
    def _market_page(self, offset: u256, limit: u256, open_only: bool) -> dict:
        start, end = self._page_bounds(offset, limit, self.market_count)
        items = []
        for index in range(start, end):
            market = self._market_preview(index + 1)
            if not open_only or market["betting_open"]:
                items.append(market)
        return {"items": items, "next_offset": end if end < self.market_count else 0, "has_more": end < self.market_count}
    def _user_position_page(self, user: Address, offset: u256, limit: u256) -> dict:
        count = self.user_market_count.get(user.as_hex, 0)
        start, end = self._page_bounds(offset, limit, count)
        items = []
        for index in range(start, end):
            market_id = self.user_market_index[self._user_market_key(user, count - index - 1)]
            items.append(self._position_view(market_id, user))
        return {"items": items, "next_offset": end if end < count else 0, "has_more": end < count}
    @gl.public.view
    def get_config(self) -> dict:
        return {
            "protocol": "CROSS CRYPTO V1", "market_types": list(TYPE_NAMES), "assets": list(ASSETS),
            "dominance_categories": {"MAJORS": list(ASSETS[:3]), "LARGE_CAP_ALTS": list(ASSETS[3:])},
            "durations_seconds": list(DURATIONS), "sources": list(SOURCES), "consensus_threshold": 2,
            "minimum_bet": MIN_BET, "maximum_bet_per_wallet_per_market": MAX_BET_PER_MARKET,
            "settlement_grace_seconds": SETTLEMENT_GRACE_SECONDS, "settlement_retry_window_seconds": SETTLEMENT_RETRY_WINDOW_SECONDS,
            "fee_bps": 0, "timezone": "UTC", "max_page_size": MAX_PAGE_SIZE,
            "return_calculation": "exact rational (close-open)/open",
            "payout_rounding": "floor; final claimant gets remainder",
            "zero_backed_winner_behavior": "INCONCLUSIVE; original-stake refunds",
            "candle_feed": "market 1H; 2H=two consecutive 1H",
        }
    @gl.public.view
    def get_market_count(self) -> u256:
        return self.market_count
    @gl.public.view
    def get_market(self, market_id: u256) -> dict:
        return self._market_preview(market_id)
    @gl.public.view
    def get_markets(self, offset: u256, limit: u256) -> dict:
        return self._market_page(offset, limit, False)
    @gl.public.view
    def get_open_markets(self, offset: u256, limit: u256) -> dict:
        return self._market_page(offset, limit, True)
    @gl.public.view
    def get_market_by_identity(self, market_type: str, subject: str, duration_seconds: u256, market_start: u256) -> dict:
        kind = _type_id(market_type)
        value = _asset_id(subject) if kind == TYPE_UP_DOWN else _category_id(subject)
        duration = _duration(duration_seconds)
        if not _is_u256(market_start) or market_start % ONE_HOUR != 0:
            raise gl.vm.UserError("market start must be exact UTC hour")
        key = self._identity_key(kind, value, duration, market_start)
        if key not in self.market_identity:
            raise gl.vm.UserError("market not found")
        return self._market_preview(self.market_identity[key])
    @gl.public.view
    def get_my_position(self, market_id: u256) -> dict:
        return self._position_view(market_id, gl.message.sender_address)
    @gl.public.view
    def get_my_positions(self, offset: u256, limit: u256) -> dict:
        return self._user_position_page(gl.message.sender_address, offset, limit)
    @gl.public.view
    def get_user_positions(self, user: Address, offset: u256, limit: u256) -> dict:
        return self._user_position_page(user, offset, limit)
    @gl.public.view
    def get_my_claimable_markets(self, offset: u256, limit: u256) -> dict:
        page = self._user_position_page(gl.message.sender_address, offset, limit)
        page["items"] = [item for item in page["items"] if item["claim_available"] or item["refund_available"]]
        return page
    @gl.public.view
    def get_source_evidence(self, market_id: u256, source: str) -> dict:
        self._require_market(market_id)
        if source not in SOURCES:
            raise gl.vm.UserError("invalid source")
        key = self._source_key(market_id, source)
        if key not in self.market_source_evidence:
            raise gl.vm.UserError("source evidence unavailable")
        evidence = json.loads(self.market_source_evidence[key])
        evidence["evidence_semantics"] = "EXACT_SOURCE_WINDOW;VALIDATOR_RECOMPUTED"
        evidence["cross_source_price_mixing"] = False
        return evidence
    @gl.public.view
    def get_betting_state(self, market_id: u256) -> dict:
        self._require_market(market_id)
        key = self._position_key(market_id, gl.message.sender_address)
        selected = self.bettor_outcome.get(key, OUTCOME_NONE)
        allowed = self._allowed_ids(market_id)
        return {
            "total_market_pool": self.market_pool.get(market_id, 0),
            "outcome_stakes": {_outcome_name(outcome): self.outcome_pool.get(self._outcome_key(market_id, outcome), 0) for outcome in allowed},
            "bettor_outcome": "" if selected == OUTCOME_NONE else _outcome_name(selected),
            "bettor_stake": self.bettor_stake.get(key, 0), "claimed": self.bettor_claimed.get(key, False),
            "refunded": self.bettor_refunded.get(key, False), "winning_pool": self.market_winning_pool.get(market_id, 0),
            "claimed_pool": self.market_claimed_pool.get(market_id, 0), "refunded_pool": self.market_refunded_pool.get(market_id, 0),
        }
    def _create_market(self, market_type: int, subject: int, duration_seconds: u256, market_start: u256) -> u256:
        duration = _duration(duration_seconds)
        if not _is_u256(market_start) or market_start % ONE_HOUR != 0:
            raise gl.vm.UserError("market start must be exact UTC hour")
        now_seconds = _now()
        expected_start = _mul_u256(_add_u256(now_seconds // ONE_HOUR, 1), ONE_HOUR)
        if market_start != expected_start:
            raise gl.vm.UserError("market start must be next UTC hour")
        if self.market_count >= MAX_MARKETS:
            raise gl.vm.UserError("maximum market count reached")
        identity = self._identity_key(market_type, subject, duration, market_start)
        if identity in self.market_identity:
            raise gl.vm.UserError("market already exists")
        market_id = _add_u256(self.market_count, 1)
        end = _add_u256(market_start, duration)
        ready = _add_u256(end, SETTLEMENT_GRACE_SECONDS)
        deadline = _add_u256(ready, SETTLEMENT_RETRY_WINDOW_SECONDS)
        self.market_count = market_id
        self.market_type[market_id] = market_type
        self.market_subject[market_id] = subject
        self.market_duration[market_id] = duration
        self.market_start_seconds[market_id] = market_start
        self.market_end_seconds[market_id] = end
        self.market_state[market_id] = STATE_OPEN
        self.market_winner[market_id] = OUTCOME_NONE
        self.market_reason[market_id] = REASON_NONE
        self.market_pool[market_id] = 0
        self.market_winning_pool[market_id] = 0
        self.market_claimed_pool[market_id] = 0
        self.market_claimed_winning_stake[market_id] = 0
        self.market_refunded_pool[market_id] = 0
        self.market_settlement_deadline[market_id] = deadline
        self.market_identity[identity] = market_id
        return market_id
    @gl.public.write
    def create_up_down_market(self, asset: str, duration_seconds: u256, market_start: u256) -> u256:
        return self._create_market(TYPE_UP_DOWN, _asset_id(asset), duration_seconds, market_start)
    @gl.public.write
    def create_dominance_market(self, category: str, duration_seconds: u256, market_start: u256) -> u256:
        return self._create_market(TYPE_DOMINANCE, _category_id(category), duration_seconds, market_start)
    @gl.public.write.payable
    def place_bet(self, market_id: u256, outcome: str) -> None:
        self._require_market(market_id)
        if self.market_state[market_id] != STATE_OPEN:
            raise gl.vm.UserError("market is not open")
        if _now() >= self.market_start_seconds[market_id]:
            raise gl.vm.UserError("betting is closed")
        market_type = self.market_type[market_id]
        subject = self.market_subject[market_id]
        outcome_id = _outcome_for_market(market_type, subject, outcome)
        amount = gl.message.value
        if not _is_u256(amount) or amount == 0:
            raise gl.vm.UserError("stake must be positive")
        key = self._position_key(market_id, gl.message.sender_address)
        selected = self.bettor_outcome.get(key, OUTCOME_NONE)
        old_stake = self.bettor_stake.get(key, 0)
        if selected != OUTCOME_NONE and selected != outcome_id:
            raise gl.vm.UserError("wallet outcome already selected")
        if selected == OUTCOME_NONE and amount < MIN_BET:
            raise gl.vm.UserError("minimum initial bet is 1 GEN")
        if old_stake > MAX_BET_PER_MARKET or amount > MAX_BET_PER_MARKET - old_stake:
            raise gl.vm.UserError("maximum cumulative stake is 70 GEN")
        if selected == OUTCOME_NONE:
            if self.position_count >= MAX_POSITIONS:
                raise gl.vm.UserError("maximum position count reached")
            user = gl.message.sender_address
            user_count = self.user_market_count.get(user.as_hex, 0)
            if user_count >= MAX_POSITIONS:
                raise gl.vm.UserError("maximum user market count reached")
            self.position_count = _add_u256(self.position_count, 1)
            self.user_market_index[self._user_market_key(user, user_count)] = market_id
            self.user_market_count[user.as_hex] = _add_u256(user_count, 1)
        new_stake = _add_u256(old_stake, amount)
        self.bettor_outcome[key] = outcome_id
        self.bettor_stake[key] = new_stake
        pool_key = self._outcome_key(market_id, outcome_id)
        self.outcome_pool[pool_key] = _add_u256(self.outcome_pool.get(pool_key, 0), amount)
        self.market_pool[market_id] = _add_u256(self.market_pool.get(market_id, 0), amount)
    @gl.public.write
    def settle_market(self, market_id: u256) -> str:
        self._require_market(market_id)
        state = self.market_state[market_id]
        if state not in (STATE_OPEN, STATE_PENDING):
            raise gl.vm.UserError("market is not open")
        now_seconds = _now()
        end = self.market_end_seconds[market_id]
        deadline = self.market_settlement_deadline[market_id]
        if now_seconds < end:
            raise gl.vm.UserError("market has not ended")
        ready = _add_u256(end, SETTLEMENT_GRACE_SECONDS)
        if now_seconds < ready:
            raise gl.vm.UserError("settlement is not ready; candle finalization grace is active")
        if now_seconds >= deadline:
            self.market_state[market_id] = STATE_INCONCLUSIVE
            self.market_winner[market_id] = OUTCOME_NONE
            self.market_reason[market_id] = REASON_EXPIRED
            return STATE_INCONCLUSIVE
        market_type = self.market_type[market_id]
        subject = self.market_subject[market_id]
        duration = self.market_duration[market_id]
        proposal = _settlement_proposal(market_type, subject, duration, self.market_start_seconds[market_id])
        results = proposal["source_results"]
        for index in range(len(SOURCES)):
            self.market_source_evidence[self._source_key(market_id, SOURCES[index])] = json.dumps(results[index], separators=(",", ":"), sort_keys=True)
        winner = proposal["consensus_winner"]
        if winner == OUTCOME_NONE:
            self.market_state[market_id] = STATE_PENDING
            self.market_winner[market_id] = OUTCOME_NONE
            self.market_reason[market_id] = REASON_NO_CONSENSUS
            return STATE_PENDING
        winning_pool = self.outcome_pool.get(self._outcome_key(market_id, winner), 0)
        total_pool = self.market_pool.get(market_id, 0)
        if total_pool > 0 and winning_pool == 0:
            self.market_state[market_id] = STATE_INCONCLUSIVE
            self.market_winner[market_id] = OUTCOME_NONE
            self.market_reason[market_id] = REASON_ZERO_BACKED
            return STATE_INCONCLUSIVE
        self.market_winner[market_id] = winner
        self.market_winning_pool[market_id] = winning_pool
        self.market_state[market_id] = STATE_SETTLED
        self.market_reason[market_id] = REASON_CONSENSUS
        return STATE_SETTLED
    @gl.public.write
    def claim(self, market_id: u256) -> None:
        self._require_market(market_id)
        if self.market_state[market_id] != STATE_SETTLED:
            raise gl.vm.UserError("market is not settled")
        key = self._position_key(market_id, gl.message.sender_address)
        if self.bettor_claimed.get(key, False) or self.bettor_refunded.get(key, False):
            raise gl.vm.UserError("position already paid")
        if self.bettor_outcome.get(key, OUTCOME_NONE) != self.market_winner[market_id]:
            raise gl.vm.UserError("not a winning bettor")
        stake = self.bettor_stake.get(key, 0)
        winning_pool = self.market_winning_pool.get(market_id, 0)
        if stake <= 0 or winning_pool <= 0:
            raise gl.vm.UserError("winning position is empty")
        total_pool = self.market_pool.get(market_id, 0)
        claimed_pool = self.market_claimed_pool.get(market_id, 0)
        claimed_stake = self.market_claimed_winning_stake.get(market_id, 0)
        new_stake = _add_u256(claimed_stake, stake)
        if claimed_pool > total_pool or claimed_stake > winning_pool or new_stake > winning_pool:
            raise gl.vm.UserError("claimed accounting exceeds pool")
        payout = total_pool - claimed_pool if new_stake == winning_pool else _mul_div_u256(stake, total_pool, winning_pool)
        if payout <= 0 or payout > total_pool - claimed_pool:
            raise gl.vm.UserError("payout is empty")
        self.bettor_claimed[key] = True
        self.market_claimed_pool[market_id] = _add_u256(claimed_pool, payout)
        self.market_claimed_winning_stake[market_id] = new_stake
        self._send_value(gl.message.sender_address, payout)
    @gl.public.write
    def claim_refund(self, market_id: u256) -> None:
        self._require_market(market_id)
        if self.market_state[market_id] != STATE_INCONCLUSIVE:
            raise gl.vm.UserError("market is not inconclusive")
        key = self._position_key(market_id, gl.message.sender_address)
        if self.bettor_refunded.get(key, False) or self.bettor_claimed.get(key, False):
            raise gl.vm.UserError("position already paid")
        stake = self.bettor_stake.get(key, 0)
        if stake <= 0:
            raise gl.vm.UserError("no bettor stake")
        total_pool = self.market_pool.get(market_id, 0)
        refunded_pool = self.market_refunded_pool.get(market_id, 0)
        if refunded_pool > total_pool or stake > total_pool - refunded_pool:
            raise gl.vm.UserError("refund exceeds remaining pool")
        self.bettor_refunded[key] = True
        self.market_refunded_pool[market_id] = _add_u256(refunded_pool, stake)
        self._send_value(gl.message.sender_address, stake)
