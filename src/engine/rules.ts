// Every tax value the engine uses, in one place (PRODUCT.md §9, tax year 2026-27).
// Rules encoded as of September 2026.
// Official source of truth: Income-tax Act, 2025 as amended by Finance Act 2026
// https://www.incometaxindia.gov.in/documents/d/guest/income_tax_act_2025_as_amended_by_fa_act_2026-pdf
//
// Rates are basis points (1% = 100 bps). Money is paise (₹1 = 100).

const RUPEE = 100
const LAKH = 1_00_000 * RUPEE

// New section numbers under the Income-tax Act, 2025 (old 1961 section in brackets)
// https://taxguru.in/income-tax/capital-gains-income-tax-act-2025-tax-period-2026-27.html
export const SECTIONS = {
  stcgEquity: 'Sec 196 (earlier 111A)',
  ltcgOther: 'Sec 197 (earlier 112)',
  ltcgEquity: 'Sec 198 (earlier 112A)',
  rebate: 'Sec 156 (earlier 87A)',
} as const

// R1: short-term gains on listed equity / equity MF / equity ETF (held ≤ 12 months): 20%
// https://www.angelone.in/news/taxation/union-budget-2026-ltcg-tax-unchanged-at-12-5-stt-on-commodity-futures-hiked
export const R1_STCG_EQUITY_BPS = 2000
export const EQUITY_LONG_TERM_AFTER_MONTHS = 12 // "held more than 12 months"

// R2: long-term gains on the same assets: 12.5% above ₹1,25,000 a year (limit shared across brokers)
// https://www.angelone.in/news/taxation/union-budget-2026-ltcg-tax-unchanged-at-12-5-stt-on-commodity-futures-hiked
export const R2_LTCG_EQUITY_BPS = 1250
export const R2_LTCG_EXEMPTION = 1.25 * LAKH

// R3: 4% health & education cess on the tax (20% → 20.8%, 12.5% → 13%)
// https://tax2win.in/guide/short-term-capital-gain-under-section-111a
export const R3_CESS_BPS = 400

// R4: surcharge on R1/R2/R6 gains is capped at 15%; surcharge only above ₹50L income.
// https://tax2win.in/guide/short-term-capital-gain-under-section-111a
// Slab rates below are NOT in PRODUCT.md §9 (only the cap is). New-regime surcharge,
// max 25%: https://cleartax.in/s/income-tax-slabs . Marginal relief is not modelled.
export const R4_SURCHARGE_CAP_ON_GAINS_BPS = 1500
export const R4_SURCHARGE_SLABS: ReadonlyArray<{ above: number; bps: number }> = [
  { above: 2 * 100 * LAKH, bps: 2500 },
  { above: 1 * 100 * LAKH, bps: 1500 },
  { above: 50 * LAKH, bps: 1000 },
]

// R5: debt MF (>65% debt) bought on or after 1 Apr 2023: slab rate, whatever the holding period (Sec 50AA)
// https://cleartax.in/s/section-50aa-income-tax-act
export const R5_DEBT_MF_SLAB_FROM = '2023-04-01'

// R6: gold / international / other non-equity ETFs and funds: not equity.
// Long-term after 12 months if listed, at 12.5%, with NO ₹1.25L exemption. Short-term at slab.
// https://www.finnovate.in/learn/blog/debt-fund-taxation-india-fair-treatment
export const R6_LTCG_NON_EQUITY_BPS = 1250
export const R6_LISTED_LONG_TERM_AFTER_MONTHS = 12
// Assumption (not in §9): unlisted non-equity funds (FoFs, pre-Apr-2023 debt MF) turn long-term after 24 months.
export const UNLISTED_LONG_TERM_AFTER_MONTHS = 24

// R7: capital losses. Short-term losses cancel short- or long-term gains; long-term losses
// cancel only long-term gains. Carry forward 8 years if the ITR is filed on time.
// https://taxguru.in/income-tax/capital-gains-income-tax-act-2025-tax-period-2026-27.html
export const R7_CAPITAL_LOSS_CARRY_YEARS = 8

