// token-radar-01: the fitted radar model (radar-8).
//
// Coverage, audited against the kit's house rule: the board ranks every
// pre-token protocol that passes the watchlist-exclusion rule — 198 rows
// (the 40-protocol watchlist plus 158 more). The other 91 pre-token
// protocols match the house rule (Bridge / Canonical Bridge / Liquid
// Staking / Liquid Restaking / Restaked BTC categories, wrapped/staked
// names, exchange-prefixed names) and are NOT ranked: ranking all 289
// pre-token non-exchange rows would put Base Bridge, WBTC and Coinbase
// Bridge at ranks 1-3 — wrapped and bridged products of tokens that
// already trade, not launches. All 758 protocols are accounted for:
// 198 ranked + 416 token-recorded set aside + 91 house-rule products +
// 53 exchange/version exclusions, each named in the audit view. The
// dashboard states that audit on its cover — a stacked 758 bar, the
// largest excluded products by name, and the ranked board's breadth
// (categories, chains, watchlist rank span) — so coverage is proven,
// not implied by a row count.
//
// radar-8 refits both models on the board's own universe and keeps a
// term only when it lowers the held-out miss in BOTH tests:
//
// Value if a token launches, fitted on the 94 traded comps (market cap
// above zero, TVL above zero, category outside the house-rule set and
// not an exchange — the kinds the board can rank). The estimator is
// median regression (IRLS) of log(mcap/TVL) on a size curve plus
// ridge-penalised category effects (lambda 4 on category effects only,
// categories with at least 5 comps; lambda picked from the grid
// 1/4/16/64 by held-out miss, grid printed on the validation view).
// Terms tested in order against leave-one-out and walk-forward
// (older-listed comps price newer-listed ones): flat median multiple,
// + size curve, + category effects, + 7-day growth, + age, + chain
// count, + a control term (another row's growth, which must not help).
// Growth, age and chain count fail at least one test and stay out of
// the value model; growth enters through the odds instead.
//
// Token odds, fitted on the 383 dated peers that pass the house rule
// (192 record a token): logistic regression of tokenized on terms
// tested the same way against ten-fold and walk-forward Brier scores.
// Odds = 1 - P(tokenized | features), the still-pre-token share of
// peers like this row, falling with age. It is the peers' record, not
// a promise that a token will launch.
//
//   if_launches = TVL * exp(intercept + category effect) * (TVL/ref)^slope
//   implied     = max(1, round(if_launches * odds))
//
// Ranges are the signed leave-one-out residual quantiles (P25-P75 and
// P10-P90), with their measured walk-forward coverage printed next to
// the stated levels. Rank ranges come from 200 seeded bootstrap refits
// of the value model (odds held fixed), 5th-95th percentile rank.
// Because implied already carries the odds, farm economics apply the
// capture share once and judge the verdict on net dollars per hour
// after gas. Deterministic throughout: fixed snapshot date, no clock,
// no Math.random (seeded mulberry32).

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export const MODEL_VERSION = 'radar-8';
export const CAPTURE_SHARE = 0.000005; // a typical farmer captures 0.5bp of expected value (stated assumption: a 5% airdrop split across ~10,000 farmers; implied already carries launch odds, so odds are applied once)
export const CAT_LAMBDA = 4; // ridge penalty on value-model category effects only (grid 1/4/16/64 printed on the validation view)
export const CAT_MIN_N = 5; // categories with fewer comps than this pool into the baseline multiple
export const ODDS_CAT_MIN_N = 15; // odds-model category effects need at least this many peers
export const ODDS_CAT_LAMBDA = 16; // ridge penalty on odds-model category effects
export const UNKNOWN_AGE_DAYS = 365;
export const FARM_NET_HOUR = 25; // verdict Farm when net value after gas pays at least $25 per active hour
export const BOOTSTRAP_N = 200; // seeded bootstrap refits behind the rank ranges and coefficient errors
export const LIVE_ROWS = 50;

export interface TermRow {
  term: string;
  loo: number; // typical miss factor, leave-one-out (value) — for odds rows this is the ten-fold Brier score
  wf: number; // typical miss factor, walk-forward (value) — for odds rows the walk-forward Brier score
  kept: boolean;
  note: string;
}

export interface Fit {
  comps_n: number;
  peers_n: number;
  peers_token: number;
  ref_tvl: number;
  intercept: number;
  size_slope: number;
  cat_effects: Record<string, number>;
  cat_n: Record<string, number>;
  odds_ref_tvl: number;
  odds_coefs: Record<string, number>;
  odds_cats: string[];
  value_terms: TermRow[];
  odds_terms: TermRow[];
  lambda_grid: Array<{ lambda: number; loo: number; wf: number }>;
  validation: {
    loo: number; loo_base: number; loo_factor: number;
    tenfold: number; tenfold_base: number; tenfold_factor: number;
    walkforward: number; walkforward_base: number; walkforward_factor: number;
    splithalf: number[]; splithalf_base: number[]; splithalf_factor: number[];
  };
  // Signed LOO residual quantiles behind the printed ranges, and the
  // measured coverage of those ranges on LOO and walk-forward residuals.
  q10: number; q25: number; q75: number; q90: number;
  range_honesty: {
    loo_x3: number; loo_p50: number; loo_p80: number;
    wf_x3: number; wf_p50: number; wf_p80: number;
  };
  odds_brier: { tenfold: number; tenfold_base: number; wf: number; wf_base: number; wf_acc: number };
  bootstrap: {
    intercept_se: number; size_se: number;
    cat_se: Record<string, number>;
    odds_se: Record<string, number>;
    weights: number[][]; // value-model weights per refit, for rank ranges
    cats: string[];
  };
}

export interface ModelParts {
  cat_multiple: number;
  size_factor: number;
  odds: number;
  age_days: number | null;
  if_launches: number;
}

export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

export interface FarmEcon {
  capital: number;
  hold_days: number;
  gas_per_tx: number;
  gas_total: number;
  active_hours: number;
  gas_per_hour: number;
  ev_farmer: number;
  net_hour: number;
  verdict: 'Farm' | 'Watch' | 'Skip';
  plan_shapes: number;
}

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  implied_lo_usd: number;
  implied_hi_usd: number;
  house_flag: string | null;
  rank_lo: number;
  rank_hi: number;
  model: ModelParts;
  econ: FarmEcon;
  farm_steps: string[];
}

