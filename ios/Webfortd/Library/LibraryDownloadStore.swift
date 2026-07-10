import Foundation
import Observation
import SwiftUI
import WebfortdKit

/// 자료실 PDF 다운로드·캐시 상태 저장소. slug별 상태를 3분리(미캐시·다운로드 중·캐시됨)로 관리하고,
/// Caches/library/<slug>.pdf에 영구 캐시한다(오프라인 재열람). 실패는 미캐시로 되돌아가 재시도 가능.
@MainActor
@Observable
final class LibraryDownloadStore {
    enum State: Equatable {
        case notCached
        case downloading
        case cached(fileURL: URL)
    }

    private(set) var states: [String: State] = [:]
    private var tasks: [String: Task<Void, Never>] = [:]

    private let fileManager: FileManager
    private let session: URLSession
    private let cacheDirectory: URL

    init(fileManager: FileManager = .default, session: URLSession = .shared) {
        self.fileManager = fileManager
        self.session = session
        let caches = fileManager.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        cacheDirectory = caches.appendingPathComponent("library", isDirectory: true)
    }

    /// 캐시 파일 존재 여부로 초기 상태를 1회 복원한다. 뷰의 `.task`(등장 직후)에서 호출할 것.
    /// body 평가 중 @Observable 상태를 쓰면 SwiftUI observation 경고("modifying state during
    /// view update")를 유발하므로 순수 조회인 state(for:)에서는 쓰기를 하지 않는다.
    func restoreCachedStates(slugs: [String]) {
        for slug in slugs where states[slug] == nil {
            let cached = cachedFileURL(slug: slug)
            states[slug] = fileManager.fileExists(atPath: cached.path) ? .cached(fileURL: cached) : .notCached
        }
    }

    /// 화면 표시용 현재 상태 조회(순수 읽기). restoreCachedStates 미실행 상태는 notCached로 취급.
    func state(for slug: String) -> State {
        states[slug] ?? .notCached
    }

    /// 다운로드 시작. 이미 진행 중이면 중복 시작하지 않는다.
    // DeveloperToolsSupport(Xcode Preview 라이브러리)에도 동명 타입이 있어 완전 수식 필요.
    func startDownload(item: WebfortdKit.LibraryItem) {
        guard state(for: item.slug) != .downloading else { return }
        states[item.slug] = .downloading
        let task = Task { [weak self] in
            guard let self else { return }
            await self.performDownload(item: item)
        }
        tasks[item.slug] = task
    }

    /// 다운로드 중단(사용자 명시 취소). Task 취소는 진행 중인 URLSession 다운로드도 함께 취소한다.
    func cancelDownload(slug: String) {
        tasks[slug]?.cancel()
        tasks[slug] = nil
        states[slug] = .notCached
    }

    /// 받은 파일 삭제(캐시 정리 액션). 캐시가 없어도 안전(무시).
    func deleteCached(slug: String) {
        try? fileManager.removeItem(at: cachedFileURL(slug: slug))
        states[slug] = .notCached
    }

    private func performDownload(item: WebfortdKit.LibraryItem) async {
        defer { tasks[item.slug] = nil }
        guard let remoteURL = URL(string: item.downloadUrl) else {
            states[item.slug] = .notCached
            AccessibilityNotification.Announcement("다운로드 실패: \(item.title)").post()
            return
        }
        do {
            try fileManager.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
            let (tempURL, response) = try await session.download(from: remoteURL)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200..<300).contains(httpResponse.statusCode) else {
                throw URLError(.badServerResponse)
            }
            let destination = cachedFileURL(slug: item.slug)
            if fileManager.fileExists(atPath: destination.path) {
                try fileManager.removeItem(at: destination)
            }
            try fileManager.moveItem(at: tempURL, to: destination)

            // 파일 이동 완료 직후 취소되었으면(사용자가 막바지에 중단) 받은 파일을 지우고
            // notCached로 되돌린다. cancelDownload가 이미 같은 상태로 되돌렸을 수도 있어 멱등.
            if Task.isCancelled {
                try? fileManager.removeItem(at: destination)
                states[item.slug] = .notCached
                return
            }
            states[item.slug] = .cached(fileURL: destination)
            AccessibilityNotification.Announcement("다운로드 완료: \(item.title)").post()
        } catch {
            // 사용자가 명시적으로 중단한 경우 실패 알림을 겹쳐 내지 않는다(의도된 취소).
            states[item.slug] = .notCached
            if !Task.isCancelled {
                AccessibilityNotification.Announcement("다운로드 실패: \(item.title)").post()
            }
        }
    }

    private func cachedFileURL(slug: String) -> URL {
        cacheDirectory.appendingPathComponent("\(slug).pdf")
    }
}
