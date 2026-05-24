#!/usr/bin/env tsx
/**
 * webfortd 출처 마크다운 자동 분해 스크립트 — M3
 *
 * 입력: data/source-md/*.md (docparse 최종본 5개)
 * 출력: content/<axis>/<page-slug>.md (atomic 페이지, status='draft' 강제)
 *       docs/decompose-report.md (페이지별 신뢰도/근거 리포트)
 *
 * 실행:
 *   tsx scripts/decompose-source.ts             # 전체 5개 처리
 *   tsx scripts/decompose-source.ts --dry-run   # 파일 쓰기 없이 stdout 리포트만
 *   tsx scripts/decompose-source.ts --file <path>  # 단일 파일 모드
 *   tsx scripts/decompose-source.ts --reset     # 기존 source_origin 일치 파일 전부 삭제 후 재생성
 *
 * 핵심 결정 (청사진 §10~§13 반영):
 *  - 단체협약은 splitLevel=4 (#### 제N조 단위), 그 외는 splitLevel=2 (## 단위)
 *  - 슬러그는 ASCII kebab-case만 (validate-frontmatter.ts SLUG_RE 정합).
 *    한글 헤딩은 source_origin prefix + 순번으로 fallback.
 *  - 같은 source 내 슬러그 충돌은 -2/-3 suffix, 서로 다른 source 간은 prefix로 회피.
 *  - 모든 분해 페이지는 status='draft' 강제(휴리스틱 무관).
 *  - 위원장이 수동 작성한 content/resources/* 페이지는 source_origin이 없어
 *    --reset에서도 보호된다.
 *  - 이미지 패턴 "(이미지: ...)"는 manifest 매칭 시도 후 미매칭이면 TODO 마커로 교체.
 *  - idempotency: 동일 입력 두 번 실행 → 동일 출력(슬러그 안정성 + 결정적 정렬).
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import {
  CONTENT_AXES,
  type ContentAxis,
  type Frontmatter,
} from '../src/types/kb'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..')
const SOURCE_MD_DIR = path.join(REPO_ROOT, 'data/source-md')
const CONTENT_DIR = path.join(REPO_ROOT, 'content')
const REPORT_PATH = path.join(REPO_ROOT, 'docs/decompose-report.md')
const MANIFEST_PATH = path.join(REPO_ROOT, 'public/source-images/manifest.json')
const AXIS_OVERRIDES_PATH = path.join(REPO_ROOT, 'content/_axis-overrides.json')

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
// 이미지 패턴: 한 줄 안의 `(이미지: ...)`만 검출.
// non-greedy `+?` + `(?=\s|$)` lookahead — 같은 줄에서 닫는 `)` 뒤에 공백이나
// 줄끝이 나오는 첫 위치까지 매칭. alt 내부에 `(...)`이 포함돼도 lookahead 조건이
// 충족되는 가장 짧은 닫는 괄호에서 종료한다.
// 한계: alt 끝 `)` 다음에 즉시 비공백 문자(`(이미지: foo)bar`)면 매칭 실패.
// 실측 데이터(104건)에는 그런 케이스가 없어 충분하지만, edge case에 의존하지 말 것.
const IMAGE_PATTERN_RE = /\(이미지:\s*([^\n]+?)\)(?=\s|$)/gm

// 코드블록 마스킹용 정규식 (sync-content.ts와 동일 정책 + indent 코드블록 추가).
// 펜스드: ```...```
// indent: 줄 시작 4-space 또는 tab가 연속되는 블록
const FENCED_CODE_RE = /```[\s\S]*?```/g
const INLINE_CODE_RE = /`[^`\n]*`/g
const INDENT_CODE_RE = /(^|\n)((?:[ ]{4}|\t)[^\n]*(?:\n(?:[ ]{4}|\t)[^\n]*)*)/g

// ---------- 입력 파일 → source 메타 매핑 ----------
//
// 한글 파일명을 자동 변환하면 정보 손실이 크고 슬러그 안정성도 떨어진다.
// 5개 입력 파일에 대해서만 명시적으로 source_origin + slug prefix + source 메타를 박는다.
// 새 입력이 추가되면 이 표에 항목을 추가해야 한다 (intentional bottleneck).

interface SourceFileMeta {
  /** frontmatter.source_origin 값 (kebab-case, 영문) */
  sourceOrigin: string
  /** 슬러그 prefix — 한글 헤딩 fallback 시 사용 */
  slugPrefix: string
  /** 분해 단위 헤딩 레벨 */
  splitLevel: 2 | 3 | 4
  /** frontmatter.year */
  year: number
  /** frontmatter.type */
  docType: Frontmatter['type']
  /** frontmatter.source */
  source: {
    organization: string
    citation: string
    url?: string
  }
  /** 기본 disability_types (헤딩·본문에서 더 구체적 매칭이 없을 때 fallback) */
  defaultDisabilityTypes: Frontmatter['disability_types']
  /** 강제 axis (단체협약 등은 자동 분류 결과를 무시하고 고정) */
  forcedAxis?: ContentAxis
}

