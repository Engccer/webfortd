// 홈 옴니박스 → 채팅 자동 전송 E2E (실 브라우저).
//
// 단위 테스트는 조각을 각각 증명하지만(버튼이 onAsk를 부른다 / 훅이 1회 보낸다),
// "홈에서 쓴 질문이 채팅에 도착하고 주소가 정리되는가"는 라우팅·서버 컴포넌트·
// 클라이언트 훅이 이어져야 성립하므로 실 브라우저가 정본이다.
//
// LLM 응답 자체는 검증하지 않는다(키·쿼터 의존). 검증 대상은 전송까지의 계약:
// 질문이 사용자 턴으로 화면에 서고, 주소에서 q가 사라져 새로고침 재전송이 막히는 것.

import { expect, test } from "@playwright/test"

const QUESTION = "장애인교원 병가는 며칠인가요"

test("[AI에게 질문]이 입력한 질문을 채팅으로 전송하고 주소에서 q를 지운다", async ({
  page,
}) => {
  await page.goto("/")

  await page.getByRole("combobox").fill(QUESTION)
  await page.getByRole("button", { name: "AI에게 질문" }).click()

  await page.waitForURL(/\/chat/)

  // 질문은 사용자 턴 헤딩으로 선다(접근성 헌장 §6 — 턴 단위 점프 경로).
  await expect(
    page.getByRole("heading", { name: QUESTION, exact: true }),
  ).toBeVisible()

  // 자동 전송 직후 q 제거 — 새로고침해도 같은 질문이 다시 나가지 않는다.
  await expect.poll(() => new URL(page.url()).searchParams.has("q")).toBe(false)
})

test("입력이 비면 질문 없이 빈 채팅을 연다", async ({ page }) => {
  await page.goto("/")

  await page.getByRole("button", { name: "AI에게 질문" }).click()

  await page.waitForURL(/\/chat$/)
  await expect(page.getByRole("heading", { name: QUESTION })).toHaveCount(0)
})

// Enter와 Cmd+Enter가 서로 다른 곳으로 간다는 것이 듀얼 액션의 핵심 계약이라,
// 결과가 실제로 나오는 짧은 쿼리로 양쪽을 각각 검증한다(문장형 질문은 검색 결과가
// 0건이라 Enter가 무동작이 되어, 계약을 검증하지 못한 채 통과한다).
const SEARCH_TERM = "병가"

test("Enter는 검색 결과 문서로 이동한다", async ({ page }) => {
  await page.goto("/")

  const input = page.getByRole("combobox")
  await input.fill(SEARCH_TERM)
  await expect(page.getByRole("listbox")).toBeVisible()

  await input.press("Enter")

  await page.waitForURL((url) => url.pathname !== "/")
  expect(new URL(page.url()).pathname).not.toContain("/chat")
})

test("Cmd+Enter는 같은 입력을 채팅 질문으로 보낸다", async ({ page }) => {
  await page.goto("/")

  const input = page.getByRole("combobox")
  await input.fill(SEARCH_TERM)
  await expect(page.getByRole("listbox")).toBeVisible()

  await input.press("ControlOrMeta+Enter")

  await page.waitForURL(/\/chat/)
  await expect(
    page.getByRole("heading", { name: SEARCH_TERM, exact: true }),
  ).toBeVisible()
})