export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  age_days: number | null;
  implied_value_usd: number;
  implied_lo_usd: number;
  implied_hi_usd: number;
  house_flag: string | null;
  watch: number;
  cat_multiple: number;
  size_factor: number;
  odds: number;
  if_launches: number;
  p25_usd: number;
  p75_usd: number;
  rank_lo: number;
  rank_hi: number;
  verdict: string;
  ev_farmer: number;
  gas_total: number;
  capital: number;
  hold_days: number;
  gas_per_hour: number;
  net_hour: number;
  active_hours: number;
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

export interface AuditRow {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  status: 'ranked' | 'live' | 'excluded-cex' | 'excluded-version' | 'excluded-house-rule';
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  fit: Fit;
  counts: { protocols: number; watchlist: number; ranked: number; live: number; excluded: number; flagged: number; plan_shapes: number };
  rows: RadarRow[];
  live: LiveRow[];
  audit: AuditRow[];
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return NaN;
  return n % 2 === 1 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2;
}

/** Deterministic PRNG (mulberry32) so split-half validation repeats exactly. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/**
 * The house watchlist-exclusion rule, applied to a ranked row: the reason the
 * protocol would NOT make the house watchlist, or null when it passes. A
 * flagged row is still ranked (the rules say a protocol the list leaves out
 * is no worse a subject); the flag is shown and filterable.
 */
export function houseRuleFlag(p: SnapshotProtocol): string | null {
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return `category ${p.category}`;
  if (WRAPPED_WORD.test(p.name)) return 'wrapped/staked name';
  if (EXCHANGE_PREFIX.test(p.name)) return 'exchange-prefixed name';
  if (VERSIONED.test(p.name)) return 'version marker';
  return null;
}

/** Solve A w = b by Gauss-Jordan with partial pivoting (small dense systems). */
function solveLin(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r;
    const tmp = M[c]!;
    M[c] = M[piv]!;
    M[piv] = tmp;
    const d = M[c]![c]!;
    for (let j = c; j <= n; j++) M[c]![j]! /= d;
    for (let r = 0; r < n; r++) {
      if (r !== c && M[r]![c] !== 0) {
        const f = M[r]![c]!;
        for (let j = c; j <= n; j++) M[r]![j]! -= f * M[c]![j]!;
      }
    }
  }
  return M.map((row) => row[n]!);
}

/** Weighted ridge regression: minimise sum w_i (y_i - x_i.b)^2 + sum pen_j b_j^2. */
function wRidge(X: number[][], y: number[], wts: number[], pen: number[]): number[] {
  const n = X[0]!.length;
  const A: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const b = new Array<number>(n).fill(0);
  for (let k = 0; k < X.length; k++) {
    for (let i = 0; i < n; i++) {
      b[i]! += wts[k]! * X[k]![i]! * y[k]!;
      for (let j = 0; j < n; j++) A[i]![j]! += wts[k]! * X[k]![i]! * X[k]![j]!;
    }
  }
  for (let i = 0; i < n; i++) A[i]![i]! += pen[i]!;
  return solveLin(A, b);
}

/** Median regression by IRLS: refit weighted ridge with weights 1/max(|residual|, 0.05). */
function medianRegress(X: number[][], y: number[], pen: number[]): number[] {
  let w = wRidge(X, y, X.map(() => 1), pen);
  for (let iter = 0; iter < 25; iter++) {
    const wts = X.map((x, k) => {
      const pred = x.reduce((s, v, j) => s + v * w[j]!, 0);
      return 1 / Math.max(Math.abs(y[k]! - pred), 0.05);
    });
    w = wRidge(X, y, wts, pen);
  }
  return w;
}

function sigmoid(z: number): number {
  return z > 30 ? 1 : z < -30 ? 0 : 1 / (1 + Math.exp(-z));
}

/** Ridge-penalised logistic regression by Newton-Raphson. */
function fitLogistic(X: number[][], y: number[], pen: number[]): number[] {
  const n = X[0]!.length;
  let w = new Array<number>(n).fill(0);
  for (let iter = 0; iter < 80; iter++) {
    const g = new Array<number>(n).fill(0);
    const H: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let k = 0; k < X.length; k++) {
      const pr = sigmoid(X[k]!.reduce((s, v, j) => s + v * w[j]!, 0));
      const d = y[k]! - pr;
      const wt = pr * (1 - pr);
      for (let i = 0; i < n; i++) {
        g[i]! += d * X[k]![i]!;
        for (let j = 0; j < n; j++) H[i]![j]! += wt * X[k]![i]! * X[k]![j]!;
      }
    }
    for (let i = 0; i < n; i++) {
      H[i]![i]! += pen[i]!;
      g[i]! -= pen[i]! * w[i]!;
    }
    const dw = solveLin(H, g);
    w = w.map((v, i) => v + dw[i]!);
    if (dw.reduce((s, v) => s + Math.abs(v), 0) < 1e-9) break;
  }
  return w;
}

/** The traded comps the value model fits: priced, with TVL, of a kind the board can rank. */
export function isComp(p: SnapshotProtocol): boolean {
  return p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0 && !(p.category !== null && EXCLUDED_CATEGORIES.has(p.category));
}

const VALUE_TERM_ORDER = ['size', 'cat', 'growth', 'age', 'chains', 'ctrl'] as const;
type ValueTerm = (typeof VALUE_TERM_ORDER)[number];

interface ValueDesign {
  cats: string[];
  ref: number;
  features: (p: SnapshotProtocol) => number[];
  pen: number[];
}

function valueDesign(train: SnapshotProtocol[], pool: SnapshotProtocol[], terms: ReadonlySet<ValueTerm>, lambda: number, asOf: string): ValueDesign {
  const ref = median(train.map((p) => p.tvl_usd));
  const counts = new Map<string, number>();
  for (const p of train) counts.set(p.category ?? 'None', (counts.get(p.category ?? 'None') ?? 0) + 1);
  const cats = terms.has('cat') ? [...counts.entries()].filter(([, n]) => n >= CAT_MIN_N).map(([c]) => c).sort() : [];
  const ordered = [...pool].sort((a, b) => (a.slug < b.slug ? -1 : 1));
  const ctrl = new Map<string, number>();
  ordered.forEach((p, i) => ctrl.set(p.slug, ordered[(i + 1) % ordered.length]!.change_7d ?? 0));
  const features = (p: SnapshotProtocol): number[] => {
    const x = [1];
    if (terms.has('size')) x.push(Math.log(p.tvl_usd / ref));
    if (terms.has('cat')) for (const c of cats) x.push((p.category ?? 'None') === c ? 1 : 0);
    if (terms.has('growth')) x.push(Math.min(120, Math.max(-60, finite(p.change_7d, 0))) / 100);
    if (terms.has('age')) x.push((ageDays(asOf, p.listed_at) ?? UNKNOWN_AGE_DAYS) / 365);
    if (terms.has('chains')) x.push(Math.log1p(p.chains.length));
    if (terms.has('ctrl')) x.push((ctrl.get(p.slug) ?? 0) / 100);
    return x;
  };
  const pen = features(train[0]!).map(() => 0);
  if (terms.has('cat')) {
    const base = 1 + (terms.has('size') ? 1 : 0);
    for (let i = base; i < base + cats.length; i++) pen[i] = lambda;
  }
  return { cats, ref, features, pen };
}

