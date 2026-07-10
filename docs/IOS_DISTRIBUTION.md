# webfortd iOS 앱 TestFlight·App Store 배포 준비

> 이 문서는 **Apple Developer Program 가입 이후 실행할 절차**를 정리한다. 가입 자체는
> 비용이 발생하는 작업(연 99달러)이라 자율성 헌장의 하드 스톱 4종 중 "비용 발생 작업"에
> 해당한다. 위원장 승인 없이 결제를 진행하지 않는다.
>
> 대상: `ios/Webfortd`(SwiftUI 네이티브 앱, 번들 ID `kr.khudt.webfortd`). 웹(Next.js)
> 배포와는 완전히 별개 트랙이다.

## 1. 전제: Apple Developer Program 가입

App Store에 공개 배포하려면 Apple Developer Program 가입이 필요하다(연 99달러, 지역별
현지가 가능). 가입 전 다음을 결정해야 한다.

- **개인 가입**: 가장 빠르다. 다만 App Store의 판매자명(seller name)에 **가입자의 법적
  개인 이름**이 그대로 노출된다. 위원장 개인 명의(김헌용)로 노출되는 것이 이 앱의 위상
  ("장애인교원 교육전념 여건 지원 사업의 시범 자산")과 맞는지 먼저 판단이 필요하다.
- **조직(장교조) 가입**: 판매자명에 "함께하는장애인교원노동조합" 등 단체명을 노출할 수
  있다. 다만 계약 체결 권한이 있는 대표자, 조직 도메인 이메일·웹사이트, **D-U-N-S 번호**
  (Dun & Bradstreet 발급, 무료지만 발급까지 며칠~수 주 소요될 수 있음)가 추가로 필요하다.
  webfortd가 "장교조가 제작했지만 사업 자산"이라는 위치(CLAUDE.md §앱 정체성)를 고려하면
  장기적으로는 조직 가입이 정체성에 더 부합하지만, 시범 단계에서 D-U-N-S 발급을 기다리는
  비용 대비 개인 가입으로 먼저 TestFlight 내부 테스트만 진행하는 절충안도 가능하다.

