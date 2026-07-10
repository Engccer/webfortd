import Foundation

enum AppConfig {
    /// 문서 내 이미지의 원격 base. 오프라인이면 alt 텍스트가 정본.
    #if DEBUG
    /// 디버그는 WEBFORTD_BASE_URL env로 주입 가능. 파싱 불가 값이면 릴리스 기본값으로 폴백.
    static let webBaseURL: URL = {
        if let raw = ProcessInfo.processInfo.environment["WEBFORTD_BASE_URL"],
           let url = URL(string: raw) {
            return url
        }
        return URL(string: "https://webfortd.vercel.app")!
    }()
    #else
    static let webBaseURL = URL(string: "https://webfortd.vercel.app")!
    #endif

    /// Supabase 프로젝트 URL·anon key. 웹 `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`·
    /// `NEXT_PUBLIC_SUPABASE_ANON_KEY`와 동일 값(같은 프로젝트를 가리킴). anon key는
    /// 클라이언트에 공개되는 배포값(RLS로 서버 측 접근 제어)이라 하드코딩 허용.
    static let supabaseURL = URL(string: "https://djaeeqdxkynjxngwvzyn.supabase.co")!
    static let supabaseAnonKey = "sb_publishable__og77mTHPGAbRuDI5B7OUw_NXlTQ6P1"
}