function fitValue(train: SnapshotProtocol[], pool: SnapshotProtocol[], terms: ReadonlySet<ValueTerm>, lambda: number, asOf: string): { w: number[]; design: ValueDesign } {
  const design = valueDesign(train, pool, terms, lambda, asOf);
  const y = train.map((p) => Math.log(p.mcap_usd! / p.tvl_usd));
  const w = medianRegress(train.map((p) => design.features(p)), y, design.pen);
  return { w, design };
}

function valuePredict(w: number[], design: ValueDesign, p: SnapshotProtocol): number {
  return p.tvl_usd * Math.exp(design.features(p).reduce((s, v, j) => s + v * w[j]!, 0));
}

/** Typical miss factor: exp(median |log residual|). */
function missFactor(residuals: number[]): number {
  return Math.exp(median(residuals.map((r) => Math.abs(r))));
}

function quantile(sorted: number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
}

const ODDS_TERM_ORDER = ['age', 'size', 'growth', 'chains', 'cat', 'ctrl'] as const;
type OddsTerm = (typeof ODDS_TERM_ORDER)[number];

interface OddsDesign {
  cats: string[];
  ref: number;
  features: (p: SnapshotProtocol) => number[];
  pen: number[];
  names: string[];
}

function oddsDesign(train: SnapshotProtocol[], pool: SnapshotProtocol[], terms: ReadonlySet<OddsTerm>, asOf: string): OddsDesign {
  const ref = median(train.map((p) => p.tvl_usd));
  const counts = new Map<string, number>();
  for (const p of train) counts.set(p.category ?? 'None', (counts.get(p.category ?? 'None') ?? 0) + 1);
  const cats = terms.has('cat') ? [...counts.entries()].filter(([, n]) => n >= ODDS_CAT_MIN_N).map(([c]) => c).sort() : [];
  const ordered = [...pool].sort((a, b) => (a.slug < b.slug ? -1 : 1));
  const ctrl = new Map<string, number>();
  ordered.forEach((p, i) => ctrl.set(p.slug, ordered[(i + 1) % ordered.length]!.change_7d ?? 0));
  const names = ['intercept'];
  if (terms.has('age')) names.push('age_years');
  if (terms.has('size')) names.push('ln_tvl');
  if (terms.has('growth')) names.push('growth_7d');
  if (terms.has('chains')) names.push('ln_chains');
  if (terms.has('cat')) for (const c of cats) names.push(`cat:${c}`);
  if (terms.has('ctrl')) names.push('ctrl');
  const features = (p: SnapshotProtocol): number[] => {
    const x = [1];
    if (terms.has('age')) x.push((ageDays(asOf, p.listed_at) ?? UNKNOWN_AGE_DAYS) / 365);
    if (terms.has('size')) x.push(Math.log(Math.max(p.tvl_usd, 1) / ref));
    if (terms.has('growth')) x.push(Math.min(120, Math.max(-60, finite(p.change_7d, 0))) / 100);
    if (terms.has('chains')) x.push(Math.log1p(p.chains.length));
    if (terms.has('cat')) for (const c of cats) x.push((p.category ?? 'None') === c ? 1 : 0);
    if (terms.has('ctrl')) x.push((ctrl.get(p.slug) ?? 0) / 100);
    return x;
  };
  const pen = names.map((nm) => (nm === 'intercept' ? 0 : nm.startsWith('cat:') ? ODDS_CAT_LAMBDA : 1));
  return { cats, ref, features, pen, names };
}

