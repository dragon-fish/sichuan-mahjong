/**
 * Shanten: how many tile swaps away from 听牌 (0 = waiting, -1 = complete).
 * Standard shape and 七对; the min of the two.
 */
export function shanten(counts: readonly number[], meldCount: number): number {
  let best = standardShanten([...counts], meldCount)
  if (meldCount === 0) {
    const pairs = counts.reduce((a, n) => a + Math.floor(n / 2), 0)
    best = Math.min(best, 6 - pairs)
  }
  return best
}

function standardShanten(c: number[], meldCount: number): number {
  let best = 8
  const dfs = (i: number, m: number, t: number, pair: boolean) => {
    while (i < 27 && c[i] === 0) i++
    if (i === 27) {
      const used = Math.min(t, 4 - m)
      best = Math.min(best, 8 - 2 * m - used - (pair ? 1 : 0))
      return
    }
    const r = i % 9
    if (c[i] >= 3) {
      c[i] -= 3
      dfs(i, m + 1, t, pair)
      c[i] += 3
    }
    if (r <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--, c[i + 1]--, c[i + 2]--
      dfs(i, m + 1, t, pair)
      c[i]++, c[i + 1]++, c[i + 2]++
    }
    if (c[i] >= 2) {
      c[i] -= 2
      if (!pair) dfs(i, m, t, true)
      dfs(i, m, t + 1, pair)
      c[i] += 2
    }
    if (r <= 7 && c[i + 1] > 0) {
      c[i]--, c[i + 1]--
      dfs(i, m, t + 1, pair)
      c[i]++, c[i + 1]++
    }
    if (r <= 6 && c[i + 2] > 0) {
      c[i]--, c[i + 2]--
      dfs(i, m, t + 1, pair)
      c[i]++, c[i + 2]++
    }
    c[i]--
    dfs(i, m, t, pair)
    c[i]++
  }
  dfs(0, meldCount, 0, false)
  return best
}
