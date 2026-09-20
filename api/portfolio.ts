import { readSession } from './_lib/session.js'
import { upstoxGet, json, unauthorized } from './_lib/upstox.js'

export async function GET(request: Request): Promise<Response> {
  const session = await readSession(request)
  if (!session) {
    // No session, or it expired at 3:30 AM IST: 401 tells the UI to offer "reconnect".
    return unauthorized('no_session', 'Not authenticated. Connect Upstox to load this account.')
  }

  const token = session.accessToken

  // An account with no holdings or trades is not an error: those calls answer 404/400 and we keep the
  // empty shape so the UI can show a correct empty state. A 401 means the token died, and that one
  // does have to reach the user as "reconnect".
  let expired = false
  const fetchSafe = async <T,>(path: string, defaultData: T): Promise<T> => {
    const res = await upstoxGet<T>(path, token)
    if (res.ok) return res.data
    if (res.status === 401) expired = true
    console.warn(`upstox ${path} -> ${res.status}`) // status only: never the token, never the body
    return defaultData
  }

  // To keep the function simple and under Vercel limits, we fetch the first page of trades.
  // In a real product, we would paginate through all pages.
  // We use fixed dates for the last 3 FYs (2425, 2526, 2627).
  
  const [
    holdings,
    mfHoldings,
    tradesEq,
    tradesMf,
    charges2425,
    charges2526,
    charges2627
  ] = await Promise.all([
    fetchSafe('/v2/portfolio/long-term-holdings', { data: [] }),
    fetchSafe('/v2/mf/holdings', { data: [] }),
    fetchSafe('/v2/charges/historical-trades?segment=EQ&page_number=1&page_size=5000', { data: [], page_meta: { total_records: 0 } }),
    fetchSafe('/v2/charges/historical-trades?segment=MF&page_number=1&page_size=5000', { data: [], page_meta: { total_records: 0 } }),
    fetchSafe('/v2/trade/profit-loss/charges?segment=EQ&financial_year=2425', { data: { charges_breakdown: {} } }),
    fetchSafe('/v2/trade/profit-loss/charges?segment=EQ&financial_year=2526', { data: { charges_breakdown: {} } }),
    fetchSafe('/v2/trade/profit-loss/charges?segment=EQ&financial_year=2627', { data: { charges_breakdown: {} } }),
  ])

  if (expired) return unauthorized('expired', 'Session expired, reconnect.')

  // Assemble into the AccountResponses shape the frontend expects
  const portfolio = {
    asOf: new Date().toISOString(),
    holdings,
    mfHoldings,
    trades: tradesEq,
    mfTrades: tradesMf,
    charges: {
      '2425': charges2425,
      '2526': charges2526,
      '2627': charges2627,
    }
  }

  return json(portfolio)
}