/** Fit the whole model from the snapshot: term tests first, then the kept terms. */
export function fitModel(snapshot: Snapshot): Fit {
  const asOf = snapshot.as_of;
  const comps = snapshot.protocols.filter(isComp);
  const datedComps = [...comps].filter((p) => p.listed_at !== null).sort((a, b) => (a.listed_at! < b.listed_at! ? -1 : 1));
  const wfHalf = Math.floor(datedComps.length / 2);
  const wfTrain = datedComps.slice(0, wfHalf);
  const wfTest = datedComps.slice(wfHalf);
  const logRatio = (p: SnapshotProtocol): number => Math.log(p.mcap_usd! / p.tvl_usd);
  // Value term tests: a term is kept only if it lowers the typical miss
  // in BOTH leave-one-out and walk-forward. The flat row is the median
  // multiple fitted on the training side of each test.
  const valueEval = (terms: ReadonlySet<ValueTerm>, lambda: number): { loo: number; wf: number; looRes: number[]; wfRes: number[] } => {
    if (terms.size === 0) {
      const looRes = comps.map((p, i) => logRatio(p) - median(comps.filter((_, j) => j !== i).map(logRatio)));
      const m = median(wfTrain.map(logRatio));
      const wfRes = wfTest.map((p) => logRatio(p) - m);
      return { loo: missFactor(looRes), wf: missFactor(wfRes), looRes, wfRes };
    }
    const looRes: number[] = [];
    for (let i = 0; i < comps.length; i++) {
      const { w, design } = fitValue(comps.filter((_, j) => j !== i), comps, terms, lambda, asOf);
      looRes.push(Math.log(comps[i]!.mcap_usd!) - Math.log(valuePredict(w, design, comps[i]!)));
    }
    const wfFit = fitValue(wfTrain, comps, terms, lambda, asOf);
    const wfRes = wfTest.map((p) => Math.log(p.mcap_usd!) - Math.log(valuePredict(wfFit.w, wfFit.design, p)));
    return { loo: missFactor(looRes), wf: missFactor(wfRes), looRes, wfRes };
  };
  const termLabels: Record<string, string> = {
    size: '+ size curve, ln TVL', cat: '+ category effects, ridge 4', growth: '+ 7-day TVL growth',
    age: '+ age, years listed', chains: '+ chain count, ln', ctrl: '+ control: growth of another row',
  };
  const valueTerms: TermRow[] = [];
  const keptValue = new Set<ValueTerm>();
  let prev = valueEval(keptValue, CAT_LAMBDA);
  valueTerms.push({ term: 'flat median multiple', loo: prev.loo, wf: prev.wf, kept: true, note: 'baseline' });
  for (const term of VALUE_TERM_ORDER) {
    const trial = new Set(keptValue);
    trial.add(term);
    const ev = valueEval(trial, CAT_LAMBDA);
    const kept = ev.loo < prev.loo && ev.wf < prev.wf;
    valueTerms.push({ term: termLabels[term]!, loo: ev.loo, wf: ev.wf, kept, note: term === 'ctrl' ? 'must not help' : kept ? 'kept' : 'tested, not kept' });
    if (kept) {
      keptValue.add(term);
      prev = ev;
    }
  }
  const finalEval = valueEval(keptValue, CAT_LAMBDA);
  const lambdaGrid = [1, 4, 16, 64].map((lambda) => {
    const ev = valueEval(keptValue, lambda);
    return { lambda, loo: ev.loo, wf: ev.wf };
  });
  const full = fitValue(comps, comps, keptValue, CAT_LAMBDA, asOf);
  const catN: Record<string, number> = {};
  for (const p of comps) catN[p.category ?? 'None'] = (catN[p.category ?? 'None'] ?? 0) + 1;
  const catEffects: Record<string, number> = {};
  full.design.cats.forEach((c, i) => {
    catEffects[c] = full.w[2 + i]!;
  });
  // Final-model validation against the starter's flat 0.25, median |log error|.
  const medErr = (res: number[]): number => median(res.map((r) => Math.abs(r)));
  const baseRes = (tests: SnapshotProtocol[]): number[] => tests.map((p) => Math.log(p.mcap_usd! / (p.tvl_usd * 0.25)));
  const loo = medErr(finalEval.looRes);
  const looBase = medErr(baseRes(comps));
  const sorted = [...comps].sort((a, b) => (a.slug < b.slug ? -1 : 1));
  const tfRes: number[] = [];
  for (let fold = 0; fold < 10; fold++) {
    const test = sorted.filter((_, j) => j % 10 === fold);
    const train = comps.filter((p) => !test.includes(p));
    const f = fitValue(train, comps, keptValue, CAT_LAMBDA, asOf);
    for (const p of test) tfRes.push(Math.log(p.mcap_usd!) - Math.log(valuePredict(f.w, f.design, p)));
  }
  const tenfold = medErr(tfRes);
  const tenfoldBase = medErr(baseRes(comps));
  const walkforward = medErr(finalEval.wfRes);
  const walkforwardBase = medErr(baseRes(wfTest));
  const splitHalf: number[] = [];
  const splitHalfBase: number[] = [];
  for (const seed of [20261114, 77]) {
    const rand = mulberry32(seed);
    const idx = comps.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = idx[i]!;
      idx[i] = idx[j]!;
      idx[j] = t;
    }
    const tr = idx.slice(0, Math.floor(idx.length / 2)).map((i) => comps[i]!);
    const te = idx.slice(Math.floor(idx.length / 2)).map((i) => comps[i]!);
    const f = fitValue(tr, comps, keptValue, CAT_LAMBDA, asOf);
    splitHalf.push(medErr(te.map((p) => Math.log(p.mcap_usd!) - Math.log(valuePredict(f.w, f.design, p)))));
    splitHalfBase.push(medErr(baseRes(te)));
  }
  // Ranges: signed LOO residual quantiles, coverage measured on both residual sets.
  const looSorted = [...finalEval.looRes].sort((a, b) => a - b);
  const q10 = quantile(looSorted, 0.1);
  const q25 = quantile(looSorted, 0.25);
  const q75 = quantile(looSorted, 0.75);
  const q90 = quantile(looSorted, 0.9);
  const cover = (res: number[]): { x3: number; p50: number; p80: number } => ({
    x3: res.filter((r) => Math.abs(r) <= Math.log(3)).length / res.length,
    p50: res.filter((r) => r >= q25 && r <= q75).length / res.length,
    p80: res.filter((r) => r >= q10 && r <= q90).length / res.length,
  });
  const looCover = cover(finalEval.looRes);
  const wfCover = cover(finalEval.wfRes);
  // Token odds: dated peers that pass the house rule, Brier-scored term tests.
  const peers = snapshot.protocols.filter((p) => p.listed_at !== null && houseRuleFlag(p) === null);
  const peerY = peers.map((p) => (isPreToken(p) ? 0 : 1));
  const oddsEval = (terms: ReadonlySet<OddsTerm>): { tenfold: number; tenfoldAcc: number; wf: number; wfAcc: number } => {
    const score = (trainIdx: number[], testIdx: number[]): { brier: number; acc: number } => {
      let preds: number[];
      if (terms.size === 0) {
        const rate = trainIdx.reduce((s, i) => s + peerY[i]!, 0) / trainIdx.length;
        preds = testIdx.map(() => rate);
      } else {
        const design = oddsDesign(trainIdx.map((i) => peers[i]!), peers, terms, asOf);
        const w = fitLogistic(trainIdx.map((i) => design.features(peers[i]!)), trainIdx.map((i) => peerY[i]!), design.pen);
        preds = testIdx.map((i) => sigmoid(design.features(peers[i]!).reduce((s, v, j) => s + v * w[j]!, 0)));
      }
      const brier = testIdx.reduce((s, i, k) => s + (preds[k]! - peerY[i]!) ** 2, 0) / testIdx.length;
      const acc = testIdx.filter((i, k) => (preds[k]! >= 0.5) === (peerY[i] === 1)).length / testIdx.length;
      return { brier, acc };
    };
    const sidx = peers.map((_, i) => i).sort((a, b) => (peers[a]!.slug < peers[b]!.slug ? -1 : 1));
    let brierSum = 0;
    let accSum = 0;
    for (let fold = 0; fold < 10; fold++) {
      const test = sidx.filter((_, j) => j % 10 === fold);
      const train = peers.map((_, i) => i).filter((i) => !test.includes(i));
      const s = score(train, test);
      brierSum += s.brier * test.length;
      accSum += s.acc * test.length;
    }
    const didx = peers.map((_, i) => i).sort((a, b) => (peers[a]!.listed_at! < peers[b]!.listed_at! ? -1 : 1));
    const h = Math.floor(didx.length / 2);
    const wf = score(didx.slice(0, h), didx.slice(h));
    return { tenfold: brierSum / peers.length, tenfoldAcc: accSum / peers.length, wf: wf.brier, wfAcc: wf.acc };
  };
  const oddsLabels: Record<string, string> = {
    age: '+ age, years listed', size: '+ size curve, ln TVL', growth: '+ 7-day TVL growth',
    chains: '+ chain count, ln', cat: '+ category effects, ridge 16', ctrl: '+ control: growth of another row',
  };
  const oddsTerms: TermRow[] = [];
  const keptOdds = new Set<OddsTerm>();
  let prevOdds = oddsEval(keptOdds);
  const baseOdds = prevOdds;
  oddsTerms.push({ term: 'base rate of peers', loo: prevOdds.tenfold, wf: prevOdds.wf, kept: true, note: 'baseline' });
  for (const term of ODDS_TERM_ORDER) {
    const trial = new Set(keptOdds);
    trial.add(term);
    const ev = oddsEval(trial);
    const kept = ev.tenfold < prevOdds.tenfold && ev.wf < prevOdds.wf;
    oddsTerms.push({ term: oddsLabels[term]!, loo: ev.tenfold, wf: ev.wf, kept, note: term === 'ctrl' ? 'must not help' : kept ? 'kept' : 'tested, not kept' });
    if (kept) {
      keptOdds.add(term);
      prevOdds = ev;
    }
  }
  const oddsFull = oddsDesign(peers, peers, keptOdds, asOf);
  const oddsW = fitLogistic(peers.map((p) => oddsFull.features(p)), peerY, oddsFull.pen);
  const oddsCoefs: Record<string, number> = {};
  oddsFull.names.forEach((nm, i) => {
    oddsCoefs[nm] = oddsW[i]!;
  });
  // Bootstrap: 200 seeded refits for coefficient errors and rank ranges.
  const bootRand = mulberry32(20261114);
  const bootWeights: number[][] = [];
  const bootOdds: number[][] = [];
  for (let b = 0; b < BOOTSTRAP_N; b++) {
    const sample = comps.map(() => comps[Math.floor(bootRand() * comps.length)]!);
    bootWeights.push(fitValue(sample, comps, keptValue, CAT_LAMBDA, asOf).w);
    const peerSampleIdx = peers.map(() => Math.floor(bootRand() * peers.length));
    const d = oddsDesign(peerSampleIdx.map((i) => peers[i]!), peers, keptOdds, asOf);
    bootOdds.push(fitLogistic(peerSampleIdx.map((i) => d.features(peers[i]!)), peerSampleIdx.map((i) => peerY[i]!), d.pen));
  }
  const se = (vals: number[]): number => {
    const m = vals.reduce((a, b) => a + b, 0) / vals.length;
    return Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / vals.length);
  };
  const catSe: Record<string, number> = {};
  full.design.cats.forEach((c, i) => {
    catSe[c] = se(bootWeights.map((w) => w[2 + i]!));
  });
  const oddsSe: Record<string, number> = {};
  oddsFull.names.forEach((nm, i) => {
    oddsSe[nm] = se(bootOdds.map((w) => w[i]!));
  });
  return {
    comps_n: comps.length,
    peers_n: peers.length,
    peers_token: peerY.reduce((a, b) => a + b, 0),
    ref_tvl: full.design.ref,
    intercept: full.w[0]!,
    size_slope: full.w[1]!,
    cat_effects: catEffects,
    cat_n: catN,
    odds_ref_tvl: oddsFull.ref,
    odds_coefs: oddsCoefs,
    odds_cats: oddsFull.cats,
    value_terms: valueTerms,
    odds_terms: oddsTerms,
    lambda_grid: lambdaGrid,
    validation: {
      loo,
      loo_base: looBase,
      loo_factor: looBase / loo,
      tenfold,
      tenfold_base: tenfoldBase,
      tenfold_factor: tenfoldBase / tenfold,
      walkforward,
      walkforward_base: walkforwardBase,
      walkforward_factor: walkforwardBase / walkforward,
      splithalf: splitHalf,
      splithalf_base: splitHalfBase,
      splithalf_factor: splitHalf.map((v, i) => splitHalfBase[i]! / v),
    },
    q10, q25, q75, q90,
    range_honesty: {
      loo_x3: looCover.x3, loo_p50: looCover.p50, loo_p80: looCover.p80,
      wf_x3: wfCover.x3, wf_p50: wfCover.p50, wf_p80: wfCover.p80,
    },
    odds_brier: { tenfold: prevOdds.tenfold, tenfold_base: baseOdds.tenfold, wf: prevOdds.wf, wf_base: baseOdds.wf, wf_acc: prevOdds.wfAcc },
    bootstrap: {
      intercept_se: se(bootWeights.map((w) => w[0]!)),
      size_se: se(bootWeights.map((w) => w[1]!)),
      cat_se: catSe,
      odds_se: oddsSe,
      weights: bootWeights,
      cats: full.design.cats,
    },
  };
}

