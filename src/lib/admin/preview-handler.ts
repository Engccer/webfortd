/**
 * Phase B M2 — Draft Mode 토글 DI 코어.
 * next/headers·server-only 미import → 단위 테스트 가능.
 * route.ts가 실제 draftMode()/admin status를 주입.
 */
import type { AdminStatus } from '@/lib/auth/admin-types'

interface DraftController {
  enable: () => void
  disable: () => void
}

/**
 * CSRF 방어 — admin Draft Mode 토글은 same-origin 요청만 허용.
 * codex-rescue P1-1: cross-site POST로 preview가 토글되는 것을 차단.
 * 모던 브라우저는 fetch 시 Sec-Fetch-Site를 항상 보낸다. same-site(서브도메인)·
 * cross-site·헤더 부재(비브라우저)는 모두 거부해 공격 표면을 최소화한다.
 */
export function isSameOriginRequest(secFetchSite: string | null): boolean {
  return secFetchSite === 'same-origin'
}

export async function runPreviewToggle(
  enable: boolean,
  deps: { adminStatus: AdminStatus; draft: DraftController },
): Promise<Response> {
  if (!deps.adminStatus.isAdmin) {
    return Response.json({ error: '관리자만 사용할 수 있어요.' }, { status: 403 })
  }
  if (enable) {
    deps.draft.enable()
  } else {
    deps.draft.disable()
  }
  return Response.json({ enabled: enable })
}
