import Link from "next/link"
import { mainNavigation } from "@/lib/navigation"

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* About */}
          <div className="lg:col-span-1">
            <h2 className="text-lg font-bold text-gray-900">
              장애인교원 교육전념 여건 지원
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              장애인교원의 교육활동을 보호하고 교육활동에 전념할 수 있는 여건 및 기반을 마련합니다.
            </p>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-900">
              바로가기
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {mainNavigation.slice(0, 6).map((item) => (
                <div key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-gray-600 hover:text-blue-600 hover:underline"
                  >
                    {item.title}
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-900">
              문의
            </h3>
            <div className="mt-4 space-y-2 text-sm text-gray-600">
              <p>이메일: support@example.go.kr</p>
              <p>전화: 044-XXX-XXXX</p>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-8 border-t border-gray-200 pt-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <Link href="/privacy" className="hover:text-blue-600 hover:underline">
                개인정보처리방침
              </Link>
              <Link href="/terms" className="hover:text-blue-600 hover:underline">
                이용약관
              </Link>
              <Link href="/sitemap" className="hover:text-blue-600 hover:underline">
                사이트맵
              </Link>
            </div>
            <p className="text-sm text-gray-500">
              © 2025 장애인교원 교육전념 여건 지원. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
