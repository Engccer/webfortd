"use client"

import { loadSettings } from "./accessibility"

// Sound cache to avoid creating new Audio elements on every play
const soundCache: Map<string, HTMLAudioElement> = new Map()

function getSound(name: string): HTMLAudioElement | null {
  if (typeof window === "undefined") return null

  if (!soundCache.has(name)) {
    const audio = new Audio(`/sounds/${name}.mp3`)
    audio.volume = 0.3 // Subtle volume
    soundCache.set(name, audio)
  }
  return soundCache.get(name) || null
}

export function playMenuOpenSound(): void {
  const settings = loadSettings()
  if (!settings.soundEnabled) return

  const sound = getSound("menu-open")
  if (sound) {
    sound.currentTime = 0
    sound.play().catch(() => {
      // Ignore autoplay errors
    })
  }
}

export function playMenuFocusSound(): void {
  const settings = loadSettings()
  if (!settings.soundEnabled) return

  const sound = getSound("menu-focus")
  if (sound) {
    sound.currentTime = 0
    sound.play().catch(() => {
      // Ignore autoplay errors
    })
  }
}

// 채팅 효과음 (dodo-planet chat-send/chat-receive 이식).
// 게이트는 menu 사운드와 동일한 accessibility.soundEnabled — 접근성 툴바 "효과음" 토글이 제어.
export function playChatSendSound(): void {
  const settings = loadSettings()
  if (!settings.soundEnabled) return

  const sound = getSound("chat-send")
  if (sound) {
    sound.currentTime = 0
    sound.play().catch(() => {
      // Ignore autoplay errors
    })
  }
}

export function playChatReceiveSound(): void {
  const settings = loadSettings()
  if (!settings.soundEnabled) return

  const sound = getSound("chat-receive")
  if (sound) {
    sound.currentTime = 0
    sound.play().catch(() => {
      // Ignore autoplay errors
    })
  }
}
