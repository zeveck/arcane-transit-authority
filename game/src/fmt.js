// fmt.js — the one money formatter (pure; sim and browser). The sim's $1 is shown as $1 million.
//   fmtMoney(0.4)  → "$400K"     under $1M: thousands
//   fmtMoney(2)    → "$2M"       under $10M: at most one decimal, no trailing zero ("$2.5M")
//   fmtMoney(750)  → "$750M"     under $1B: whole millions
//   fmtMoney(2480) → "$2.48B"    $1B and up: three significant figures, trailing zeros dropped ("$6.1B", "$12B")
//   fmtRate(24)    → "$24M/min"
//   0 (and anything that rounds to 0K) → "$0"; negative amounts → "−$2.5M" (a real minus sign); fmtMoney(x, { sign: true }) → "+$3B" for a gain.

const MINUS = '−';

function trimZeros(s) { return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s; }

/** The magnitude part, without the sign: "$400K", "$2.5M", "$2.48B". */
function body(v) {
  if (!isFinite(v)) return '$' + '∞';
  if (v < 1) {
    const k = Math.round(v * 1000);
    if (k === 0) return '$0';
    if (k < 1000) return '$' + k + 'K';
    v = 1; // rounds up to $1M
  }
  if (v < 10) {
    const m = Math.round(v * 10) / 10;
    if (m < 10) return '$' + trimZeros(m.toFixed(1)) + 'M';
    v = 10;
  }
  if (v < 1000) {
    const m = Math.round(v);
    if (m < 1000) return '$' + m + 'M';
    v = 1000;
  }
  const b = v / 1000;
  return '$' + trimZeros(b >= 100 ? String(Math.round(b)) : b.toPrecision(3)) + 'B';
}

/** Money for the player. x in sim dollars (= $ millions). opts.sign: prefix "+" on a positive amount. */
export function fmtMoney(x, opts = {}) {
  const v = Number(x) || 0;
  if (v < 0) {
    const s = body(-v);
    return s === '$0' ? s : MINUS + s;
  }
  return (opts.sign && v > 0 ? '+' : '') + body(v);
}
/** A rate per minute: "$24M/min" (negative "−$3M/min"). */
export function fmtRate(x, opts = {}) { return fmtMoney(x, opts) + '/min'; }
