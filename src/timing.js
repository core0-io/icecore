// records request counts and durations for signing calls vs everything else while a query runs
export function measureFetches() {
  const original = globalThis.fetch
  const stats = { sign: { count: 0, ms: 0 }, other: { count: 0, ms: 0 }, peak: 0 }
  let inFlight = 0
  globalThis.fetch = async (input, init) => {
    const kind = String(input?.url ?? input).includes('/sign') ? 'sign' : 'other'
    const started = performance.now()
    stats.peak = Math.max(stats.peak, ++inFlight)
    try {
      return await original(input, init)
    } finally {
      inFlight--
      stats[kind].count++
      stats[kind].ms += performance.now() - started
    }
  }
  return () => {
    globalThis.fetch = original
    const avg = ({ count, ms }) => count ? `${count} × ${Math.round(ms / count)}ms` : '0'
    return `sign ${avg(stats.sign)}, other ${avg(stats.other)}, peak ${stats.peak} in flight`
  }
}
