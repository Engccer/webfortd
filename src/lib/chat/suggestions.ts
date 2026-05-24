/**
 * Phase 3 M6.5 — 동적 SUGGESTIONS 분기.
 *
 * spec §D6 분기 매트릭스:
 *   - 비로그인 + 신규: 기본 3개 (특수 마우스 / 편의지원 조례 / 학교생활기록부)
 *   - 로그인 + 신규: 진입 유도 3개
 *   - 로그인 + 기존 thread: lastAssistantAxis별 인접 정책 키워드 추천
 *
 * 실제 RAG 인접 슬러그 매핑은 M7 carry — M6는 정적 axis 분기로 시작.
 */

export interface SuggestionContext {
  isAuthenticated: boolean
  /** 활성 thread 보유 여부 (로그인 + DB에 messages 있음) */
  hasThread: boolean
  /** 가장 최근 assistant 응답의 sourceRefs[0].axis (예: 'policies' · 'disability-types' · 'regions' · 'agreements' · 'resources' · 'domains') */
  lastAssistantAxis?: string
}

const DEFAULT_ANON: readonly string[] = [
  '특수 마우스에는 어떤 종류가 있나요?',
  '편의지원 조례를 제정한 시도교육청은 어디인가요?',
  '학교생활기록부 비교과 활동 입력 지원은 어떻게 받나요?',
]

const AUTH_NEW: readonly string[] = [
  '제가 받을 수 있는 보조인력 지원은 무엇인가요?',
  '비슷한 사례의 장애인교원은 어떻게 대응했나요?',
  '제 지역(시도)의 편의지원 제도를 알려주세요',
]

const AXIS_RECOMMENDATIONS: Record<string, readonly string[]> = {
  policies: [
    '이 정책의 신청 절차를 더 자세히 알려주세요',
    '관련된 다른 규정도 함께 보고 싶어요',
    '실제 적용 사례가 있는지 궁금해요',
  ],
  'disability-types': [
    '같은 장애 유형의 다른 교원 사례를 보여주세요',
    '이 장애 유형에 대한 진단·인정 기준이 궁금해요',
    '관련 보조공학기기 추천이 있나요?',
  ],
  regions: [
    '이 지역의 편의지원 조례 전문을 알려주세요',
    '인근 시도와 비교했을 때 차이가 있나요?',
    '해당 교육청에 직접 문의할 창구는 어디인가요?',
  ],
  agreements: [
    '같은 단체협약의 다른 조항도 보고 싶어요',
    '단체협약 적용 범위가 어디까지인가요?',
    '협약 위반 시 구제 절차는 어떻게 되나요?',
  ],
  resources: [
    '관련된 다른 자료가 더 있나요?',
    '이 자료를 어디서 인용·인쇄할 수 있나요?',
    '유사 자료를 추천해 주세요',
  ],
  domains: [
    '이 분야의 핵심 제도를 정리해 주세요',
    '이 분야에서 자주 묻는 질문이 무엇인가요?',
    '관련된 단체협약·조례가 있나요?',
  ],
}

const AXIS_FALLBACK: readonly string[] = [
  '관련된 다른 정책도 함께 알려주세요',
  '실제 적용 사례를 들려주세요',
  '제도를 신청하려면 어디로 문의해야 하나요?',
]

export function getSuggestions(ctx: SuggestionContext): string[] {
  if (!ctx.isAuthenticated) return [...DEFAULT_ANON]
  if (!ctx.hasThread) return [...AUTH_NEW]
  const axisList = ctx.lastAssistantAxis
    ? AXIS_RECOMMENDATIONS[ctx.lastAssistantAxis]
    : undefined
  return axisList ? [...axisList] : [...AXIS_FALLBACK]
}
