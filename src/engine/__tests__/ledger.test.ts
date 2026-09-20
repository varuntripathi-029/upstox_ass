// FIFO lot rebuilding: multiple buys, partial sells, split/bonus, reconciliation with holdings.
import { describe, expect, it } from 'vitest'
import { buildLedger } from '../ledger'
import { daysBetween, financialYearOf, istDay } from '../dates'
import { formatINR } from '../money'
import { portfolio, rs, trade, NO_CHARGES } from './helpers'

describe('FIFO', () => {
  it('multiple buys and partial sells consume the oldest lots, splitting cost pro rata', () => {
    const l = buildLedger(
      portfolio({
        trades: [
          trade('X', '2026-01-05', 'BUY', 10, 100),
          trade('X', '2026-02-02', 'BUY', 10, 130),
          trade('X', '2026-03-02', 'SELL', 4, 150),
          trade('X', '2026-04-06', 'SELL', 10, 160),
        ],
        holdings: [{ symbol: 'X', qty: 6, avgPricePaise: rs(130), ltpPaise: rs(150) }],
      }),
    )
    expect(l.realized.map((s) => [s.sellDay, s.qtyM / 1000, s.actualCost, s.gain])).toEqual([
      ['2026-03-02', 4, rs(400), rs(200)],
      ['2026-04-06', 6, rs(600), rs(360)],
      ['2026-04-06', 4, rs(520), rs(120)],
    ])
    expect(l.openLots).toMatchObject([{ acquired: '2026-02-02', qtyM: 6000, cost: rs(780) }])
  })

  it('charges are split across lots without losing a paisa', () => {
    const c = { ...NO_CHARGES, brokerage: 2000, gst: 360, stamp: 7 }
    const l = buildLedger(
      portfolio({
        trades: [trade('X', '2026-01-05', 'BUY', 3, 100, { charges: c }), trade('X', '2026-02-05', 'SELL', 1, 100), trade('X', '2026-02-06', 'SELL', 2, 100)],
      }),
    )
    expect(l.realized.reduce((a, s) => a + s.actualCost, 0)).toBe(rs(300) + 2367)
  })
})

describe('corporate actions', () => {
  it('split 1:5: 5× the units, same cost and acquisition date', () => {
    const l = buildLedger(
      portfolio({
        trades: [trade('X', '2025-03-03', 'BUY', 10, 1000)],
        corporateActions: [{ symbol: 'X', exDay: '2025-09-15', type: 'SPLIT', from: 1, to: 5 }],
        holdings: [{ symbol: 'X', qty: 50, avgPricePaise: rs(200), ltpPaise: rs(250) }],
      }),
    )
    expect(l.openLots).toMatchObject([{ acquired: '2025-03-03', qtyM: 50_000, cost: rs(10_000), source: 'TRADE' }])
    expect(l.warnings).toEqual([])
  })

  it('bonus 1:1: a new zero-cost lot acquired on the ex-date, sold after the original lot (FIFO)', () => {
    const l = buildLedger(
      portfolio({
        trades: [trade('X', '2025-03-03', 'BUY', 10, 1000), trade('X', '2026-06-01', 'SELL', 15, 600)],
        corporateActions: [{ symbol: 'X', exDay: '2025-08-26', type: 'BONUS', from: 1, to: 1 }],
        holdings: [{ symbol: 'X', qty: 5, avgPricePaise: 0, ltpPaise: rs(600) }],
      }),
    )
    expect(l.realized.map((s) => [s.acquired, s.qtyM / 1000, s.actualCost, s.gain, s.bucket])).toEqual([
      ['2025-03-03', 10, rs(10_000), -rs(4_000), 'EQ_LT'],
      ['2025-08-26', 5, 0, rs(3_000), 'EQ_ST'],
    ])
    expect(l.openLots).toMatchObject([{ acquired: '2025-08-26', qtyM: 5000, cost: 0, source: 'BONUS' }])
  })
})

describe('reconciliation with the holdings snapshot', () => {
  it('units with no buy trade get the broker average price, flagged approximate and long-term', () => {
    const l = buildLedger(portfolio({ trades: [], holdings: [{ symbol: 'X', qty: 10, avgPricePaise: rs(90), ltpPaise: rs(100) }] }))
    expect(l.openLots).toMatchObject([{ acquired: null, qtyM: 10_000, cost: rs(900), approximate: true, source: 'UNEXPLAINED' }])
    expect(l.warnings).toHaveLength(1)
  })
  it('mutual fund units keep 3 decimals exactly', () => {
    const l = buildLedger(
      portfolio({
        trades: [trade('MF', '2025-05-05', 'BUY', 12.345, 81.2345, { segment: 'MF' }), trade('MF', '2026-06-01', 'SELL', 2.345, 90, { segment: 'MF' })],
        instruments: { MF: 'EQUITY_MF' },
        holdings: [{ symbol: 'MF', qty: 10, avgPricePaise: 8123, ltpPaise: 9000 }],
      }),
    )
    expect(l.openLots[0].qtyM).toBe(10_000)
    expect(l.realized[0].bucket).toBe('EQ_LT')
  })
})

describe('dates and money helpers (Asia/Kolkata)', () => {
  it('a trade at 00:30 IST belongs to that IST day, not the UTC day', () => {
    expect(istDay('2026-04-01T00:30:00+05:30')).toBe('2026-04-01')
    expect(istDay('2026-03-31T19:30:00Z')).toBe('2026-04-01')
  })
  it('financial year and day counts', () => {
    expect(financialYearOf('2026-09-18')).toMatchObject({ label: '2026-27', start: '2026-04-01', end: '2027-03-31' })
    expect(financialYearOf('2027-03-31').label).toBe('2026-27')
    expect(daysBetween('2025-10-10', '2026-09-18')).toBe(343)
  })
  it('formats Indian rupees', () => {
    expect(formatINR(1_02_500_00)).toBe('₹1,02,500')
  })
})
