/**
 * 색상 대비 게이트 — globals.css의 색 토큰을 읽어 WCAG 2.2 AA(4.5:1)를 직접 계산한다.
 *
 * 왜 이 테스트가 필요한가: 대비 미달은 **눈으로 보이지 않는 결함**이다. `#306cff`가
 * 흰 배경에서 4.47:1(기준 4.5)이라는 사실은 화면을 봐도 알 수 없고, 기존 axe E2E는
 * 라이트 모드만 돌아 다크 모드 파란 버튼의 3.07:1을 몇 달간 놓쳤다(2026-09-05 발견).
 * 토큰을 고치는 순간 계산으로 잡히게 해서, 잠재적 실수를 구조적 불가능으로 바꾼다.
 *
 * axe E2E와 역할이 다르다: axe는 "실제 렌더된 페이지에 위반 노드가 있는가"를 보고,
 * 이 테스트는 "토큰 조합 자체가 기준을 넘는가"를 본다. 후자는 브라우저·서버 없이
 * 매 커밋 돌 수 있고, 아직 화면에 안 쓰인 조합까지 미리 막는다.
 *
 * 큰 글자(18.66px 이상 굵게 또는 24px 이상)는 AA 기준이 3:1이지만, 같은 토큰이 본문
 * 크기에도 쓰이므로(헤더 로고 16px) 4.5:1로 통일해 검사한다.
 *
 * ⚠ 여유를 두고 값을 고를 것: 빌드(Lightning CSS)가 `oklch()`를 hex로 변환해 내보내고
 * 그 변환은 이 파일의 계산과 소수점에서 조금 어긋난다(실측 2026-09-05: `--destructive`가
 * 계산 `#d90000` / 배포 `#d40008`). 대비를 정확히 4.50에 맞추면 배포본이 그 아래로
 * 떨어질 수 있다. 현재 토큰은 전부 4.75:1 이상이라 이 오차가 문제되지 않는다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

/**
 * `:root` / `.dark` 블록에서 oklch 토큰을 뽑는다. 고대비 모드(hex)는 별도 검사 대상.
 *
 * ⚠ 선택자를 `indexOf`로 찾으면 안 된다: 파일 앞쪽 `@custom-variant dark (&:is(.dark *))`가
 * 먼저 걸려 `:root` 블록을 읽고, 다크 테스트가 라이트 토큰을 검사하는 거짓 통과가 된다
 * (이 테스트를 처음 쓸 때 실제로 그랬다). 줄 첫머리에 오는 블록 선언만 잡는다.
 */
