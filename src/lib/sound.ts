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
