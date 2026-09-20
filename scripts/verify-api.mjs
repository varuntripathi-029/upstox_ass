import https from 'node:https'

const URLS = [
  'https://upstox-ass.vercel.app/api/upstox/mf-navs?isins=INF879O01027',
  'https://upstox-ass.vercel.app/api/upstox/instruments',
  'https://upstox-ass.vercel.app/api/upstox/ltp?instrument_token=NSE_EQ|INE040A01034',
  'https://upstox-ass.vercel.app/api/health'
]

async function checkUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve({ status: res.statusCode, data }))
    }).on('error', reject)
  })
}

async function main() {
  let hasError = false
  for (const url of URLS) {
    console.log(`Checking ${url}...`)
    try {
      const { status, data } = await checkUrl(url)
      // 500 FUNCTION_INVOCATION_FAILED is the error we are explicitly looking for
      if (status === 500) {
        console.error(`❌ FAIL: ${url} returned 500!\nResponse: ${data.slice(0, 100)}`)
        hasError = true
      } else {
        console.log(`✅ OK: ${url} returned ${status}`)
      }
    } catch (e) {
      console.error(`❌ FAIL: ${url} request failed: ${e.message}`)
      hasError = true
    }
  }
  if (hasError) {
    console.error('\nOne or more endpoints returned a 500. Vercel deployment failed or functions crashed.')
    process.exit(1)
  } else {
    console.log('\nAll API endpoints passed the basic check!')
  }
}

main()