가입 주체를 정한 뒤 [Apple Developer Program 가입 안내](https://developer.apple.com/programs/enroll/)에서
결제를 진행한다. 현재 Xcode 프로젝트에는 로컬 개발용 서명 팀(무료 Apple Account 기반,
시뮬레이터·실기기 디버그 빌드까지만 가능)이 이미 연결되어 있으나, **App Store Connect
업로드·TestFlight 배포에는 유료 Program 가입이 별도로 필요**하다(무료 팀으로는 진행 불가).

## 2. 준비물 체크리스트

가입 후 실제 제출 전 아래를 모두 준비한다. 현재 저장소 기준 상태를 함께 표시한다.

| 항목 | 현재 상태 | 필요 조치 |
|------|-----------|-----------|
| App Store 아이콘(1024×1024, 알파 없음) | **미제작**(`ios/Webfortd`에 `.xcassets` 자체가 없음) | 위원장 결정 필요 항목. 브랜드 로고가 아직 없다면 "장애인교원 위키" 정체성을 담은 아이콘을 새로 제작해야 한다 |
| 앱 스크린샷(6.9"·6.5" 클래스) | 미제작 | 이 문서 §5 시뮬레이터 스모크 스크린샷(`/tmp/webfortd-m4-*.png`)은 개발 검증용이라 그대로 제출용으로 쓸 수 없다. 실제 기기/시뮬레이터에서 App Store 심사 규격에 맞춰 다시 촬영해야 한다. 제출 시점에 App Store Connect의 최신 스크린샷 규격(픽셀 치수)을 다시 확인할 것. Apple이 주기적으로 지원 기기 세대를 갱신한다 |
| 개인정보처리방침 URL | **`/privacy` 페이지 존재하나 본문이 placeholder**("본문은 작성 중입니다") | Apple은 실제 내용이 있는 정책 문서를 요구한다. 심사 제출 전 정식 본문을 채워야 한다(수집 항목: 이메일(인증)·대화 내용(로그인 시 저장) 최소 수집, §4 참고) |
| 지원(Support) URL | 실제 앱 문의용 페이지 없음(`(gov)/legacy/support`는 "지원제도 안내"로 동명이의, 앱 문의 채널이 아님) | 임시로 장교조 대표 이메일(`hudt0715@gmail.com`)을 지원 연락처로 등록하거나, `/support` 경로에 간단한 문의 안내 페이지를 신설한다 |
| 이용약관(선택) | `/terms` 페이지 존재하나 placeholder | 필수는 아니지만 채팅·계정 기능이 있으므로 채우는 것을 권장 |

## 3. 배포 절차

1. **Xcode 서명 팀 전환**: `Webfortd.xcodeproj` → Signing & Capabilities → Team을 유료
   Program이 활성화된 팀으로 변경(Automatically Manage Signing 유지). 번들 ID는 이미
   `kr.khudt.webfortd`로 고정돼 있으므로 변경하지 않는다(App Store Connect에 최초 업로드
   후에는 번들 ID를 바꿀 수 없다).
2. **App Store Connect 앱 생성**: App Store Connect에서 새 앱 레코드를 만들고 번들 ID
   `kr.khudt.webfortd`를 명시적 App ID로 선택한다(사전에 Certificates, Identifiers &
   Profiles에서 등록되어 있어야 한다). 이름·SKU·기본 언어(한국어)를 지정한다.
3. **Archive**: Xcode에서 `Any iOS Device` 대상으로 Product → Archive.
4. **Organizer 업로드**: Archive 완료 후 Organizer에서 Validate → Distribute App →
   App Store Connect 경로로 업로드. Privacy manifest·서명 경고가 없는지 확인한다(경고가
   있으면 근거를 기록하고 넘어갈지 판단).
5. **TestFlight 내부 테스터**: 업로드된 빌드는 내부 테스터(최대 100명, 심사 불필요)에게
   즉시 배포 가능하다. 위원장 실기기 스모크(VoiceOver 포함)를 이 단계에서 먼저 진행한다.
6. **TestFlight 외부 테스터**: 외부 테스터(최대 10,000명)에게 배포하려면 첫 빌드는 Apple
   심사(통상 24~48시간)를 거쳐야 한다. §4 심사 대비 항목을 미리 준비해두면 이 단계에서
   반려될 위험이 줄어든다.

## 4. 심사(App Review) 대비

- **Privacy Nutrition Label**: 실제 데이터 흐름 기준으로 최소 항목만 신고한다.
  - 이메일 주소: 인증(OTP 로그인)에만 사용, 계정과 연결됨.
  - 대화 내용(채팅 텍스트·첨부 이미지/PDF): 로그인 상태에서만 서버에 저장(대화 이력
    기능), 비로그인 시 저장하지 않음(§ChatStore.startNewThread 익명 휘발 모드).
  - 위치·마이크·카메라 데이터는 수집하지 않는다(앱이 해당 권한을 아예 요청하지 않음,
    §5 참고). 광고·트래킹 SDK가 없으므로 App Tracking Transparency 프롬프트도 불필요.
- **Accessibility Nutrition Labels**: VoiceOver 지원을 실기기 검증 후에만 선언한다(검증
  전 항목을 임의로 주장하지 않는다. gildongmu spec과 동일 원칙, §5).
- **로그인 필요 기능의 심사용 안내**: 채팅 이력 저장·대화 목록 등은 로그인(OTP) 후에만
  드러난다. OTP는 이메일로 발송되는 1회성 코드라 심사자가 고정 시연 계정으로 로그인하기
  어렵다. App Review 정보의 "Notes" 란에 (a) 로그인 없이도 채팅 핵심 기능(질문·답변·출처
  인용)이 전부 동작한다는 점, (b) 로그인 기능은 대화 이력 저장이라는 부가 기능이라는 점을
  명시하고, 필요하면 로그인 전 과정을 보여주는 짧은 데모 영상을 첨부해 대체한다.
- **AI 생성 콘텐츠 고지**: 채팅 답변은 이미 화면 내 면책 문구(RAG 검색 기반 안내이며
  법적 효력이 없다는 안내)를 포함하고 있다. 심사 노트에도 "AI가 생성한 답변이며 출처를
  함께 표기한다"는 점을 명시한다.
- **연령 등급**: 자체 게시판·사용자 생성 콘텐츠 공개 기능이 없다(채팅은 1:1, 소셜 피드는
  아직 없음, Phase 4 대기). 설문에 실제 기능대로 응답한다.
- **Export Compliance**: 표준 OS 암호화(HTTPS)만 사용하고 자체 암호화를 구현하지 않으므로
  일반적으로 면제 대상이나, 제출 시 App Store Connect 설문으로 최종 확정한다.

## 5. gildongmu 배포 준비 spec과의 차이

`gildongmu`(2026-06-21 진단, `docs/superpowers/specs/2026-06-21-ios-app-distribution-readiness-design.md`)와
webfortd는 출발선 자체가 다르다. gildongmu는 **기존 웹 서비스를 iOS에 재포장할지(Capacitor)
전면 재개발할지(SwiftUI)를 놓고 저울질하는 진단 단계**였고, webfortd는 **이미 SwiftUI
네이티브로 M0~M4를 완주한 배포 준비 단계**다. 이 근본 차이가 아래 항목들로 이어진다.

| 항목 | gildongmu | webfortd |
|------|-----------|----------|
| 아키텍처 결정 | Capacitor(웹 자산 로컬 번들) vs SwiftUI 전면 재개발 중 저울질(권고: Capacitor) | 이미 SwiftUI 네이티브로 확정·구현 완료. 재포장 여부 논쟁 자체가 없음 |
| 예상 소요 | 8~24주(UI/API 배포 경계 분리부터 시작) | 배포 절차(§1~§4)만 남음, 코드 트랙은 이미 완료 |
| 기능 스코프 | 검색·경로·주변정보·음성 STT·다국어 5개·거리 비콘 등 14개 시나리오 | 위키 열람·RAG 채팅·자료실·미디어·계정, 단일 언어(한국어) |
| 필요 권한 | 위치(When In Use)·마이크(STT), Info.plist usage description 필수 | **권한 요청 자체가 없음**. PhotosPicker(PHPickerViewController)·fileImporter 모두 out-of-process API라 Info.plist 권한 문구가 필요 없다 |
| 개인정보 항목 | 정밀 위치·검색어·채팅·음성 등 다수, 외부 vendor(Deepgram·Gemini·Perplexity·지도 API) 다수 | 이메일(인증)·대화 내용(로그인 시)만, 외부 vendor는 Gemini(답변 생성)·Supabase(인증·저장)뿐 |
| CORS/배포 구조 이슈 | 동일 Next 앱에 20개 동적 Route Handler와 정적 번들이 충돌해 UI/API 분리 선행 필요 | 앱이 처음부터 URLSession으로 웹 API(Route Handler)를 직접 호출하는 구조라 이 문제 자체가 없음 |
| 계정 주체 | 개인 가입으로 충분(조직 가입 요구 없음) | 사업 자산이라는 위치 때문에 조직(장교조) 가입 여지가 더 크다(§1). 다만 D-U-N-S 발급 지연 고려 필요 |
| 개인정보처리방침 | 별도 페이지 신설 필요(웹 자체에 없었음) | 페이지는 이미 존재하나 **본문이 placeholder**, 채워 넣는 작업만 남음 |
| 접근성 검증 | 웹 회귀 테스트만 존재, iOS 실기기 VoiceOver 검증 전무 | 시뮬레이터 스모크 축적(M1~M4) + 접근성 헌장 준수 설계, 다만 **실기기 VoiceOver 검증은 동일하게 미완료**(두 프로젝트 공통 잔여 과제) |

공통점: 두 프로젝트 모두 Apple Developer Program 가입(연 99달러) 여부가 하드 스톱이고,
Xcode 26+·iOS 26 SDK 제출 요구사항을 따르며, 실기기 VoiceOver·Dynamic Type 검증을 마치기
전에는 Accessibility Nutrition Label을 임의로 주장하지 않는다는 원칙을 공유한다.