// R8: lot order is FIFO for demat holdings (CBDT Circular 768)
// https://incometaxindia.gov.in/communications/circular/910110000000000355.htm
export const R8_LOT_ORDER = 'FIFO' as const

// R9: grandfathering. Gains up to 31 Jan 2018 are exempt for equity bought before 1 Feb 2018.
// https://taxharvestlab.com/blog/grandfathering-clause-ltcg
export const R9_GRANDFATHER_BOUGHT_BEFORE = '2018-02-01'
export const R9_FMV_DAY = '2018-01-31'

// R10: unused basic exemption (resident individuals, new regime). If other income is below ₹4L,
// the unused part absorbs short- and long-term gains.
// https://upstox.com/news/personal-finance/tax/can-i-adjust-stcg-ltcg-against-the-basic-exemption-limit-under-both-old-and-new-tax-regimes/article-165394/
export const R10_BASIC_EXEMPTION = 4 * LAKH

// R11: Section 156 rebate (earlier 87A): up to ₹60,000 for taxable income up to ₹12L.
// Not available against special-rate gains (R1, R2; also applied to R6 long-term).
// https://cleartax.in/s/section-156-income-tax-act-2025
export const R11_REBATE_MAX = 60_000 * RUPEE
export const R11_REBATE_INCOME_LIMIT = 12 * LAKH

// R12: buyback proceeds. From 1 Apr 2026 taxed as capital gains again. Between 1 Oct 2024 and
// 31 Mar 2026 taxed as dividend (slab), with the cost of the shares becoming a capital loss.
// https://upstox.com/news/personal-finance/tax/fm-nirmala-sitharaman-changes-share-buybacks-income-tax-rules-investors-to-pay-capital-gains-tax/article-188702/
export const R12_BUYBACK_AS_DIVIDEND_FROM = '2024-10-01'
export const R12_BUYBACK_AS_CAPITAL_GAIN_FROM = '2026-04-01'

// R13: same-day sell + buy of the same stock counts as intraday; harvesting must buy back the NEXT trading day.
// https://1finance.co.in/blog/tax-loss-harvesting-march-31-save-capital-gains-from-stocks-mutual-funds/
export const R13_BUY_BACK_AFTER_DAYS = 1

// R14: intraday = speculative business income at slab. Losses cancel only intraday profits; carry forward 4 years.
// https://www.caclubindia.com/articles/fo-intraday-and-share-trading-losses-how-to-claim-maximum-tax-benefit-through-itr3-setoff-and-carry-forward-55793.asp
export const R14_INTRADAY_LOSS_CARRY_YEARS = 4

// R15: F&O = non-speculative business income at slab. Losses cancel other income except salary; carry forward 8 years.
// https://www.caclubindia.com/articles/fo-intraday-and-share-trading-losses-how-to-claim-maximum-tax-benefit-through-itr3-setoff-and-carry-forward-55793.asp
export const R15_FNO_LOSS_CARRY_YEARS = 8

// R16: STT on F&O from 1 Apr 2026: futures 0.05%, options 0.15%
// https://www.bajajamc.com/knowledge-centre/union-budget-2026
export const R16_STT_FUTURES_BPS = 5
export const R16_STT_OPTIONS_BPS = 15
export const R16_STT_HIKE_FROM = '2026-04-01'

// R17: F&O / intraday turnover per the ICAI Guidance Note on tax audit (Aug 2022 edition):
// sum of absolute profit/loss per trade.
// https://taxsocial.pro/article/fno-intraday-trading-taxation-ay-2026-27-itr-3-audit-44ad
export const R17_TURNOVER_METHOD = 'ICAI Guidance Note on Tax Audit (Aug 2022): Σ |profit or loss| per trade'

// R18: new-regime slabs, and the ₹75,000 standard deduction for salaried
// https://cleartax.in/s/income-tax-slabs
export const R18_SLABS: ReadonlyArray<{ upTo: number; bps: number }> = [
  { upTo: 4 * LAKH, bps: 0 },
  { upTo: 8 * LAKH, bps: 500 },
  { upTo: 12 * LAKH, bps: 1000 },
  { upTo: 16 * LAKH, bps: 1500 },
  { upTo: 20 * LAKH, bps: 2000 },
  { upTo: 24 * LAKH, bps: 2500 },
  { upTo: Infinity, bps: 3000 },
]
export const R18_STANDARD_DEDUCTION = 75_000 * RUPEE

