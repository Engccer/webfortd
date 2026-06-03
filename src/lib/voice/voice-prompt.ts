/**
 * Phase 7 — 음성 대화 모드 시스템 프롬프트.
 *
 * 정체성·톤·답변 원칙은 텍스트 채팅과 동일한 단일 기준점(SYSTEM_PROMPT_TEMPLATE)을
 * 재사용한다(DRY, 영구 원칙 정합). 단 Live는 세션 생성 시 프롬프트를 한 번만 박고
 * 청크는 search_policy 도구로 런타임 주입되므로, [참고 자료] 섹션을 떼고
 * 도구 사용 지시 + 음성 모드 지시를 덧붙인다.
 */
import { SYSTEM_PROMPT_TEMPLATE } from '@/lib/rag/prompt-builder'

export function buildVoiceSystemPrompt(): string {
  // SYSTEM_PROMPT_TEMPLATE의 [참고 자료] 섹션 이후를 제거 — 정체성/톤/원칙만 유지.
  // 주의: 답변 원칙 3번에 인라인 "제공된 [참고 자료] 안의"가 먼저 등장하므로,
  // 단순 split('[참고 자료]')은 거기서 잘려 답변 원칙 4·5(영구 원칙)를 누락시킨다.
  // 반드시 헤더(앞뒤 개행으로 둘러싸인 '\n[참고 자료]\n')만 split 기준으로 삼는다.
  const VOICE_SPLIT_MARKER = '\n[참고 자료]\n'
  const splitIdx = SYSTEM_PROMPT_TEMPLATE.indexOf(VOICE_SPLIT_MARKER)
  if (splitIdx === -1) {
    throw new Error('buildVoiceSystemPrompt: SYSTEM_PROMPT_TEMPLATE에서 [참고 자료] 섹션 구분자를 찾을 수 없어요.')
  }
  const base = SYSTEM_PROMPT_TEMPLATE.slice(0, splitIdx).trim()
  return `${base}

[정보 검색 — search_policy 도구]
사용자가 제도·정책·지원·법령을 물으면 추측하지 말고 반드시 search_policy 도구를
호출해 관련 자료를 찾은 뒤, 그 내용을 근거로 답해요. 도구가 돌려준 자료에 없는
내용은 "이 부분은 확인된 자료에 없어요. 소속 교육청에 문의해 보세요"라고 안내해요.

[음성 대화 모드]
- 지금은 음성으로 대화하고 있어요. 짧고 자연스러운 구어체로 답해요.
- 마크다운, 글머리표, 번호 목록, 긴 포맷은 쓰지 마세요. 말하듯이 풀어서 설명해요.
- search_policy를 호출하기 직전에 "잠깐만요, 찾아볼게요" 같은 짧은 말을 먼저 건네
  1초 이상 침묵하지 않아요.
- 출처는 자연스럽게 말로 언급해요. 예: "이건 ○○ 자료에 나와 있어요."
- 답변 끝에 "참고용이니 실제 절차는 소속 교육청에 확인해 주세요"를 자연스럽게 덧붙여요.`
}
