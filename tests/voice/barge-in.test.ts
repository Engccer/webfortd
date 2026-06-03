import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  BARGE_IN_THRESHOLD, SUSTAINED_LOUD_FRAMES,
  updateLoudFrames, shouldSendAudio, shouldAcceptInterruption,
} from '../../src/lib/voice/barge-in.ts'

test('updateLoudFrames: 임계 초과 N프레임 연속 → sustained', () => {
  let count = 0
  for (let i = 0; i < SUSTAINED_LOUD_FRAMES - 1; i++) {
    const r = updateLoudFrames(count, BARGE_IN_THRESHOLD)
    count = r.count
    assert.equal(r.sustained, false)
  }
  const r = updateLoudFrames(count, BARGE_IN_THRESHOLD)
  assert.equal(r.sustained, true)
})

test('updateLoudFrames: 임계 미만이면 카운트 리셋', () => {
  const r = updateLoudFrames(5, BARGE_IN_THRESHOLD - 0.01)
  assert.equal(r.count, 0)
  assert.equal(r.sustained, false)
})

test('shouldSendAudio: 모델 재생 중 + sustained 아니면 차단(에코)', () => {
  assert.equal(shouldSendAudio({ isMuted: false, modelStillPlaying: true, sustained: false }), false)
  assert.equal(shouldSendAudio({ isMuted: false, modelStillPlaying: true, sustained: true }), true)
  assert.equal(shouldSendAudio({ isMuted: false, modelStillPlaying: false, sustained: false }), true)
  assert.equal(shouldSendAudio({ isMuted: true, modelStillPlaying: false, sustained: true }), false)
})

test('shouldAcceptInterruption: 최근 발화 500ms 이내만 수용', () => {
  assert.equal(shouldAcceptInterruption(499), true)
  assert.equal(shouldAcceptInterruption(501), false)
})