const SOURCE_FILE_MAP: Record<string, SourceFileMeta> = {
  '2023 장애유형별 장애인교원 근무 지원 방안_최종보고서_fused_v3.md': {
    sourceOrigin: '2023-disability-types-work-support-report',
    slugPrefix: '2023-research',
    splitLevel: 2,
    year: 2023,
    docType: '연구보고서',
    source: {
      organization: '교육부',
      citation: '2023 장애유형별 장애인교원 근무 지원 방안 최종보고서',
    },
    defaultDisabilityTypes: ['전체'],
  },
  '2023 장애인교원 인사관리안내서(단면)_fused_v3.md': {
    sourceOrigin: '2023-hr-guide',
    slugPrefix: '2023-hr',
    splitLevel: 2,
    year: 2023,
    docType: '안내서',
    source: {
      organization: '교육부',
      citation: '2023 장애인교원 인사관리안내서',
    },
    defaultDisabilityTypes: ['전체'],
  },
  '241210_책자_내지_중부대학교_장애인교원_근무지원_안내자료_V4_fused_v3.md': {
    sourceOrigin: '2024-jbu-work-support-guide',
    slugPrefix: '2024-jbu',
    splitLevel: 2,
    year: 2024,
    docType: '안내서',
    source: {
      organization: '중부대학교',
      citation: '단위학교 차원의 장애인교원 근무 지원 안내자료(각급학교용)',
    },
    defaultDisabilityTypes: ['전체'],
  },
  '교육부와 함께하는장애인교원노동조합 간 2020 단체협약.md': {
    sourceOrigin: '2020-collective-agreement',
    slugPrefix: '2020-ca',
    splitLevel: 4,
    year: 2020,
    docType: '지침',
    source: {
      organization: '교육부·함께하는장애인교원노동조합',
      citation: '교육부와 함께하는장애인교원노동조합 간 2020 단체협약 (2023.6.2. 개정)',
    },
    defaultDisabilityTypes: ['전체'],
    forcedAxis: 'agreements',
  },
  '내지_장애인교원_지원인력_직무_수행_안내자료인쇄용_156P_수정_fused_v3.md': {
    sourceOrigin: '2024-support-staff-duty-guide',
    slugPrefix: '2024-staff',
    splitLevel: 2,
    year: 2024,
    docType: '안내서',
    source: {
      organization: '교육부',
      citation: '장애인교원 지원인력 직무 수행 안내자료',
    },
    defaultDisabilityTypes: ['전체'],
  },
}

// ---------- 휴리스틱 매핑 테이블 ----------

// domain 키워드 → DomainSchema enum 값 매핑.
// 헤딩과 본문 첫 500자에서 매칭. 매칭 순서대로 domains 배열 채움 (최대 3개).
const DOMAIN_KEYWORD_TABLE: Array<{ pattern: RegExp; domain: Frontmatter['domains'][number] }> = [
  { pattern: /(임용|채용|신규발령|임용시험|발령|전보|승진|전직|평정|성과급)/, domain: '인사관리' },
  { pattern: /(휴가|휴직|병가|복무|근무성적|업무분장|직무|복직)/, domain: '복무관리' },
  { pattern: /(지원인력|근로지원인|보조공학|편의지원|편의제공|접근성|문자통역|수어통역|대체자료|디지털교과서|웹접근성)/, domain: '편의지원' },
  { pattern: /(차별|권리구제|고충|인권|불이익|부당노동|개인정보)/, domain: '권리구제' },
  { pattern: /(연수|자격연수|직무연수|특별연수|파견|교원연수|교육연수)/, domain: '연수교육' },
  { pattern: /(법령|조례|지침|단체협약|법|규정|시행령|시행규칙|훈령|예규)/, domain: '정책법령' },
  { pattern: /(연구|통계|현황|조사|실태조사|보고서|분석)/, domain: '연구통계' },
  { pattern: /(인식개선|홍보|카드뉴스|장애이해|이해교육)/, domain: '인식개선' },
]

// 장애유형 키워드 매핑 — 단일 장애유형이 명시된 경우만 채택.
const DISABILITY_KEYWORD_TABLE: Array<{ pattern: RegExp; value: Frontmatter['disability_types'][number] }> = [
  { pattern: /(시각장애|시각 장애|시각교원|시각장애인 교원|시각 장애인)/, value: '시각' },
  { pattern: /(청각장애|청각 장애|청각교원|청각장애인 교원|청각 장애인|난청)/, value: '청각' },
  { pattern: /(지체장애|지체 장애|지체교원|지체장애인 교원|척수|절단)/, value: '지체' },
  { pattern: /(뇌병변|뇌성마비)/, value: '뇌병변' },
  { pattern: /(발달장애|자폐|지적장애)/, value: '발달' },
  { pattern: /(내부장애|간장애|신장장애|심장장애)/, value: '내부장애' },
]

const REGION_KEYWORD_TABLE: Array<{ pattern: RegExp; value: Frontmatter['regions'][number] }> = [
  { pattern: /서울특별시|서울교육청|서울시교육청/, value: '서울' },
  { pattern: /부산광역시|부산교육청|부산시교육청/, value: '부산' },
  { pattern: /대구광역시|대구교육청|대구시교육청/, value: '대구' },
  { pattern: /인천광역시|인천교육청|인천시교육청/, value: '인천' },
  { pattern: /광주광역시|광주교육청|광주시교육청/, value: '광주' },
  { pattern: /대전광역시|대전교육청|대전시교육청/, value: '대전' },
  { pattern: /울산광역시|울산교육청|울산시교육청/, value: '울산' },
  { pattern: /세종특별자치시|세종시교육청|세종교육청/, value: '세종' },
  { pattern: /경기도교육청|경기교육청/, value: '경기' },
  { pattern: /강원특별자치도|강원도교육청|강원교육청/, value: '강원' },
  { pattern: /충청북도교육청|충북교육청/, value: '충북' },
  { pattern: /충청남도교육청|충남교육청/, value: '충남' },
  { pattern: /전라북도교육청|전북교육청|전북특별자치도/, value: '전북' },
  { pattern: /전라남도교육청|전남교육청/, value: '전남' },
  { pattern: /경상북도교육청|경북교육청/, value: '경북' },
  { pattern: /경상남도교육청|경남교육청/, value: '경남' },
  { pattern: /제주특별자치도|제주교육청|제주도교육청/, value: '제주' },
]

