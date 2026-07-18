/**
 * 받아쓰기 효과음 invariant — 시작/끝을 음높이 방향으로 구분한다는 계약을 고정한다.
 * 시작과 정지 톤이 뒤바뀌면 시각장애인 사용자가 받아쓰기 상태를 오인하므로 회귀를 막는다.
 * (gildongmu 테스트 이식, vitest→node:test)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { START_TONES, STOP_TONES, CANCEL_TONES } from '../../src/lib/recording-tones.ts'

describe('recording tones', () => {
  it('시작음은 올라가는 멜로디(낮은음→높은음)', () => {
    assert.ok(START_TONES.length >= 2)
    assert.ok(START_TONES[1].freq > START_TONES[0].freq)
  })

  it('정지음은 내려가는 멜로디(높은음→낮은음)', () => {
    assert.ok(STOP_TONES.length >= 2)
    assert.ok(STOP_TONES[1].freq < STOP_TONES[0].freq)
  })

  it('취소음은 단음', () => {
    assert.equal(CANCEL_TONES.length, 1)
  })

  it('모든 톤은 양수 주파수·지속시간', () => {
    for (const tone of [...START_TONES, ...STOP_TONES, ...CANCEL_TONES]) {
      assert.ok(tone.freq > 0)
      assert.ok(tone.dur > 0)
      assert.ok(tone.start >= 0)
    }
  })
})
