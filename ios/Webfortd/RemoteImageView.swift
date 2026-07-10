import SwiftUI

/// 원격 이미지 로더 공용 컴포넌트. 성공 시 이미지, 오프라인·로드 실패 시 alt 텍스트가
/// 정본(멀티미디어 작성 원칙). BlockRenderer(문서 본문 이미지)·MediaView(미디어 목록)가 공유한다.
struct RemoteImageView: View {
    let url: URL?
    let alt: String

    var body: some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case .success(let image):
                image.resizable().scaledToFit()
            default:
                Text(alt.isEmpty ? "이미지" : alt)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .padding(8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.quaternary.opacity(0.4), in: RoundedRectangle(cornerRadius: 8))
            }
        }
        .accessibilityLabel(alt.isEmpty ? "이미지" : alt)
    }
}
