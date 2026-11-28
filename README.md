# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/BokeXe/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/BokeXe/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token launch radar for make.fun's `token-radar-01` bounty ($1,325, top 10).
It reads the sealed DefiLlama snapshot (758 protocols, 2026-11-14), ranks
every pre-token protocol that passes the house watchlist-exclusion rule
(198 rows: the 40-protocol watchlist plus 158 more), and hands in a
dashboard a reader can use: a sortable, filterable board, a detail view
for every protocol, a live-token view, a full 758-protocol audit, and a
method page with a model sandbox. 91 pre-token protocols match the house
rule (bridge, liquid-staking, wrapped/staked, exchange-prefixed) and are
excluded from the board with their reason in the audit — a wrapped
product of a token that already trades is not a launch.

The model (radar-8) is fitted, not hardcoded, and every term survived
two held-out tests. Value if a token launches: median regression of
log(mcap/TVL) on ln TVL plus ridge-4 category effects, fitted on the
snapshot's 94 traded comps of kinds the board can rank; 7-day growth,
age and chain count fail a test and stay out. Token odds: a ridge
logistic fit on 383 dated peers (192 record a token), scored by Brier
in ten-fold and walk-forward; growth enters through the odds. Every
row carries P25–P75 and P10–P90 ranges from signed leave-one-out
residuals (walk-forward coverage 58% / 75% against stated 50% / 80%),
a bootstrap rank range (200 refits), and a costed farm verdict
(Farm / Watch / Skip) priced on net dollars per hour after gas at a
0.5bp capture share. The board opens with six evidence cards, a
coverage proof accounting for all 758 protocols — a stacked bar, the
largest excluded products named (WBTC, Binance staked ETH, Coinbase
Bridge), and the ranked board's breadth (33 categories, 116 chains,
watchlist ranks #2–#187) — an out-of-sample evidence panel with both
term tables, and any three rows can be pinned into a side-by-side
compare tray. Farm plans run to eight steps with a gas budget for the
whole transaction count and an exit reserve.

`main.ts` (Node 22, standard library only) reads the snapshot, writes
`board.json`, `data.js`, `dashboard/` and `screenshots/` to `/output`, and
writes `dossier.json` with the vendored `vendor/makefun-board.ts`. Both
runs write identical bytes: fixed snapshot date, no clock, no randomness.

Run it: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>`

## Build status (verified locally, Node 22.18 + system Node 24)

- Board: **198 rows** (40/40 watchlist covered), ranks 1–198, implied
  values non-increasing. Rank 1 Sentora Curator $21,755,779; rank 2
  Steakhouse Financial $19,838,287; rank 3 Gauntlet $18,825,095.
- Fit (94 traded comps): size slope −0.608 ± 0.114 at ref TVL
  $26,156,144, baseline multiple ×0.298. Typical miss vs a flat median
  multiple: LOO ×3.36 vs ×4.60, walk-forward ×2.15 vs ×4.08. Token
  odds Brier: ten-fold 0.196, walk-forward 0.207 (base rate 0.252 /
  0.352). Ranges: P25–P75 walk-forward coverage 58% (stated 50%),
  P10–P90 75% (stated 80%).
- Verdicts: Farm 17 / Watch 120 / Skip 61. 187 distinct farm plan shapes.
- Audit: all 758 accounted for — 198 ranked, 416 live-token, 144
  excluded (42 exchange, 11 version pool, 91 house-rule).
- Determinism: two runs byte-identical. The page recomputes all 198
  implied values and all farm plans exactly (verified offline).
- Dossier: **796,319 bytes** (dashboard source 65,318 B, under the
  65,536 B text cap; 3 JPEG screenshots 1440×900 from headless
  Chromium renders of this dashboard). All 7 local gate rows pass;
  `dossier.json` rebuilds byte-identical via `buildDossier`.
