"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Settings, X, Type, AlignJustify, Contrast, Link2, Pause, Moon, Sun, Monitor, Volume2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  type AccessibilitySettings,
  defaultSettings,
  loadSettings,
  saveSettings,
  applySettings,
  setupKeyboardShortcuts,
} from "@/lib/accessibility"
import { Button } from "@/components/ui/Button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

export function AccessibilityToolbar() {
  const [open, setOpen] = React.useState(false)
  const [settings, setSettings] = React.useState<AccessibilitySettings>(defaultSettings)
  const [mounted, setMounted] = React.useState(false)
  const { theme, setTheme } = useTheme()

  React.useEffect(() => {
    setMounted(true)
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
    setTheme("system")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          id="accessibility-toolbar-toggle"
          className="gap-2"
          aria-label="접근성 설정"
        >
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">접근성</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>접근성 설정</DialogTitle>
          <DialogDescription>
            화면 표시 방식을 조정할 수 있습니다. 설정은 자동으로 저장됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Theme Mode */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              {mounted && theme === "dark" ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
              <span>화면 모드</span>
            </div>
            <div className="flex gap-2">
              {(["light", "dark", "system"] as const).map((value) => (
                <Button
                  key={value}
                  variant={mounted && theme === value ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setTheme(value)}
                >
                  {value === "light" && <Sun className="mr-1 h-3 w-3" />}
                  {value === "dark" && <Moon className="mr-1 h-3 w-3" />}
                  {value === "system" && <Monitor className="mr-1 h-3 w-3" />}
                  {value === "light" && "밝게"}
                  {value === "dark" && "어둡게"}
                  {value === "system" && "시스템"}
                </Button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Type className="h-4 w-4" />
              <span>글자 크기: {settings.fontSize}%</span>
            </div>
            <Slider
              value={[settings.fontSize]}
              onValueChange={([value]) => updateSetting("fontSize", value)}
              min={80}
              max={200}
              step={10}
              aria-label="글자 크기"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>80%</span>
              <span>200%</span>
            </div>
          </div>

          {/* Line Height */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlignJustify className="h-4 w-4" />
              <span>줄 간격</span>
            </div>
            <div className="flex gap-2">
              {(["normal", "relaxed", "loose"] as const).map((value) => (
                <Button
                  key={value}
                  variant={settings.lineHeight === value ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => updateSetting("lineHeight", value)}
                >
                  {value === "normal" && "기본"}
                  {value === "relaxed" && "넓게"}
                  {value === "loose" && "더 넓게"}
                </Button>
              ))}
            </div>
          </div>

          {/* Contrast */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Contrast className="h-4 w-4" />
              <span>대비</span>
            </div>
            <div className="flex gap-2">
              {(["default", "high1", "high2"] as const).map((value) => (
                <Button
                  key={value}
                  variant={settings.contrast === value ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => updateSetting("contrast", value)}
                >
                  {value === "default" && "기본"}
                  {value === "high1" && "고대비 1"}
                  {value === "high2" && "고대비 2"}
                </Button>
              ))}
            </div>
          </div>

          {/* Toggle Options */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="underline-links" className="flex items-center gap-2 text-sm font-medium">
                <Link2 className="h-4 w-4" />
                <span>링크 밑줄 표시</span>
              </Label>
              <Switch
                id="underline-links"
                checked={settings.underlineLinks}
                onCheckedChange={(checked) => updateSetting("underlineLinks", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="reduce-motion" className="flex items-center gap-2 text-sm font-medium">
                <Pause className="h-4 w-4" />
                <span>애니메이션 줄이기</span>
              </Label>
              <Switch
                id="reduce-motion"
                checked={settings.reduceMotion}
                onCheckedChange={(checked) => updateSetting("reduceMotion", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="sound-enabled" className="flex items-center gap-2 text-sm font-medium">
                <Volume2 className="h-4 w-4" />
                <span>메뉴 효과음</span>
              </Label>
              <Switch
                id="sound-enabled"
                checked={settings.soundEnabled}
                onCheckedChange={(checked) => updateSetting("soundEnabled", checked)}
              />
            </div>
          </div>

          {/* Reset Button */}
          <Button
            variant="outline"
            className="w-full"
            onClick={resetSettings}
          >
            기본값으로 초기화
          </Button>

          {/* Keyboard Shortcuts Info */}
          <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <p className="mb-1 font-medium">키보드 단축키</p>
            <ul className="space-y-0.5">
              <li>Alt+0: 접근성 설정</li>
              <li>Alt+1: 본문으로 이동</li>
              <li>Alt+2: 메뉴로 이동</li>
              <li>Alt+3: 검색으로 이동</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
