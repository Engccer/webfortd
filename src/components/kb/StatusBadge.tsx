interface StatusConfig {
  label: string
  description: string
  className: string
}

const STATUS_MAP: Record<string, StatusConfig> = {
  draft: {
    label: "초안",
    description: "초안 — 검수 진행 중인 페이지입니다",
    className: "bg-amber-100 text-amber-800",
  },
  in_review: {
    label: "검수중",
    description: "검수중 — 검수 요청 대기 중인 페이지입니다",
    className: "bg-blue-100 text-blue-800",
  },
  published: {
    label: "게시됨",
    description: "게시됨 — 검수 완료된 게시 페이지입니다",
    className: "bg-emerald-100 text-emerald-800",
  },
  archived: {
    label: "보관됨",
    description: "보관됨 — 보관 처리된 페이지입니다",
    className: "bg-zinc-200 text-zinc-700",
  },
  deprecated: {
    label: "폐기됨",
    description: "폐기됨 — 폐기 처리된 페이지입니다",
    className: "bg-rose-100 text-rose-800",
  },
}

const FALLBACK: StatusConfig = {
  label: "알수없음",
  description: "알수없음 — 상태를 식별할 수 없는 페이지입니다",
  className: "bg-zinc-100 text-zinc-700",
}

interface StatusBadgeProps {
  status: string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_MAP[status] ?? FALLBACK
  return (
    <span
      role="status"
      aria-label={config.description}
      className={`rounded-full px-3 py-1 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  )
}
