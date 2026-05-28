import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "About",
  description: "본 사이트의 정체성·목적·운영 주체를 안내합니다.",
}

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">About</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        장애인교원에 관한 모든 정보를 한곳에서 안내합니다.
      </p>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold">사이트 정체성</h2>
        <p>
          본 사이트는 <strong>장애인교원 교육전념 여건 지원 사업</strong>의
          시범 모델입니다. 함께하는장애인교원노동조합(장교조)이 제작·운영하고
          있으며, 사업의 본격 확장 단계에서는 교육부·중부대 공식 운영으로
          이관될 예정입니다.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold">채팅의 역할</h2>
        <p>
          본 사이트의 채팅은 <strong>대한민국 장애인교원 관련 제도 및 정책 안내</strong>를
          담당합니다. 장애인교원·예비교사·장애학생 부모·정책 입안자 누구든 자연어로
          정책 질문을 할 수 있고, 출처와 함께 답변을 받을 수 있습니다.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold">콘텐츠 범위</h2>
        <p>
          535개의 정책·법령·사례·보조공학기기 페이지가 위키 형태로 연결되어
          있습니다. 자료실에서는 원본 정책 보고서·안내서를 PDF로 다운로드할 수
          있고, 미디어 자료실에서는 카드뉴스·인포그래픽을 alt 텍스트와 함께
          볼 수 있습니다.
        </p>
      </section>

      <p className="mt-12 text-sm text-muted-foreground">
        본 페이지의 본문은 시범 단계 placeholder입니다. 운영 주체의 정식 본문은
        Phase 5에서 정련됩니다.
      </p>
    </article>
  )
}