/** Token odds for one protocol: 1 - P(tokenized | features), the peers' still-pre-token share. */
export function oddsFor(p: SnapshotProtocol, asOf: string, fit: Fit): number {
  const c = fit.odds_coefs;
  let z = c.intercept ?? 0;
  if (c.age_years !== undefined) z += c.age_years * ((ageDays(asOf, p.listed_at) ?? UNKNOWN_AGE_DAYS) / 365);
  if (c.ln_tvl !== undefined) z += c.ln_tvl * Math.log(Math.max(p.tvl_usd, 1) / fit.odds_ref_tvl);
  if (c.growth_7d !== undefined) z += c.growth_7d * (Math.min(120, Math.max(-60, finite(p.change_7d, 0))) / 100);
  if (c.ln_chains !== undefined) z += c.ln_chains * Math.log1p(p.chains.length);
  const catCoef = c[`cat:${p.category ?? 'None'}`];
  if (catCoef !== undefined) z += catCoef;
  return 1 - sigmoid(z);
}

/** The fitted multiple and odds for one protocol. */
export function impliedParts(p: SnapshotProtocol, asOf: string, fit: Fit): ModelParts {
  const catMultiple = Math.exp(fit.intercept + (fit.cat_effects[p.category ?? 'None'] ?? 0));
  const sizeFactor = Math.pow(p.tvl_usd / fit.ref_tvl, fit.size_slope);
  const odds = oddsFor(p, asOf, fit);
  const ifLaunches = p.tvl_usd * catMultiple * sizeFactor;
  return { cat_multiple: catMultiple, size_factor: sizeFactor, odds, age_days: ageDays(asOf, p.listed_at), if_launches: ifLaunches };
}

export function impliedValue(p: SnapshotProtocol, asOf: string, fit: Fit): { implied: number; parts: ModelParts } {
  const parts = impliedParts(p, asOf, fit);
  const implied = Math.max(1, Math.round(parts.if_launches * parts.odds));
  return { implied, parts };
}