// ---------- 타입 ----------

export interface PageOutput {
  outputPath: string
  relativePath: string
  slug: string
  axis: ContentAxis
  frontmatter: Frontmatter
  body: string
  confidence: 'high' | 'medium' | 'low'
  lowConfidenceFields: string[]
  imagePatternCount: number
}

export interface PageReport {
  slug: string
  relativePath: string
  axis: ContentAxis
  confidence: 'high' | 'medium' | 'low'
  lowConfidenceFields: string[]
  unmatchedImages: number
  todoMarkers: string[]
}

export interface DecomposeResult {
  sourceOrigin: string
  pages: PageOutput[]
  report: PageReport[]
  unmatchedImages: Array<{ slug: string; pattern: string; lineNo: number }>
  slugCollisions: Array<{ original: string; resolved: string; count: number }>
}

interface ImageManifestEntry {
  source: string
  page: number
  figure: number
  path: string
  alt?: string | null
}

// ---------- 코드블록 마스킹 (위치 보존) ----------
//
// 같은 길이 공백으로 치환 — 라인 번호와 offset 보존.
function maskCodeBlocks(body: string): string {
  const masker = (m: string) => m.replace(/[^\n]/g, ' ')
  let masked = body.replace(FENCED_CODE_RE, masker)
  masked = masked.replace(INLINE_CODE_RE, masker)
  // indent 코드블록: 줄 단위 list marker 휴리스틱 회피 (codex-rescue P1 #5).
  // CommonMark는 직전 빈 줄 + 4-space 들여쓰기를 code로 정의하지만 우리는 nested list와
  // 구분이 안 됨. list marker(-, *, +, 숫자.)가 보이면 마스킹 취소.
  masked = masked.replace(INDENT_CODE_RE, (full: string, leading: string, code: string) => {
    if (/^\s*[-*+]\s|^\s*\d+\.\s/m.test(code)) return full
    return leading + code.replace(/[^\n]/g, ' ')
  })
  return masked
}

// ---------- 슬러그 생성기 ----------