function tokensOf(selector: string): Map<string, [number, number, number]> {
  const decl = new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{`, 'm')
  const found0 = decl.exec(css)
  assert.ok(found0, `${selector} 블록을 찾지 못했다`)
  const open = css.indexOf('{', found0.index)
  const close = css.indexOf('}', open)
  const block = css.slice(open, close)
  const found = new Map<string, [number, number, number]>()
  const re = /(--[\w-]+):\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(block)) !== null) {
    found.set(m[1], [Number(m[2]), Number(m[3]), Number(m[4])])
  }
  return found
}

/** oklch → sRGB(0~1). Björn Ottosson의 OKLab 역변환 + sRGB 감마 인코딩. */
function oklchToSrgb([L, C, H]: [number, number, number]): [number, number, number] {
  const h = (H * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ ** 3
  const m = m_ ** 3
  const s = s_ ** 3
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  return lin.map((x) => {
    const c = Math.min(1, Math.max(0, x))
    return c > 0.0031308 ? 1.055 * c ** (1 / 2.4) - 0.055 : 12.92 * c
  }) as [number, number, number]
}

function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(
  fg: [number, number, number],
  bg: [number, number, number],
): number {
  const a = relativeLuminance(fg)
  const b = relativeLuminance(bg)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/**
 * 알파 합성 — `bg-primary/10` 같은 Tailwind 투명도 유틸리티가 만드는 실제 배경색.
 * 브라우저와 동일하게 sRGB 공간에서 섞는다.
 *
 * ⚠ 이 검사가 없으면 토큰 쌍만 통과하고 실제 화면이 미달일 수 있다: 배지
 * (`bg-primary/10 text-primary`)가 primary를 4.5:1까지 올린 뒤에도 4.30:1로 남아
 * axe가 잡았다(2026-09-05). 새 컴포넌트가 primary/N 배경을 쓸 때 같은 함정을 반복하지
 * 않도록, 실제로 쓰이는 알파 조합을 여기에 함께 고정한다.
 */
function composite(
  fg: [number, number, number],
  bg: [number, number, number],
  alpha: number,
): [number, number, number] {
  return [0, 1, 2].map((i) => fg[i] * alpha + bg[i] * (1 - alpha)) as [
    number,
    number,
    number,
  ]
}


const AA = 4.5


/**
 * 글자 토큰 × 배경 토큰 전수 대조.
 *
 * 쌍을 손으로 나열하면 빠뜨린 조합이 남는다(2026-09-05에 실제로 그랬다: `--primary`를
 * 고친 뒤 배지 알파 배경이 남고, 그걸 고친 뒤 `--muted-foreground`가 회색 배경에서
 * 미달로 남았다. 흰 배경에서는 통과하던 값이다). 조합을 전수로 돌면 새 토큰이
 * 추가돼도 자동으로 검사 범위에 들어온다.
 *
 * 실제로 쓰이지 않는 조합까지 포함하지만, 미달을 남겨 둘 이유가 없으므로 전부 요구한다.
 */
const FOREGROUNDS = [
  '--foreground',
  '--muted-foreground',
  '--primary',
  '--destructive',
  '--card-foreground',
  '--popover-foreground',
  '--accent-foreground',
  '--secondary-foreground',
  '--sidebar-foreground',
]

const BACKGROUNDS = [
  '--background',
  '--card',
  '--popover',
  '--muted',
  '--secondary',
  '--accent',
  '--sidebar',
  '--sidebar-accent',
]

/** 같은 토큰을 알파 배경 + 불투명 글자로 쓰는 실사용 조합(배지·아이콘 칩·배너). */
const ALPHA_PAIRS: Array<{ tone: string; base: string; alpha: number }> = [
  { tone: '--primary', base: '--background', alpha: 0.1 },
  { tone: '--primary', base: '--background', alpha: 0.05 },
  { tone: '--destructive', base: '--background', alpha: 0.05 },
]

for (const selector of [':root', '.dark'] as const) {
  const themeName = selector === ':root' ? '라이트' : '다크'

  test(`${themeName} 모드: 글자 × 배경 전수 조합이 AA 4.5:1을 만족한다`, () => {
    const tokens = tokensOf(selector)
    const failures: string[] = []

    for (const fg of FOREGROUNDS) {
      for (const bg of BACKGROUNDS) {
        const f = tokens.get(fg)
        const b = tokens.get(bg)
        if (!f || !b) continue // 그 테마에 없는 토큰(다크는 일부만 재선언)
        const ratio = contrastRatio(oklchToSrgb(f), oklchToSrgb(b))
        if (ratio < AA) failures.push(`${ratio.toFixed(2)}:1  ${fg} on ${bg}`)
      }
    }

    assert.deepEqual(failures, [], `AA 미달 조합:\n  ${failures.join('\n  ')}`)
  })

  test(`${themeName} 모드: 알파 배경 조합(배지·칩)이 AA 4.5:1을 만족한다`, () => {
    const tokens = tokensOf(selector)
    const failures: string[] = []

    for (const { tone, base, alpha } of ALPHA_PAIRS) {
      const t = tokens.get(tone)
      const b = tokens.get(base)
      if (!t || !b) continue
      const rgb = oklchToSrgb(t)
      const ratio = contrastRatio(rgb, composite(rgb, oklchToSrgb(b), alpha))
      if (ratio < AA) {
        failures.push(`${ratio.toFixed(2)}:1  ${tone} on ${tone}/${alpha * 100}%`)
      }
    }

    assert.deepEqual(failures, [], `AA 미달 조합:\n  ${failures.join('\n  ')}`)
  })
}

test('계산 검산 — 알려진 값과 일치한다', () => {
  // 흰 배경 위 검정 글자는 정의상 21:1.
  const white: [number, number, number] = [1, 1, 1]
  const black: [number, number, number] = [0, 0, 0]
  assert.equal(Math.round(contrastRatio(white, black)), 21)

  // 종전 primary oklch(0.585 0.233 264)는 axe가 #306cff / 4.45:1로 측정했다.
  // 변환·대비 계산이 그 값을 재현하는지 확인한다(구현이 틀리면 게이트 전체가 무의미).
  const legacy = oklchToSrgb([0.585, 0.233, 264])
  const hex =
    '#' +
    legacy.map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('')
  assert.equal(hex, '#306cff')
  const legacyRatio = contrastRatio(legacy, white)
  assert.ok(
    legacyRatio > 4.4 && legacyRatio < 4.5,
    `종전 primary 대비가 4.4~4.5 구간이어야 한다(실측 ${legacyRatio.toFixed(2)})`,
  )
})