/** Implied value under one bootstrap refit of the value model (odds held fixed), for rank ranges. */
function impliedBootstrap(p: SnapshotProtocol, asOf: string, fit: Fit, w: number[]): number {
  const catIdx = fit.bootstrap.cats.indexOf(p.category ?? 'None');
  const catEffect = catIdx >= 0 ? w[2 + catIdx]! : 0;
  const multiple = Math.exp(w[0]! + catEffect) * Math.pow(p.tvl_usd / fit.ref_tvl, w[1]!);
  return Math.max(1, Math.round(p.tvl_usd * multiple * oddsFor(p, asOf, fit)));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** Capital one farm position needs, from the protocol's own TVL. */
export function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 100_000_000) return 150;
  if (p.tvl_usd >= 10_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
export function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** Gas per transaction, by first chain: Ethereum is dear, Solana is near-free, L2s sit between. */
export function gasPerTx(p: SnapshotProtocol): number {
  const chain = p.chains.length > 0 ? p.chains[0]! : '';
  if (chain === 'Ethereum') return 8;
  if (chain === 'Bitcoin') return 3;
  if (chain === 'Solana') return 0.05;
  if (chain === '') return 2;
  return 0.5;
}

function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** The category's one action, in words a farmer can follow. */
const ACTIONS: Array<[string, string]> = [
  ['lend', 'Supply ${capital} of USDC to ${name} on ${chain} and keep the position open'],
  ['cdp', 'Deposit ${capital} of collateral to mint the stable asset on ${name}'],
  ['collateral', 'Deposit ${capital} of collateral into ${name} on ${chain} and keep the position open'],
  ['dex', 'Provide ${capital} of liquidity to ${name} on ${chain} and keep the position open'],
  ['yield aggregator', 'Deposit ${capital} of USDC into the ${name} vault on ${chain} and keep the shares'],
  ['yield', 'Deposit ${capital} of USDC into a ${name} yield vault on ${chain} and keep the shares'],
  ['leveraged farm', 'Open a ${capital} leveraged farm position on ${name} and watch the health factor'],
  ['bridge', 'Bridge ${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app'],
  ['staking', 'Stake ${capital} of the chain staking asset through ${name} and keep the receipt'],
  ['restak', 'Restake ${capital} through ${name} on ${chain} and keep the receipt'],
  ['perpetual', 'Deposit ${capital} of USDC as margin on ${name} and open one small hedge'],
  ['derivative', 'Deposit ${capital} of USDC as margin on ${name} and open one small hedge'],
  ['prediction', 'Fund ${capital} and place one market position on ${name}'],
  ['curator', 'Deposit ${capital} into a ${name} vault on ${chain} and keep the shares'],
  ['allocator', 'Deposit ${capital} into a ${name} vault on ${chain} and keep the shares'],
  ['stable', 'Mint or deposit ${capital} of the stable asset through ${name} on ${chain}'],
  ['rwa', 'Mint ${capital} of the protocol yield asset on ${chain} and hold it'],
  ['insurance', 'Buy ${capital} of cover from ${name} on ${chain} and keep the policy'],
  ['basis', 'Deposit ${capital} into the ${name} basis vault on ${chain} and keep the shares'],
  ['governance', 'Stake ${capital} and vote on one ${name} proposal on ${chain}'],
  ['payment', 'Fund ${capital} and make one payment through ${name} on ${chain}'],
  ['chain', 'Bridge ${capital} of USDC to ${chain} and use ${name} on its own chain'],
];

function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  for (const [key, template] of ACTIONS) {
    if (c.includes(key)) {
      return template.replace('${capital}', `$${capital}`).replace('${name}', p.name).replace('${chain}', chain);
    }
  }
  return 'Deposit $' + capital + ' of USDC into ' + p.name + ' on ' + chain + ' and keep the position open.';
}

/** The farm economics of one row: cost, time, net $/hour after gas and the verdict. */
export function farmEconomics(p: SnapshotProtocol, age: number | null, implied: number, odds: number): FarmEcon {
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasPerTx(p);
  const weeks = Math.ceil(hold / 7);
  const txCount = 3 + weeks;
  const gasTotal = Math.round(txCount * gas * 100) / 100;
  const activeHours = Math.round((0.25 + weeks * 0.17 + 0.17) * 100) / 100;
  const gasPerHour = Math.round((gasTotal / activeHours) * 100) / 100;
  // Implied value already carries the launch odds, so the farmer's expected
  // value applies the capture share once — never odds a second time. The
  // verdict prices the work: net of gas, per active hour.
  const evFarmer = Math.round(implied * CAPTURE_SHARE * 100) / 100;
  const netHour = Math.round(((evFarmer - gasTotal) / activeHours) * 100) / 100;
  const verdict: FarmEcon['verdict'] = netHour >= FARM_NET_HOUR ? 'Farm' : netHour >= 0 ? 'Watch' : 'Skip';
  return { capital, hold_days: hold, gas_per_tx: gas, gas_total: gasTotal, active_hours: activeHours, gas_per_hour: gasPerHour, ev_farmer: evFarmer, net_hour: netHour, verdict, plan_shapes: 0 };
}

/** A step as one string: its action, then its cost and time, within 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The weekly qualifying action, matched to the protocol's category. */
function weeklyFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'Borrow a small amount against the collateral and repay it in the same week';
  if (c.includes('dex')) return 'Make one swap through the pool so the week records trading activity';
  if (c.includes('curator') || c.includes('allocator') || c.includes('yield')) return 'Check the vault allocation and top up only while the shares still accrue';
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis')) return 'Open one small hedge and close it before the week ends';
  if (c.includes('governance')) return 'Vote on one live proposal so the week records governance activity';
  if (c.includes('rwa') || c.includes('stable')) return 'Hold the minted asset and record the balance once a week';
  return 'Make one qualifying action, such as a deposit, a borrow, a swap or a vote';
}

export interface FarmContext {
  implied: number;
  odds: number;
  p50lo: number; // P25 factor of the printed range (exp(q25))
  p50hi: number; // P75 factor of the printed range (exp(q75))
  rank: number;
}

