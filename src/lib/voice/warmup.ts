"use client";
/**
 * 사용자 제스처(클릭) 체인 내에서 AudioContext를 미리 깨우는 경량 warmup.
 * 오버레이가 열리기 전에 호출해 iOS Safari/Chrome Autoplay 정책으로 AudioContext가
 * suspended에 빠지는 것을 방지한다. (useAudioIO.warmup과 동일 효과의 standalone판 —
 * 실제 세션은 자체 AudioContext를 새로 생성하므로 여기서 만든 건 닫아도 무방.)
 */
export async function warmupAudioStandalone(): Promise<void> {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    if (ctx.state === "suspended") await ctx.resume();
    await ctx.close();
  } catch {
    // 미지원 환경 무해 no-op
  }
}