// R19: ITR form. ITR-1 only long-term equity ≤ ₹1.25L and nothing else; ITR-2 other capital gains; ITR-3 intraday / F&O.
// https://zerodha.com/varsity/chapter/itr-forms/
export const R19_ITR1_MAX_LTCG = 1.25 * LAKH

// R20: filing deadlines. ITR-1/2: 31 July. ITR-3 without audit: 31 August (made permanent by Finance Act 2026).
// https://www.jmfinancialservices.in/blogs-and-articles/itr-3-and-itr-4-filing-deadline-extended-to-31st-august-2026
export const R20_DEADLINE_ITR12 = { month: 7, day: 31 }
export const R20_DEADLINE_ITR3 = { month: 8, day: 31 }

// R21: advance tax if total tax > ₹10,000: 15% by 15 Jun, 45% by 15 Sep, 75% by 15 Dec, 100% by 15 Mar.
// Tax on capital gains can be paid in the remaining instalments without interest.
// https://taxguru.in/income-tax/section-234c-interest-relaxed-dividend-income-capital-gain.html
export const R21_ADVANCE_TAX_THRESHOLD = 10_000 * RUPEE
export const R21_INSTALMENTS: ReadonlyArray<{ month: number; day: number; cumulativePct: number }> = [
  { month: 6, day: 15, cumulativePct: 15 },
  { month: 9, day: 15, cumulativePct: 45 },
  { month: 12, day: 15, cumulativePct: 75 },
  { month: 3, day: 15, cumulativePct: 100 },
]

// R22: grandfathered cost (equity bought before 1 Feb 2018) = higher of actual cost or FMV,
// with FMV capped at the sale price. FMV = highest price on 31 Jan 2018 (MF: NAV on 31 Jan 2018).
// https://taxguru.in/income-tax/tax-ltcg-listed-shares-securities-wef-01-04-2018-section-1038.html
export const R22_FMV_BASIS = 'highest price quoted on 31 Jan 2018'

// R23: cost basis. Buy-side stamp duty is added to cost; STT is NOT deductible.
// (Taken from casparser; confirm with a CA source.) https://github.com/codereverser/casparser
// Assumption: brokerage, GST, exchange, SEBI and DP charges are also deductible
// (cost of acquisition / expense on transfer). For intraday and F&O (business income),
// every charge including STT is deductible.
export const R23_NON_DEDUCTIBLE_FOR_CAPITAL_GAINS = ['stt'] as const

// R24: stamp duty on mutual fund purchases: 0.005% of the amount (lump sum and every SIP instalment, since 1 Jul 2020).
// Units allotted = amount × (1 − 0.00005) ÷ NAV, floored to 3 decimals. Cost basis = the full amount paid (R23).
// https://files.hdfcfund.com/s3fs-public/2020-07/FAQs%20on%20Stamp%20Duty.pdf
// https://groww.in/blog/stamp-duty-on-mutual-fund-investors
export const R24_MF_STAMP_DUTY_PER_MILLION = 50 // 0.005% = 50 per 10,00,000
export const R24_MF_STAMP_FROM = '2020-07-01'

// R25: ELSS lock-in. Each purchase (every SIP instalment separately) is locked for 3 years from its allotment date.
// The engine treats a lot as unlocked from the day AFTER the 3rd anniversary (conservative: never unlocked early).
// https://cleartax.in/s/elss-lock-in-period
export const R25_ELSS_LOCK_MONTHS = 36

// MF lots (with R8): each SIP instalment is its own lot with its own 12-month clock; redemptions are FIFO.
// Allotment date = the first NAV date on or after the SIP date.
// https://www.dspim.com/knowledge-hub/personal-finance-guide/tax-on-sip-investments-how-each-instalment-is-taxed
// https://upstox.com/news/personal-finance/tax/how-capital-gains-tax-on-equity-mutual-funds-is-calculated-using-the-fifo-method/article-185996/

export const RULES_AS_OF = 'Rules encoded as of September 2026.'
