"use client"

import * as React from "react"
import * as Dialog from "@radix-ui/react-dialog"
import * as Slider from "@radix-ui/react-slider"
import * as Switch from "@radix-ui/react-switch"
import { Settings, X, Type, AlignJustify, Contrast, Link2, Pause } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  type AccessibilitySettings,
  defaultSettings,
  loadSettings,
  saveSettings,
  applySettings,
  setupKeyboardShortcuts,
} from "@/lib/accessibility"

export function AccessibilityToolbar() {
  const [open, setOpen] = React.useState(false)
  const [settings, setSettings] = React.useState<AccessibilitySettings>(defaultSettings)

  React.useEffect(() => {
    const loaded = loadSettings()
    setSettings(loaded)
    applySettings(loaded)
  }, [])

  React.useEffect(() => {
    const cleanup = setupKeyboardShortcuts()
    return cleanup
  }, [])

  const updateSetting = <K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    saveSettings(newSettings)
    applySettings(newSettings)
  }

  const resetSettings = () => {
    setSettings(defaultSettings)
    saveSettings(defaultSettings)
    applySettings(defaultSettings)
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          id="accessibility-toolbar-toggle"
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="접근성 설정"
        >
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">접근성</span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed right-4 top-4 z-50 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl focus:outline-none">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              접근성 설정
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="mb-6 text-sm text-gray-600">
            화면 표시 방식을 조정할 수 있습니다. 설정은 자동으로 저장됩니다.
          </Dialog.Description>

          <div className="space-y-6">
            {/* Font Size */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Type className="h-4 w-4" />
                <span>글자 크기: {settings.fontSize}%</span>
              </div>
              <Slider.Root
                className="relative flex h-5 w-full touch-none select-none items-center"
                value={[settings.fontSize]}
                onValueChange={([value]) => updateSetting("fontSize", value)}
                min={80}
                max={200}
                step={10}
                aria-label="글자 크기"
              >
                <Slider.Track className="relative h-2 grow rounded-full bg-gray-200">
                  <Slider.Range className="absolute h-full rounded-full bg-blue-600" />
                </Slider.Track>
                <Slider.Thumb className="block h-5 w-5 rounded-full bg-white shadow-lg ring-1 ring-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </Slider.Root>
              <div className="flex justify-between text-xs text-gray-500">
                <span>80%</span>
                <span>200%</span>
              </div>
            </div>

            {/* Line Height */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <AlignJustify className="h-4 w-4" />
                <span>줄 간격</span>
              </div>
              <div className="flex gap-2">
                {(["normal", "relaxed", "loose"] as const).map((value) => (
                  <button
                    key={value}
                    onClick={() => updateSetting("lineHeight", value)}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500",
                      settings.lineHeight === value
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    {value === "normal" && "기본"}
                    {value === "relaxed" && "넓게"}
                    {value === "loose" && "더 넓게"}
                  </button>
                ))}
              </div>
            </div>

            {/* Contrast */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Contrast className="h-4 w-4" />
                <span>대비</span>
              </div>
              <div className="flex gap-2">
                {(["default", "high1", "high2"] as const).map((value) => (
                  <button
                    key={value}
                    onClick={() => updateSetting("contrast", value)}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500",
                      settings.contrast === value
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    {value === "default" && "기본"}
                    {value === "high1" && "고대비 1"}
                    {value === "high2" && "고대비 2"}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggle Options */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Link2 className="h-4 w-4" />
                  <span>링크 밑줄 표시</span>
                </div>
                <Switch.Root
                  checked={settings.underlineLinks}
                  onCheckedChange={(checked) => updateSetting("underlineLinks", checked)}
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                    settings.underlineLinks ? "bg-blue-600" : "bg-gray-200"
                  )}
                >
                  <Switch.Thumb
                    className={cn(
                      "block h-5 w-5 rounded-full bg-white shadow-lg transition-transform",
                      settings.underlineLinks ? "translate-x-5" : "translate-x-0.5"
                    )}
                  />
                </Switch.Root>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Pause className="h-4 w-4" />
                  <span>애니메이션 줄이기</span>
                </div>
                <Switch.Root
                  checked={settings.reduceMotion}
                  onCheckedChange={(checked) => updateSetting("reduceMotion", checked)}
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                    settings.reduceMotion ? "bg-blue-600" : "bg-gray-200"
                  )}
                >
                  <Switch.Thumb
                    className={cn(
                      "block h-5 w-5 rounded-full bg-white shadow-lg transition-transform",
                      settings.reduceMotion ? "translate-x-5" : "translate-x-0.5"
                    )}
                  />
                </Switch.Root>
              </div>
            </div>

            {/* Reset Button */}
            <button
              onClick={resetSettings}
              className="w-full rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              기본값으로 초기화
            </button>

            {/* Keyboard Shortcuts Info */}
            <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
              <p className="mb-1 font-medium">키보드 단축키</p>
              <ul className="space-y-0.5">
                <li>Alt+0: 접근성 설정</li>
                <li>Alt+1: 본문으로 이동</li>
                <li>Alt+2: 메뉴로 이동</li>
                <li>Alt+3: 검색으로 이동</li>
              </ul>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
