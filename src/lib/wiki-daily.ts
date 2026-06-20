/**
 * "오늘의 장애인교원 위키" — 매일 갱신되는 결정적 무작위 선택.
 *
 * 왜 결정적인가:
 * - 위키 홈은 SSR(동적 렌더)이므로 서버가 고른 결과가 그대로 내려간다. 날짜 시드 셔플은
 *   같은 날 같은 결과를 보장해 새로고침/재방문 시 안정적이고, hydration mismatch가 없다.
 * - Math.random() 같은 비결정성을 배제해 단위 테스트가 가능하다.
 *
 * 날짜 경계는 KST(Asia/Seoul) 기준 — 한국 자정에 5건이 새로 바뀐다.
 *
 * href는 retrieval.ts(sourcePathToHref)를 import하지 않고 경량 헬퍼로 만든다.
 * retrieval.ts를 끌어오면 함수 번들 NFT가 폭증한 이력(PR #81)이 있기 때문.
 */

/** 주어진 시각의 한국 시간(Asia/Seoul) 날짜를 YYYY-MM-DD로 반환. */
export function dateKeyKST(now: Date): string {
  // en-CA 로캘은 YYYY-MM-DD 형식을 보장한다.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
}

/** 문자열 → 32비트 부호 없는 정수 시드 (FNV-1a). */
function seedFromString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    // FNV prime 곱셈을 32비트 정수 연산으로.
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32 — 빠르고 분포 양호한 시드 PRNG. [0, 1) 반환. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 날짜 키를 시드로 결정적 셔플 후 앞 count개를 고른다. 원본 배열은 변형하지 않는다.
 */
export function pickDailyDocs<T>(
  items: readonly T[],
  dateKey: string,
  count: number,
): T[] {
  const arr = [...items]
  const rand = mulberry32(seedFromString(dateKey))
  // Fisher-Yates (시드 기반).
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, Math.max(0, count))
}

/**
 * content/<axis>/<sub>?/<slug>.md 경로 → 위키 라우트 href.
 * filePath가 비정상이면 /<axis>/<slug>로 폴백.
 */
export function hrefForDoc(doc: {
  filePath: string
  axis: string
  slug: string
}): string {
  const parts = doc.filePath.split("/")
  // content/<axis>/<sub>/<slug>.md → 4
  if (parts.length === 4 && parts[0] === "content") {
    return `/${parts[1]}/${parts[2]}/${doc.slug}`
  }
  // content/<axis>/<slug>.md → 3
  if (parts.length === 3 && parts[0] === "content") {
    return `/${parts[1]}/${doc.slug}`
  }
  return `/${doc.axis}/${doc.slug}`
}
