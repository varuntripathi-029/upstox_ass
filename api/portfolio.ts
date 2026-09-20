import { readSession } from './_lib/session'
import { upstoxGet, json, badRequest } from './_lib/upstox'

export default async function (request: Request): Promise<Response> {
  const session = await readSession(request)
  if (!session) {
    return badRequest('Not authenticated')
  }

  const token = session.accessToken

  // Helper to fetch with a default empty shape if the API returns 404/400 due to no demat account
  const fetchSafe = async (path: string, defaultData: any) => {
    const res = await upstoxGet(path, token)
    if (res.ok) return res.data
    // If the account has no trades/holdings, Upstox might return 404 or 400.
    console.warn(`Upstox API ${path} returned ${res.status}: ${res.body}`)
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
