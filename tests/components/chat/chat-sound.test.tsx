/**
 * 채팅 효과음 게이트 단위 테스트 (lib/sound.ts).
 *
 * dodo-planet chat-send/chat-receive 이식.
 * 검증:
 *   - accessibility.soundEnabled=true면 해당 mp3를 재생 (Audio.play 호출)
 *   - soundEnabled=false면 Audio를 아예 생성하지 않음 (게이트가 getSound 이전에 short-circuit)
 *
 * vi.resetModules + per-test dynamic import로 sound.ts의 모듈 레벨 soundCache를
 * 매 테스트 격리한다(캐시 reuse로 인한 cross-test 오염 회피).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const loadSettingsMock = vi.fn()
vi.mock('@/lib/accessibility', () => ({
  loadSettings: () => loadSettingsMock(),
}))

// 생성된 Audio 인스턴스 추적 (src로 식별)
const created: MockAudio[] = []
class MockAudio {
  src: string
  volume = 1
  currentTime = 0
  play = vi.fn(() => Promise.resolve())
  constructor(src: string) {
    this.src = src
    created.push(this)
  }
}

function instanceFor(part: string): MockAudio | undefined {
  return created.find((a) => a.src.includes(part))
}

describe('채팅 효과음 (lib/sound.ts)', () => {
  beforeEach(() => {
    vi.resetModules()
    created.length = 0
    loadSettingsMock.mockReset()
    vi.stubGlobal('Audio', MockAudio as unknown as typeof Audio)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('soundEnabled=true면 playChatSendSound가 chat-send.mp3를 재생', async () => {
    loadSettingsMock.mockReturnValue({ soundEnabled: true })
    const { playChatSendSound } = await import('@/lib/sound')
    playChatSendSound()
    const audio = instanceFor('chat-send')
    expect(audio).toBeDefined()
    expect(audio?.play).toHaveBeenCalledTimes(1)
    expect(audio?.currentTime).toBe(0)
  })

  it('soundEnabled=true면 playChatReceiveSound가 chat-receive.mp3를 재생', async () => {
    loadSettingsMock.mockReturnValue({ soundEnabled: true })
    const { playChatReceiveSound } = await import('@/lib/sound')
    playChatReceiveSound()
    const audio = instanceFor('chat-receive')
    expect(audio).toBeDefined()
    expect(audio?.play).toHaveBeenCalledTimes(1)
  })

  it('soundEnabled=false면 Audio를 생성하지 않음 (게이트 short-circuit)', async () => {
    loadSettingsMock.mockReturnValue({ soundEnabled: false })
    const { playChatSendSound, playChatReceiveSound } = await import('@/lib/sound')
    playChatSendSound()
    playChatReceiveSound()
    expect(created.length).toBe(0)
  })
})