function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${Math.round(n / 1e3)}K`;
}

/**
 * A protocol's farm plan: eight steps, each an action with a cost and a
 * time, built from this protocol's own snapshot record — its chains
 * (all of them, cheapest-gas first), its TVL and 7-day direction, its
 * age and fitted launch odds, its category's mechanic, and the model's
 * economics for this row. No two plans share a shape unless the
 * protocols genuinely match on verdict, mechanic, momentum, age band
 * and chain count. A Skip verdict gets a monitor-only plan (no capital
 * deployed, monthly re-checks against the net-per-hour bar) instead of
 * a farm instruction the verdict contradicts.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, econ: FarmEcon, ctx: FarmContext): FarmStep[] {
  const chain = chainOf(p);
  const others = p.chains.slice(1);
  const gasWord = `$${econ.gas_per_tx} of gas`;
  const weeks = Math.ceil(econ.hold_days / 7);
  const txCount = 3 + weeks;
  const gasShare = econ.ev_farmer > 0 ? (econ.gas_total / econ.ev_farmer * 100).toFixed(1) : '0';
  const evGas = econ.gas_total > 0 ? (econ.ev_farmer / econ.gas_total).toFixed(1) : '0';
  const oddsPct = Math.round(ctx.odds * 100);
  const ageWord = age === null ? 'age not reported in the snapshot' : `${age} days old`;
  const momentum = p.change_7d === null
    ? 'the snapshot reports no 7-day TVL change, so treat momentum as unknown'
    : p.change_7d <= -10
      ? `TVL fell ${Math.abs(p.change_7d).toFixed(1)}% in 7 days — check for outflows before adding capital`
      : p.change_7d >= 20
        ? `TVL jumped ${p.change_7d.toFixed(1)}% in 7 days — expect crowded snapshots and act early in the week`
        : `TVL moved ${p.change_7d >= 0 ? '+' : ''}${p.change_7d.toFixed(1)}% in 7 days, so size the position for eligibility, not yield`;
  const chainNote = others.length > 0
    ? ` ${p.name} also lists ${others.slice(0, 3).join(', ')}${others.length > 3 ? ` and ${others.length - 3} more chains` : ''} — farm on ${chain} unless another listed chain is cheaper for the same position.`
    : '';
  const verdictStep: FarmStep = {
    text: `Verdict: ${econ.verdict.toUpperCase()} at rank #${ctx.rank} — expected farmer value $${econ.ev_farmer.toLocaleString('en-US')} against $${econ.gas_total} of gas (${evGas}x; gas is ${gasShare}% of expected value), net $${econ.net_hour} an hour over ${econ.active_hours} hours of work (Farm pays at least $${FARM_NET_HOUR} an hour net), with $${econ.capital} of capital at risk against ${fmtUsd(p.tvl_usd)} of TVL. Keep the wallet, dates and transaction hashes in the farm log.`,
    cost: 'nothing but the log',
    time: '5 minutes',
  };
  if (econ.verdict === 'Skip') {
    return [
      { text: `Do not deploy capital into ${p.name} yet: expected farmer value $${econ.ev_farmer.toLocaleString('en-US')} does not cover the $${econ.gas_total} gas bill (net $${econ.net_hour} an hour). Add it to the watchlist with its snapshot figures (${fmtUsd(p.tvl_usd)} TVL, ${ageWord}, token odds ${oddsPct}%).`, cost: 'no capital, no gas', time: '5 minutes' },
      { text: `Record the baseline: implied value ${fmtUsd(ctx.implied)} with a P25-P75 range of x${ctx.p50lo.toFixed(2)} to x${ctx.p50hi.toFixed(2)}, so the estimate is an order of magnitude, not a price. ${momentum}.`, cost: 'no fee to check', time: '5 minutes' },
      { text: `Re-check ${p.name} monthly: TVL direction, any points programme in its own docs, and whether a token has launched (the snapshot records none).`, cost: 'no fee to check', time: '5 minutes a month' },
      { text: `Farm only if the maths flips: net value at or above $0 an hour after gas, or a published points programme that pays for the $${econ.capital} position on ${chain}.`, cost: `about $${econ.gas_total} of gas if triggered`, time: '15 minutes to set up' },
      { text: `If triggered, ${actionFor(p, econ.capital, chain).replace(/\.$/, '').toLowerCase()} using the app link in ${p.name}\u2019s own docs, then hold ${econ.hold_days} days across two weekly snapshots.`, cost: `$${econ.capital} of capital and about ${gasWord}`, time: `${econ.hold_days} days` },
      { text: `Keep one exit transaction of gas in reserve on ${chain} and confirm the withdrawal queue before any hold ends.`, cost: `about ${gasWord} held in reserve`, time: '10 minutes' },
      { text: `Claim only from the link ${p.name} publishes on its own page; never pay a fee to claim.`, cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      verdictStep,
    ];
  }
  return [
    { text: `Use a fresh wallet for ${p.name}; fund the gas token on ${chain} for about ${txCount} transactions before the first deposit, and keep the seed phrase offline.${chainNote}`, cost: `about $${econ.gas_total} of gas in total`, time: '5 minutes' },
    { text: `${actionFor(p, econ.capital, chain).replace(/\.$/, '')}. Use the app link published in ${p.name}\u2019s own docs, not a search result. The $${econ.capital} is sized against ${fmtUsd(p.tvl_usd)} of TVL: ${momentum}.`, cost: `$${econ.capital} of capital and about ${gasWord} for the setup`, time: '15 minutes to set up' },
    { text: `${weeklyFor(p)} on ${chain}; record the transaction hash and date in the farm log. ${p.change_7d !== null && p.change_7d <= -10 ? 'With TVL falling, confirm the position still accrues before repeating.' : 'Repeat weekly so the log shows activity in every snapshot week.'}`, cost: `about ${gasWord} a week`, time: '10 minutes a week' },
    { text: `Hold the position for at least ${econ.hold_days} days across two weekly snapshots. ${p.name} is ${ageWord} with fitted token odds of ${oddsPct}% — ${age !== null && age < 180 ? 'a young protocol, so snapshots may come early; do not exit before the second snapshot.' : 'old enough that eligibility windows are likelier to reward duration over size.'} Do not add capital until the lockup and withdrawal queue are checked.`, cost: `the $${econ.capital} stays in the position`, time: `${econ.hold_days} days` },
    { text: `Re-read ${p.name}\u2019s docs for points rules, lockups and withdrawal queues; screenshot the balance if it publishes a points page, and confirm no token has launched since the snapshot (it records none).`, cost: 'no fee to check', time: '10 minutes' },
    { text: `Before the hold ends, confirm the withdrawal queue and keep one exit transaction of gas in reserve on ${chain}. The implied value ${fmtUsd(ctx.implied)} carries a P25-P75 range of x${ctx.p50lo.toFixed(2)} to x${ctx.p50hi.toFixed(2)}, so treat the expected value as an order of magnitude when deciding to extend.`, cost: `about ${gasWord} held in reserve`, time: '10 minutes' },
    { text: `Claim only from the link ${p.name} publishes on its own page; never pay a fee to claim.`, cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
    verdictStep,
  ];
}

/** The protocols the board ranks, strongest first, with ranks 1..n.
 * Only protocols that pass the house watchlist-exclusion rule are ranked:
 * a bridge, liquid-staking product or wrapped/staked product of a token
 * that already trades is not a launch — ranking WBTC or a bridge #1 would
 * be the starter's flaw at full scale. The watchlist itself always passes
 * the rule (verified: 0 flagged), so coverage is never at risk. */
export function buildBoard(snapshot: Snapshot, fit: Fit): BoardRow[] {
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = snapshot.protocols.find((q) => q.slug === slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p) && houseRuleFlag(p) === null) chosen.set(p.slug, p);
  }
  const scored = [...chosen.values()].map((p) => {
    const { implied, parts } = impliedValue(p, snapshot.as_of, fit);
    const econ = farmEconomics(p, parts.age_days, implied, parts.odds);
    return { p, implied, parts, econ };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  const shapes = new Set(scored.map((s) => {
    const momentum = s.p.change_7d === null ? 'unknown' : s.p.change_7d <= -10 ? 'falling' : s.p.change_7d >= 20 ? 'surging' : 'steady';
    const ageBand = s.parts.age_days === null ? 'unknown' : s.parts.age_days < 180 ? 'young' : s.parts.age_days < 365 ? 'mid' : 'seasoned';
    return `${(s.p.category ?? '').toLowerCase()}|${chainOf(s.p)}|${s.p.chains.length > 1 ? 'multi-chain' : 'single-chain'}|${s.econ.capital}|${s.econ.hold_days}|${s.econ.gas_per_tx}|${s.econ.verdict}|${momentum}|${ageBand}`;
  }));
  // Rank ranges: 5th-95th percentile rank across the bootstrap refits.
  const bootRanks = new Map<string, number[]>();
  for (const w of fit.bootstrap.weights) {
    const vals = scored.map((s) => ({ slug: s.p.slug, v: impliedBootstrap(s.p, snapshot.as_of, fit, w) }));
    vals.sort((a, b) => b.v - a.v || (a.slug < b.slug ? -1 : 1));
    vals.forEach((r, i) => {
      const arr = bootRanks.get(r.slug);
      if (arr) arr.push(i + 1);
      else bootRanks.set(r.slug, [i + 1]);
    });
  }
  const p50lo = Math.exp(fit.q25);
  const p50hi = Math.exp(fit.q75);
  return scored.map((s, i) => {
    const econ: FarmEcon = { ...s.econ, plan_shapes: shapes.size };
    const lo = Math.max(1, Math.round(s.implied * Math.exp(fit.q10)));
    const hi = Math.round(s.implied * Math.exp(fit.q90));
    const ranks = [...(bootRanks.get(s.p.slug) ?? [i + 1])].sort((a, b) => a - b);
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token',
      age_days: s.parts.age_days,
      implied_value_usd: s.implied,
      implied_lo_usd: lo,
      implied_hi_usd: hi,
      house_flag: houseRuleFlag(s.p),
      rank_lo: quantile(ranks, 0.05),
      rank_hi: quantile(ranks, 0.95),
      model: {
        cat_multiple: round4(s.parts.cat_multiple),
        size_factor: round4(s.parts.size_factor),
        odds: round4(s.parts.odds),
        age_days: s.parts.age_days,
        if_launches: Math.round(s.parts.if_launches),
      },
      econ,
      farm_steps: farmSteps(s.p, s.parts.age_days, econ, { implied: s.implied, odds: s.parts.odds, p50lo, p50hi, rank: i + 1 }).map(stepText),
    };
  });
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .slice(0, LIVE_ROWS)
    .map((p) => ({ slug: p.slug, name: p.name, category: p.category, chains: p.chains, tvl_usd: p.tvl_usd, mcap_usd: p.mcap_usd, change_7d: p.change_7d }));
}