function asciiKebab(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // 영숫자·공백·하이픈만 보존 (한글 제거)
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function makeSlug(heading: string, meta: SourceFileMeta, fallbackIndex: number): string {
  // 1차: 영문 음절이 있다면 그것만 추출
  const ascii = asciiKebab(heading)
  if (ascii && SLUG_RE.test(ascii)) {
    return `${meta.slugPrefix}-${ascii}`
  }
  // 한글 헤딩에서는 "제N조", "제N장", "제N절" 같은 패턴을 영문화
  const articleMatch = heading.match(/제\s*(\d+)\s*조/)
  if (articleMatch) {
    return `${meta.slugPrefix}-art-${articleMatch[1].padStart(3, '0')}`
  }
  const chapterMatch = heading.match(/제\s*(\d+)\s*장/)
  if (chapterMatch) {
    return `${meta.slugPrefix}-ch-${chapterMatch[1].padStart(2, '0')}`
  }
  const sectionMatch = heading.match(/제\s*(\d+)\s*절/)
  if (sectionMatch) {
    return `${meta.slugPrefix}-sec-${sectionMatch[1].padStart(2, '0')}`
  }
  // 부록·전문 등 특수 케이스
  if (/전\s*문/.test(heading)) return `${meta.slugPrefix}-preamble`
  if (/부\s*칙/.test(heading)) return `${meta.slugPrefix}-supplementary`
  if (/부\s*록/.test(heading)) return `${meta.slugPrefix}-appendix-${String(fallbackIndex).padStart(3, '0')}`
  // 마지막 fallback — 순번
  return `${meta.slugPrefix}-p-${String(fallbackIndex).padStart(3, '0')}`
}

// ---------- 헤딩 추출 (마스킹된 본문 기준) ----------

interface HeadingMatch {
  level: number
  text: string
  offset: number
  lineNo: number
}

function extractHeadings(body: string, masked: string, maxLevel: number): HeadingMatch[] {
  // 마스킹된 본문에서 줄 시작 #+ 공백 헤딩만 추출.
  // YAML frontmatter는 이미 gray-matter가 분리한 뒤 body가 들어오므로 무시 가능.
  const HEADING_LINE_RE = /^(#{1,6})\s+(.+?)\s*$/gm
  const out: HeadingMatch[] = []
  let m: RegExpExecArray | null
  while ((m = HEADING_LINE_RE.exec(masked)) !== null) {
    const level = m[1].length
    if (level > maxLevel) continue
    const offset = m.index
    const lineNo = masked.slice(0, offset).split('\n').length
    // 원본 본문에서 실제 텍스트 추출 (마스킹은 공백 치환이므로 텍스트는 동일하지만,
    // 안전을 위해 마스킹된 그룹을 그대로 사용)
    const text = m[2].trim()
    out.push({ level, text, offset, lineNo })
  }
  return out
}

// ---------- 휴리스틱 ----------

function inferDomainsForSection(headingPath: string[], bodySample: string): Frontmatter['domains'] {
  const haystack = headingPath.join(' ') + ' ' + bodySample
  const found = new Set<Frontmatter['domains'][number]>()
  for (const { pattern, domain } of DOMAIN_KEYWORD_TABLE) {
    if (pattern.test(haystack)) found.add(domain)
    if (found.size >= 3) break
  }
  return Array.from(found)
}

function inferDisabilityTypes(
  headingPath: string[],
  bodySample: string,
  fallback: Frontmatter['disability_types'],
): Frontmatter['disability_types'] {
  const haystack = headingPath.join(' ') + ' ' + bodySample
  const found = new Set<Frontmatter['disability_types'][number]>()
  for (const { pattern, value } of DISABILITY_KEYWORD_TABLE) {
    if (pattern.test(haystack)) found.add(value)
  }
  if (found.size === 0) return fallback
  return Array.from(found)
}

function inferRegions(bodySample: string): Frontmatter['regions'] {
  const found = new Set<Frontmatter['regions'][number]>()
  for (const { pattern, value } of REGION_KEYWORD_TABLE) {
    if (pattern.test(bodySample)) found.add(value)
  }
  if (found.size === 0) return ['전국']
  return Array.from(found)
}

function pickAxis(
  meta: SourceFileMeta,
  fm: Pick<Frontmatter, 'type' | 'disability_types' | 'regions' | 'domains'>,
): { axis: ContentAxis; confidence: 'high' | 'medium' | 'low' } {
  if (meta.forcedAxis) return { axis: meta.forcedAxis, confidence: 'high' }
  // 정책법령 명시
  if (fm.domains.includes('정책법령')) return { axis: 'policies', confidence: 'high' }
  // 단일 장애유형 (전체 제외)
  const concreteDts = fm.disability_types.filter((d) => d !== '전체' && d !== '기타')
  if (concreteDts.length === 1) return { axis: 'disability-types', confidence: 'high' }
  // 특정 지역 (전국 제외)
  const concreteRegions = fm.regions.filter((r) => r !== '전국')
  if (concreteRegions.length === 1) return { axis: 'regions', confidence: 'medium' }
  // 도메인 키워드 매칭
  if (fm.domains.length >= 1) return { axis: 'domains', confidence: 'medium' }
  return { axis: 'uncategorized', confidence: 'low' }
}

// ---------- 본문 처리 ----------

function processBodyImages(
  body: string,
  source: string,
  _manifestEntries: ImageManifestEntry[],
  unmatched: Array<{ slug: string; pattern: string; lineNo: number }>,
  slug: string,
): { body: string; imagePatternCount: number; todoMarkers: string[] } {
  // M3 안전 정책 (codex-rescue P0 #1·#2 반영):
  // 본문의 "(이미지: ...)" 패턴은 PDF page 번호 없이는 정확한 매핑이 불가능.
  // 이전 구현은 source manifest의 첫 이미지를 모든 페이지에 재사용해 데이터 무결성 사고.
  // → M3에서는 자동 ![](path) 삽입을 전면 중단. 원본 alt를 그대로 TODO 마커로 보존.
  // 실제 이미지 매핑은 M4 수동 검수에서 manifest.json + PDF 페이지 anchor를 보고 1:1 결정.
  const todoMarkers: string[] = []
  let imagePatternCount = 0
  const result = body.replace(IMAGE_PATTERN_RE, (_full, alt: string) => {
    imagePatternCount += 1
    const trimmedAlt = alt.trim()
    unmatched.push({ slug, pattern: trimmedAlt.slice(0, 100), lineNo: 0 })
    todoMarkers.push(`image-pending: ${trimmedAlt.slice(0, 40)}`)
    // 원본 alt를 HTML 주석에 그대로 보존. M4 검수자가 manifest와 대조해 ![](path)로 교체.
    return `<!-- TODO: image-link source=${source} -- 원본: (이미지: ${trimmedAlt}) -->`
  })
  return { body: result, imagePatternCount, todoMarkers }
}

// ---------- 페이지 빌드 ----------

interface RawSection {
  heading: HeadingMatch
  body: string // 원본 본문 (마스킹 X)
  parentHeadings: HeadingMatch[]
}

function buildSections(
  body: string,
  splitLevel: number,
): RawSection[] {
  const masked = maskCodeBlocks(body)
  const headings = extractHeadings(body, masked, splitLevel)
  if (headings.length === 0) return []
  // 부모 헤딩 트래킹 (splitLevel보다 얕은 헤딩만 부모 후보)
  const sections: RawSection[] = []
  const parentStack: HeadingMatch[] = []
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i]
    // parentStack 정리: 현재 h.level 이상인 항목은 pop
    while (parentStack.length > 0 && parentStack[parentStack.length - 1].level >= h.level) {
      parentStack.pop()
    }
    if (h.level < splitLevel) {
      // 부모 헤딩
      parentStack.push(h)
      continue
    }
    // splitLevel 헤딩이면 페이지가 된다
    const next = headings.slice(i + 1).find((next) => next.level <= h.level)
    const endOffset = next ? next.offset : body.length
    // 본문은 헤딩 라인 다음부터 endOffset까지
    const bodyStart = body.indexOf('\n', h.offset)
    const sectionBody = body.slice(bodyStart + 1, endOffset).trim()
    sections.push({
      heading: h,
      body: sectionBody,
      parentHeadings: [...parentStack],
    })
  }
  return sections
}

// 짧은 메타 헤딩(본문 100자 미만) 병합 정책.
// 청사진 §13: 단체협약 등에서 #### 제N조 본문이 너무 짧으면 상위 절·장에 병합.
// M3에서는 너무 공격적인 병합을 피하고, 본문이 빈 경우만 skip.
function shouldSkipSection(section: RawSection): boolean {
  const stripped = section.body.replace(/\s+/g, '')
  // 완전히 비어있고 부모도 없으면 skip (예: 단체협약의 ## 2023. 6. 2. 같은 날짜 헤딩)
  if (stripped.length === 0) return true
  return false
}

// ---------- 단일 파일 분해 ----------

