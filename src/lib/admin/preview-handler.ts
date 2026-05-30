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