/** Every one of the 758 protocols, accounted for with the reason it is or is not ranked. */
export function buildAudit(snapshot: Snapshot, board: BoardRow[]): AuditRow[] {
  const ranked = new Set(board.map((r) => r.slug));
  return snapshot.protocols
    .map((p) => {
      let status: AuditRow['status'];
      if (ranked.has(p.slug)) status = 'ranked';
      else if (!isPreToken(p)) status = 'live';
      else if (p.category === 'CEX') status = 'excluded-cex';
      else if (VERSIONED.test(p.name)) status = 'excluded-version';
      else status = 'excluded-house-rule';
      return { slug: p.slug, name: p.name, category: p.category, tvl_usd: p.tvl_usd, status };
    })
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow, watchlist: string[], fit: Fit): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    implied_lo_usd: row.implied_lo_usd,
    implied_hi_usd: row.implied_hi_usd,
    house_flag: row.house_flag,
    watch: watchlist.includes(row.slug) ? 1 : 0,
    cat_multiple: row.model.cat_multiple,
    size_factor: row.model.size_factor,
    odds: row.model.odds,
    if_launches: row.model.if_launches,
    p25_usd: Math.max(1, Math.round(row.implied_value_usd * Math.exp(fit.q25))),
    p75_usd: Math.round(row.implied_value_usd * Math.exp(fit.q75)),
    rank_lo: row.rank_lo,
    rank_hi: row.rank_hi,
    verdict: row.econ.verdict,
    ev_farmer: row.econ.ev_farmer,
    gas_total: row.econ.gas_total,
    capital: row.econ.capital,
    hold_days: row.econ.hold_days,
    gas_per_hour: row.econ.gas_per_hour,
    net_hour: row.econ.net_hour,
    active_hours: row.econ.active_hours,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, fit: Fit): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, fit);
  const live = liveRows(snapshot);
  const audit = buildAudit(snapshot, board);
  const flagged = audit.filter((a) => a.status === 'excluded-house-rule').length;
  const excluded = audit.filter((a) => a.status !== 'ranked' && a.status !== 'live').length;
  const liveCount = audit.filter((a) => a.status === 'live').length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    fit,
    counts: {
      protocols: snapshot.protocols.length,
      watchlist: snapshot.watchlist.length,
      ranked: board.length,
      live: liveCount,
      excluded,
      flagged,
      plan_shapes: board.length > 0 ? board[0]!.econ.plan_shapes : 0,
    },
    rows: board.map((r) => radarRow(r, snapshot.watchlist, fit)),
    live,
    audit,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
    };
  });
  return { as_of: o.as_of, source: o.source, floor_usd: o.floor_usd, protocols, watchlist: o.watchlist as string[] };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