export function decomposeFile(args: {
  filePath: string
  imageManifest: ImageManifestEntry[]
  axisOverrides?: Record<string, ContentAxis>
}): DecomposeResult {
  const { filePath, imageManifest, axisOverrides = {} } = args
  const fileName = path.basename(filePath)
  const meta = SOURCE_FILE_MAP[fileName]
  if (!meta) {
    throw new Error(`SOURCE_FILE_MAP에 없는 파일: ${fileName}. scripts/decompose-source.ts 상단 매핑 표에 추가 필요.`)
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8')
  // 입력 마크다운에 frontmatter가 있을 수 있으니 gray-matter로 분리
  const { content: body } = matter(fileContent)

  const sections = buildSections(body, meta.splitLevel)

  const pages: PageOutput[] = []
  const report: PageReport[] = []
  const unmatchedImages: Array<{ slug: string; pattern: string; lineNo: number }> = []
  // 같은 source 내 최종 슬러그(final) 전부 추적 — base "x"의 3번째 사용이
  // "x-3"가 되는데 base "x-3"의 1번째 사용 "x-3"와 충돌하는 케이스 방지.
  const usedSlugs = new Set<string>()
  const slugCollisions: Array<{ original: string; resolved: string; count: number }> = []

  let fallbackIndex = 0
  for (const section of sections) {
    if (shouldSkipSection(section)) continue
    fallbackIndex += 1

    // 슬러그 생성 + 충돌 해소 (같은 source 내, final 단위)
    let baseSlug = makeSlug(section.heading.text, meta, fallbackIndex)
    if (!SLUG_RE.test(baseSlug)) {
      baseSlug = `${meta.slugPrefix}-p-${String(fallbackIndex).padStart(3, '0')}`
    }
    let finalSlug = baseSlug
    if (usedSlugs.has(finalSlug)) {
      let n = 2
      while (usedSlugs.has(`${baseSlug}-${n}`)) n++
      finalSlug = `${baseSlug}-${n}`
      slugCollisions.push({ original: baseSlug, resolved: finalSlug, count: n })
    }
    usedSlugs.add(finalSlug)

    // 본문 + 이미지 처리
    const { body: processedBody, imagePatternCount, todoMarkers } = processBodyImages(
      section.body,
      meta.sourceOrigin,
      imageManifest,
      unmatchedImages,
      finalSlug,
    )

    // 휴리스틱 추론
    const headingPath = [...section.parentHeadings.map((h) => h.text), section.heading.text]
    const bodySample = section.body.slice(0, 500)

    const inferredDomains = inferDomainsForSection(headingPath, bodySample)
    const hasInferredDomains = inferredDomains.length > 0
    // frontmatter용 fallback (schema는 domains 최소 1개 요구).
    // codex-rescue P1 #3: axis 판단에는 raw inferred를 쓰고 finalDomains 승격은 별도.
    const finalDomains: Frontmatter['domains'] =
      hasInferredDomains ? inferredDomains : ['정책법령']

    const inferredDts = inferDisabilityTypes(headingPath, bodySample, meta.defaultDisabilityTypes)
    const inferredRegions = inferRegions(section.body)

    const lowConfidenceFields: string[] = []
    if (!hasInferredDomains) lowConfidenceFields.push('domains')
    if (
      inferredDts.length === 1
      && inferredDts[0] === '전체'
      && headingPath.some((h) => /(시각|청각|지체|뇌병변|발달|내부장애)/.test(h))
    ) {
      lowConfidenceFields.push('disability_types')
    }
    if (inferredRegions.length === 1 && inferredRegions[0] === '전국') {
      // 본문에 지역 키워드가 있는데 매칭 못한 케이스 detect
      if (/(시·도교육청|시도교육청|지역|광역|특별시|광역시)/.test(section.body)) {
        lowConfidenceFields.push('regions')
      }
    }

    // axis 결정 — raw inferred를 그대로 전달.
    // hasInferredDomains===false면 axis가 uncategorized로 떨어져 검수 큐에 잡힘.
    const { axis: heuristicAxis, confidence: axisConfidence } = pickAxis(meta, {
      type: meta.docType,
      disability_types: inferredDts,
      regions: inferredRegions,
      domains: hasInferredDomains ? inferredDomains : ([] as Frontmatter['domains']),
    })

    // M4 axis overrides — 위원장(또는 검수자) 수동 결정이 휴리스틱을 덮어씀.
    // content/_axis-overrides.json에서 로드. 해당 slug 매핑 발견 시 axis 교체.
    //
    // codex-rescue M4 P1 #2 — forcedAxis vs override 충돌 차단:
    // 단체협약 source는 meta.forcedAxis='agreements'로 분류 무결성 보호.
    // override가 forcedAxis와 다른 값으로 덮으면 단체협약 페이지가 agreements 라우트에서
    // 빠지는 사고. fatal exit으로 막는다.
    const overrideAxis = axisOverrides[finalSlug]
    if (overrideAxis && meta.forcedAxis && overrideAxis !== meta.forcedAxis) {
      process.stderr.write(
        `[decompose] FATAL: axis override가 forcedAxis와 충돌 — slug='${finalSlug}', ` +
        `forcedAxis='${meta.forcedAxis}', override='${overrideAxis}' (source=${meta.sourceOrigin})\n` +
        `         forcedAxis source의 페이지는 override 금지. _axis-overrides.json에서 해당 항목 제거.\n`,
      )
      process.exit(2)
    }
    const axis: ContentAxis = overrideAxis ?? heuristicAxis
    const isOverridden = overrideAxis !== undefined && overrideAxis !== heuristicAxis
    if (isOverridden) {
      lowConfidenceFields.push(`axis-overridden:${heuristicAxis}->${overrideAxis}`)
    }

    const confidence: 'high' | 'medium' | 'low' =
      isOverridden
        ? 'high'
        : lowConfidenceFields.length === 0 && axisConfidence === 'high'
          ? 'high'
          : axisConfidence === 'low' || lowConfidenceFields.length >= 2
            ? 'low'
            : 'medium'

    // 부모 헤딩 컨텍스트는 frontmatter parent_headings 필드로 보존 (M4-B).
    // 이전 M3 구현은 본문 앞에 `> 부모1 > 부모2` blockquote으로 prepend했으나
    // MDX 렌더 시 인용처럼 보이는 시맨틱 문제 발생 — KbPageLayout이 breadcrumb UI로 별도 렌더.
    const parentHeadings = section.parentHeadings.map((h) => h.text)

    // frontmatter 조립 (status는 무조건 draft)
    const fm: Frontmatter = {
      title: section.heading.text,
      type: meta.docType,
      disability_types: inferredDts,
      domains: finalDomains,
      regions: inferredRegions,
      year: meta.year,
      status: 'draft',
      source: meta.source,
      source_origin: meta.sourceOrigin,
      parent_headings: parentHeadings,
      authors: [],
      reviewed_by: [],
      references: [],
      accessibility: {
        alt_text_complete: imagePatternCount === 0,
        captions_available: false,
        reading_level: 'standard',
        audio_tts_ready: false,
      },
    }

    const relativePath = `content/${axis}/${finalSlug}.md`
    const outputPath = path.join(REPO_ROOT, relativePath)

    // 본문에는 더 이상 parent breadcrumb를 prepend하지 않음 (frontmatter로 이전).
    const fullBody = processedBody

    pages.push({
      outputPath,
      relativePath,
      slug: finalSlug,
      axis,
      frontmatter: fm,
      body: fullBody,
      confidence,
      lowConfidenceFields,
      imagePatternCount,
    })

    report.push({
      slug: finalSlug,
      relativePath,
      axis,
      confidence,
      lowConfidenceFields,
      unmatchedImages: 0,
      todoMarkers,
    })
  }

  // unmatched 카운트를 페이지별 리포트에 합산
  for (const item of unmatchedImages) {
    const r = report.find((r) => r.slug === item.slug)
    if (r) r.unmatchedImages += 1
  }

  return {
    sourceOrigin: meta.sourceOrigin,
    pages,
    report,
    unmatchedImages,
    slugCollisions,
  }
}

// ---------- 마크다운 출력 ----------

function serializeFrontmatter(fm: Frontmatter): string {
  // gray-matter는 stringify도 제공하지만 출력 일관성을 위해 직접 작성.
  // 키 순서 고정 → idempotency.
  const lines: string[] = ['---']
  lines.push(`title: ${JSON.stringify(fm.title)}`)
  lines.push(`type: ${fm.type}`)
  lines.push(`disability_types: [${fm.disability_types.map((v) => JSON.stringify(v)).join(', ')}]`)
  lines.push(`domains: [${fm.domains.map((v) => JSON.stringify(v)).join(', ')}]`)
  lines.push(`regions: [${fm.regions.map((v) => JSON.stringify(v)).join(', ')}]`)
  lines.push(`year: ${fm.year}`)
  lines.push(`status: ${fm.status}`)
  lines.push('source:')
  lines.push(`  organization: ${JSON.stringify(fm.source.organization)}`)
  lines.push(`  citation: ${JSON.stringify(fm.source.citation)}`)
  if (fm.source.url) lines.push(`  url: ${JSON.stringify(fm.source.url)}`)
  lines.push(`source_origin: ${JSON.stringify(fm.source_origin)}`)
  // parent_headings 직렬화 — 비어있을 수도 있으나 키 자체는 항상 출력해 idempotency 유지.
  // YAML flow scalar로 출력 (한국어 포함 문자열은 JSON.stringify로 안전 escape).
  const parentHeadings = fm.parent_headings ?? []
  if (parentHeadings.length === 0) {
    lines.push('parent_headings: []')
  } else {
    lines.push(`parent_headings: [${parentHeadings.map((v) => JSON.stringify(v)).join(', ')}]`)
  }
  lines.push('reviewed_by: []')
  lines.push('references: []')
  lines.push('accessibility:')
  lines.push(`  alt_text_complete: ${fm.accessibility?.alt_text_complete ?? false}`)
  lines.push(`  captions_available: ${fm.accessibility?.captions_available ?? false}`)
  lines.push(`  reading_level: ${fm.accessibility?.reading_level ?? 'standard'}`)
  lines.push(`  audio_tts_ready: ${fm.accessibility?.audio_tts_ready ?? false}`)
  lines.push('---')
  return lines.join('\n')
}

function writePage(page: PageOutput): void {
  const fm = serializeFrontmatter(page.frontmatter)
  const content = `${fm}\n\n# ${page.frontmatter.title}\n\n${page.body}\n`
  fs.mkdirSync(path.dirname(page.outputPath), { recursive: true })
  fs.writeFileSync(page.outputPath, content, 'utf-8')
}

// ---------- 리포트 ----------

function writeReport(allResults: DecomposeResult[]): void {
  const lines: string[] = []
  lines.push('# webfortd 출처 마크다운 분해 리포트 — M3')
  lines.push('')
  lines.push('자동 생성. `tsx scripts/decompose-source.ts` 실행 결과.')
  lines.push('')
  for (const result of allResults) {
    lines.push(`## ${result.sourceOrigin}`)
    lines.push('')
    lines.push(`- 분해 페이지: ${result.pages.length}개`)
    lines.push(`- 슬러그 충돌 해소: ${result.slugCollisions.length}건`)
    lines.push(`- 이미지 미매칭: ${result.unmatchedImages.length}건`)
    const byAxis = new Map<string, number>()
    const byConfidence = new Map<string, number>()
    for (const p of result.pages) {
      byAxis.set(p.axis, (byAxis.get(p.axis) ?? 0) + 1)
      byConfidence.set(p.confidence, (byConfidence.get(p.confidence) ?? 0) + 1)
    }
    lines.push(`- axis 분포: ${[...byAxis.entries()].map(([a, n]) => `${a}=${n}`).join(', ')}`)
    lines.push(`- 신뢰도 분포: ${[...byConfidence.entries()].map(([c, n]) => `${c}=${n}`).join(', ')}`)
    lines.push('')
    const lowPages = result.pages.filter((p) => p.confidence === 'low')
    if (lowPages.length > 0) {
      lines.push('### 신뢰도 low 페이지 (검수 우선)')
      lines.push('')
      for (const p of lowPages) {
        lines.push(`- \`${p.relativePath}\` — 낮은 필드: ${p.lowConfidenceFields.join(', ') || '(없음, axis만 low)'}`)
      }
      lines.push('')
    }
    const mediumPages = result.pages.filter((p) => p.confidence === 'medium')
    if (mediumPages.length > 0) {
      lines.push(`### 신뢰도 medium 페이지 (${mediumPages.length}건)`)
      lines.push('')
      lines.push('주요 점검 대상:')
      for (const p of mediumPages.slice(0, 20)) {
        lines.push(`- \`${p.relativePath}\` — 낮은 필드: ${p.lowConfidenceFields.join(', ') || '(axis 추론)'}`)
      }
      if (mediumPages.length > 20) lines.push(`- ... 외 ${mediumPages.length - 20}건`)
      lines.push('')
    }
    if (result.slugCollisions.length > 0) {
      lines.push('### 슬러그 충돌 해소')
      lines.push('')
      for (const c of result.slugCollisions.slice(0, 30)) {
        lines.push(`- \`${c.original}\` → \`${c.resolved}\``)
      }
      if (result.slugCollisions.length > 30) lines.push(`- ... 외 ${result.slugCollisions.length - 30}건`)
      lines.push('')
    }
  }
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
  fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n', 'utf-8')
}

// ---------- --reset 처리 ----------

function resetSourcePages(sourceOrigin: string): number {
  // content/<axis>/*.md 중 frontmatter.source_origin === sourceOrigin인 파일만 삭제.
  // 위원장 수동 작성 파일(source_origin 없음 또는 다름)은 보호.
  let count = 0
  for (const axis of CONTENT_AXES) {
    const dir = path.join(CONTENT_DIR, axis)
    if (!fs.existsSync(dir)) continue
    for (const entry of fs.readdirSync(dir)) {
      if (!entry.endsWith('.md')) continue
      const full = path.join(dir, entry)
      const content = fs.readFileSync(full, 'utf-8')
      try {
        const parsed = matter(content)
        if ((parsed.data as { source_origin?: string }).source_origin === sourceOrigin) {
          fs.unlinkSync(full)
          count += 1
        }
      } catch {
        // skip on parse error
      }
    }
  }
  return count
}

// ---------- 매니페스트 로딩 ----------

// content/_axis-overrides.json 로딩 (M4 수동 검수 결과 반영).
// 형식: { "overrides": { "<slug>": "<axis>" } }
// 알 수 없는 키(`_comment`, `_schema`)는 무시. 잘못된 axis 값은 에러로 종료.
function loadAxisOverrides(): Record<string, ContentAxis> {
  if (!fs.existsSync(AXIS_OVERRIDES_PATH)) return {}
  try {
    const raw = JSON.parse(fs.readFileSync(AXIS_OVERRIDES_PATH, 'utf-8'))
    const overrides = raw.overrides ?? {}
    const validated: Record<string, ContentAxis> = {}
    for (const [slug, axis] of Object.entries(overrides)) {
      if (typeof axis !== 'string' || !(CONTENT_AXES as readonly string[]).includes(axis)) {
        process.stderr.write(
          `[decompose] _axis-overrides.json 잘못된 axis 값: '${slug}' → '${axis}'\n`,
        )
        process.exit(2)
      }
      validated[slug] = axis as ContentAxis
    }
    return validated
  } catch (e) {
    process.stderr.write(
      `[decompose] _axis-overrides.json 파싱 실패: ${(e as Error).message}\n`,
    )
    process.exit(2)
  }
}

function loadImageManifest(): ImageManifestEntry[] {
  if (!fs.existsSync(MANIFEST_PATH)) return []
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
  } catch (e) {
    process.stderr.write(`[decompose] manifest.json 파싱 실패 — 빈 매니페스트로 진행: ${(e as Error).message}\n`)
    return []
  }
}

