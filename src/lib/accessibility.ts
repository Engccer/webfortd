"use client"

export interface AccessibilitySettings {
  fontSize: number // 80-200
  lineHeight: "normal" | "relaxed" | "loose"
  contrast: "default" | "high1" | "high2"
  underlineLinks: boolean
  reduceMotion: boolean
}

export const defaultSettings: AccessibilitySettings = {
  fontSize: 100,
  lineHeight: "normal",
  contrast: "default",
  underlineLinks: false,
  reduceMotion: false,
}

export function loadSettings(): AccessibilitySettings {
  if (typeof window === "undefined") return defaultSettings

  try {
    const saved = localStorage.getItem("accessibility-settings")
    if (saved) {
      return { ...defaultSettings, ...JSON.parse(saved) }
    }
  } catch (e) {
    console.error("Failed to load accessibility settings:", e)
  }
  return defaultSettings
}

export function saveSettings(settings: AccessibilitySettings): void {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem("accessibility-settings", JSON.stringify(settings))
  } catch (e) {
    console.error("Failed to save accessibility settings:", e)
  }
}

export function applySettings(settings: AccessibilitySettings): void {
  if (typeof document === "undefined") return

  const root = document.documentElement

  // Font size
  root.style.fontSize = `${settings.fontSize}%`

  // Line height
  const lineHeightMap = {
    normal: "1.5",
    relaxed: "1.75",
    loose: "2",
  }
  root.style.setProperty("--line-height", lineHeightMap[settings.lineHeight])

  // Contrast
  root.setAttribute("data-contrast", settings.contrast)

  // Underline links
  root.setAttribute("data-underline-links", String(settings.underlineLinks))

  // Reduce motion
  if (settings.reduceMotion) {
    root.classList.add("reduce-motion")
  } else {
    root.classList.remove("reduce-motion")
  }
}

// Keyboard shortcuts
export function setupKeyboardShortcuts(): () => void {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!e.altKey) return

    switch (e.key) {
      case "0":
        // Open accessibility toolbar
        document.getElementById("accessibility-toolbar-toggle")?.click()
        e.preventDefault()
        break
      case "1":
        // Skip to main content
        document.getElementById("main-content")?.focus()
        e.preventDefault()
        break
      case "2":
        // Skip to navigation
        document.getElementById("main-nav")?.focus()
        e.preventDefault()
        break
      case "3":
        // Skip to search
        document.getElementById("search-input")?.focus()
        e.preventDefault()
        break
    }
  }

  window.addEventListener("keydown", handleKeyDown)
  return () => window.removeEventListener("keydown", handleKeyDown)
}
