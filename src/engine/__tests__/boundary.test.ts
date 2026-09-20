// R1/R2 holding-period boundary: long-term means held MORE than 12 months, counted from trade dates.
// The first long-term day is the day after the 12-month (calendar) anniversary of the buy date.
import { describe, expect, it } from 'vitest'
import { analyze } from '../analyze'
import { chipText, GAIN_HARVEST_NOTE, KEEP_NOTE, lossPanel, POSITIONING, profitTakeaway, UPSTOX_TLH_URL, waitPanel } from '../copy'
import { longTermFrom } from '../dates'
import { samplePortfolio, sampleSettings } from '../../sample/portfolio'
import { portfolio, rs, salaried, trade } from './helpers'

/** Tax (A2) and bucket for 100 shares bought at ₹100 and sold at ₹190 (₹9,000 gain) on `sold`. */
function sellOn(bought: string, sold: string) {
  const r = analyze(
    portfolio({ trades: [trade('X', bought, 'BUY', 100, 100), trade('X', sold, 'SELL', 100, 190)], asOf: `${sold}T18:00:00+05:30` }),
    salaried(9_00_000),
  )
  const active = r.buckets.filter((b) => b.active).map((b) => b.id)
  return { tax: r.summary.tax, buckets: active }
}

describe('selling on the anniversary is short-term, the day after is long-term', () => {
  it('bought 10 Oct 2025: sold 10 Oct 2026 → short-term, ₹1,872 tax', () => {
    expect(sellOn('2025-10-10', '2026-10-10')).toEqual({ tax: rs(1_872), buckets: ['EQ_ST'] })
  })
  it('bought 10 Oct 2025: sold 11 Oct 2026 → long-term, ₹0 (within ₹1.25L)', () => {
    expect(sellOn('2025-10-10', '2026-10-11')).toEqual({ tax: 0, buckets: ['EQ_LT'] })
  })
  it('the first long-term day is the day after the anniversary', () => {
    expect(longTermFrom('2025-10-10', 12)).toBe('2026-10-11') // sample INFY lot
  })
})

describe('leap year: bought 29 Feb 2028', () => {
  // The 12-month anniversary of 29 Feb 2028 is 28 Feb 2029 (no 29 Feb in 2029).
  it('turns long-term on 1 Mar 2029', () => expect(longTermFrom('2028-02-29', 12)).toBe('2029-03-01'))
  it('sold 28 Feb 2029 → short-term', () => expect(sellOn('2028-02-29', '2029-02-28').buckets).toEqual(['EQ_ST']))
  it('sold 1 Mar 2029 → long-term', () => expect(sellOn('2028-02-29', '2029-03-01').buckets).toEqual(['EQ_LT']))
  it('days left counts calendar days to the first long-term day', () => {
    const r = analyze(
      portfolio({
        trades: [trade('X', '2028-02-29', 'BUY', 10, 100)],
        holdings: [{ symbol: 'X', qty: 10, avgPricePaise: rs(100), ltpPaise: rs(120) }],
        asOf: '2029-02-01T18:00:00+05:30',
      }),
      salaried(9_00_000),
    )
    expect(r.holdings[0].lots[0]).toMatchObject({ daysHeld: 338, daysLeft: 28, longTermFrom: '2029-03-01', longTerm: false })
  })
})

describe('chip and panel copy use the first long-term day', () => {
  const r = analyze(samplePortfolio, sampleSettings)
  const chip = (s: string) => chipText(r.holdings.find((h) => h.symbol === s)!.chip!)
  it('holdings chips', () => {
    expect(chip('INFY')).toBe('⏳ 23 days to long-term · long-term from 11 Oct · wait and save ₹1,872')
    expect(chip('TATAMOTORS')).toBe('⏳ 110 days to long-term · long-term from 6 Jan · save ₹874')
    expect(chip('NIFTYBEES')).toBe('⏳ 177 days to long-term · long-term from 14 Mar · save ₹541')
    expect(chip('ITC')).toBe("Loss · can cut this year's tax by ₹229")
    expect(chip('HDFCBANK')).toBe('Long-term · ₹31,400 can be booked tax-free')
  })
  it('wait panel: sell on or after the first long-term day', () => {
    expect(waitPanel(r.strategies.waitForLongTerm[0])).toEqual({
      headline: 'Wait 23 days, save ₹1,872',
      today: 'Sell today: ₹1,872 short-term tax',
      later: 'Sell on or after 11 Oct 2026: ₹0 tax',
      remind: 'Remind me on 11 Oct 2026',
    })
  })
  it('sample days held match PRODUCT.md §10 (343 / 302 / 256 / 189 / 410)', () => {
    expect(r.holdings.map((h) => [h.symbol, h.lots[0].daysHeld])).toEqual([
      ['HDFCBANK', 410],
      ['INFY', 343],
      ['ITC', 302],
      ['TATAMOTORS', 256],
      ['NIFTYBEES', 189],
    ])
    expect(r.holdings[0].lots[0].longTerm).toBe(true)
  })
})

describe('copy', () => {
  it('says "1 day", not "1 days"', () => {
    expect(chipText({ kind: 'WAIT', days: 1, date: '2026-10-11', saving: 187200 })).toBe('⏳ 1 day to long-term · long-term from 11 Oct · wait and save ₹1,872')
    expect(waitPanel({ symbol: 'INFY', days: 1, date: '2026-10-11', gain: 0, taxToday: 0, taxOnDate: 0, saving: 187200 }).headline).toBe('Wait 1 day, save ₹1,872')
  })
})

describe('profit takeaway', () => {
  it('Priya: charges took more than tax', () => {
    expect(profitTakeaway(analyze(samplePortfolio, sampleSettings))).toBe('You keep ₹85 of every ₹100 you made. Charges took more than tax (₹3,420 vs ₹3,078).')
  })
})

describe('building on Upstox tax-loss harvesting', () => {
  const r = analyze(samplePortfolio, sampleSettings)
  it('the loss panel shows the ₹ figure and hands off to Upstox TLH', () => {
    expect(lossPanel(r.strategies.lossHarvest)).toMatchObject({
      title: '₹1,100 of losses could cut this year’s tax by ₹229',
      button: { label: 'Open Upstox tax-loss harvesting', href: 'https://account.upstox.com/reports/tax-loss-harvesting' },
    })
    expect(UPSTOX_TLH_URL).toBe('https://account.upstox.com/reports/tax-loss-harvesting')
  })
  it('positioning, gain-harvest and A4 wording', () => {
    expect(POSITIONING).toBe("Upstox's tax-loss harvesting handles the 31 March moment. Tax & Cost Insights handles the other 11 months: before every sell.")
    expect(GAIN_HARVEST_NOTE).toBe('Tax-loss harvesting covers losses. This uses your ₹1.25L tax-free limit on gains.')
    expect(KEEP_NOTE).toBe("You actually keep, after tax and charges. Upstox's Realised P&L shows after-charges only.")
  })
})