// ---------- CLI 엔트리 ----------

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const dryRun = argv.includes('--dry-run')
  const reset = argv.includes('--reset')
  const fileArgIdx = argv.indexOf('--file')
  const fileArg = fileArgIdx >= 0 ? argv[fileArgIdx + 1] : null

  // SOURCE_FILE_MAP의 slugPrefix 유일성 invariant (codex-rescue P1 #4).
  // 새 source 추가 시 prefix 충돌이 조용히 파일을 덮어쓰지 않도록 시작 시점에 검사.
  const seenPrefixes = new Map<string, string>()
  for (const [fileName, meta] of Object.entries(SOURCE_FILE_MAP)) {
    const prev = seenPrefixes.get(meta.slugPrefix)
    if (prev) {
      process.stderr.write(
        `[decompose] SOURCE_FILE_MAP prefix 충돌: '${meta.slugPrefix}' — ${prev} vs ${fileName}\n`,
      )
      process.exit(2)
    }
    seenPrefixes.set(meta.slugPrefix, fileName)
  }

  const manifestEntries = loadImageManifest()
  const axisOverrides = loadAxisOverrides()
  if (Object.keys(axisOverrides).length > 0) {
    process.stdout.write(`[decompose] axis 오버라이드 ${Object.keys(axisOverrides).length}건 로드 (content/_axis-overrides.json)\n`)
  }

  let inputFiles: string[]
  if (fileArg) {
    inputFiles = [path.isAbsolute(fileArg) ? fileArg : path.join(REPO_ROOT, fileArg)]
  } else {
    if (!fs.existsSync(SOURCE_MD_DIR)) {
      process.stderr.write(`[decompose] ${SOURCE_MD_DIR} 가 없습니다.\n`)
      process.exit(1)
    }
    inputFiles = fs
      .readdirSync(SOURCE_MD_DIR)
      .filter((f) => f.endsWith('.md'))
      .sort()
      .map((f) => path.join(SOURCE_MD_DIR, f))
  }

  process.stdout.write(`[decompose] 입력 파일 ${inputFiles.length}개\n`)
  process.stdout.write(`[decompose] 매니페스트 엔트리 ${manifestEntries.length}개\n`)
  if (dryRun) process.stdout.write('[decompose] DRY RUN — 파일 쓰기 없음\n')
  if (reset) process.stdout.write('[decompose] --reset 활성 — source_origin 일치 파일 사전 삭제\n')

  const allResults: DecomposeResult[] = []

  for (const filePath of inputFiles) {
    const fileName = path.basename(filePath)
    const meta = SOURCE_FILE_MAP[fileName]
    if (!meta) {
      process.stderr.write(`[decompose] SKIP ${fileName} (SOURCE_FILE_MAP에 없음)\n`)
      continue
    }
    if (reset && !dryRun) {
      const removed = resetSourcePages(meta.sourceOrigin)
      process.stdout.write(`[decompose] reset: ${meta.sourceOrigin} → ${removed}개 삭제\n`)
    }
    const result = decomposeFile({ filePath, imageManifest: manifestEntries, axisOverrides })
    allResults.push(result)
    process.stdout.write(
      `[decompose] ${fileName} → ${result.pages.length}개 페이지, 슬러그 충돌 ${result.slugCollisions.length}건, 이미지 미매칭 ${result.unmatchedImages.length}건\n`,
    )
    if (!dryRun) {
      for (const page of result.pages) {
        writePage(page)
      }
    }
  }

  // 글로벌 path 유일성 검사 (codex-rescue P1 #4) — 다른 source가 같은
  // relativePath를 만들면 후행 source가 선행을 조용히 덮어씀.
  const pathSeen = new Map<string, string>()
  for (const r of allResults) {
    for (const p of r.pages) {
      const prev = pathSeen.get(p.relativePath)
      if (prev) {
        process.stderr.write(
          `[decompose] 글로벌 path 충돌: ${p.relativePath} — ${prev} (source A) vs ${r.sourceOrigin} (source B)\n`,
        )
        process.exit(3)
      }
      pathSeen.set(p.relativePath, r.sourceOrigin)
    }
  }

  // codex-rescue M4 P1 #1 — axis override stale slug 검출.
  // _axis-overrides.json의 모든 key가 실제 분해 결과 slug와 매칭되어야 함.
  // 오타(예: `2024-jbu-p-071x`)가 들어가면 decompose는 silent skip해 검수자가
  // override가 적용됐다고 착각. fail-loud로 막는다.
  //
  // 단, `--file` 모드는 단일 source만 처리하므로 다른 source의 override 키가
  // 정상적으로 "분해 결과 외" 상태. 이 모드에서는 stale 검사 skip (개발/디버깅 용도).
  // 전체 실행(`--reset` 또는 인자 없는 풀 빌드)에서만 검증.
  if (!fileArg && Object.keys(axisOverrides).length > 0) {
    const allSlugs = new Set<string>()
    for (const r of allResults) {
      for (const p of r.pages) allSlugs.add(p.slug)
    }
    const staleKeys = Object.keys(axisOverrides).filter((k) => !allSlugs.has(k))
    if (staleKeys.length > 0) {
      process.stderr.write(
        `[decompose] FATAL: _axis-overrides.json에 분해 결과와 매칭 안 되는 slug ${staleKeys.length}건:\n`,
      )
      for (const k of staleKeys) {
        process.stderr.write(`         · '${k}' → '${axisOverrides[k]}'\n`)
      }
      process.stderr.write(
        `         오타이거나 source 변경으로 slug가 사라진 경우. _axis-overrides.json에서 항목 제거 또는 정정.\n`,
      )
      process.exit(4)
    }
  }

  if (!dryRun) {
    writeReport(allResults)
    process.stdout.write(`[decompose] 리포트: ${path.relative(REPO_ROOT, REPORT_PATH)}\n`)
  } else {
    // dry-run에서는 stdout 요약만
    let totalPages = 0
    let totalLow = 0
    let totalMedium = 0
    for (const r of allResults) {
      totalPages += r.pages.length
      totalLow += r.pages.filter((p) => p.confidence === 'low').length
      totalMedium += r.pages.filter((p) => p.confidence === 'medium').length
    }
    process.stdout.write(
      `[decompose] DRY RUN 요약 — 페이지 ${totalPages}, low ${totalLow}, medium ${totalMedium}\n`,
    )
  }
}

main().catch((e) => {
  process.stderr.write(`[decompose] 실패: ${(e as Error).message}\n${(e as Error).stack}\n`)
  process.exit(1)
})
