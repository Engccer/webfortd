import Foundation
import Testing
@testable import WebfortdKit

struct CatalogTests {
    let fixtureDir = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()
        .appendingPathComponent("Fixtures/catalog")

    @Test("Library fixture를 디코딩하고 식별 가능해야 한다")
    func testLibraryItemsDecoding() throws {
        let libraryURL = fixtureDir.appendingPathComponent("library.json")
        let items = try CatalogStore.libraryItems(from: libraryURL)

        #expect(items.count == 1)
        let item = items[0]
        #expect(item.slug == "2023-disability-work-support-research")
        #expect(item.title == "장애유형별 장애인교원 근무 지원 방안 최종보고서")
        #expect(item.year == 2023)
        #expect(item.organization == "교육부")
        #expect(item.category == "policy")
        #expect(item.id == item.slug)
    }

    @Test("Media fixture를 디코딩하고 식별 가능해야 한다")
    func testMediaItemsDecoding() throws {
        let mediaURL = fixtureDir.appendingPathComponent("media.json")
        let items = try CatalogStore.mediaItems(from: mediaURL)

        #expect(items.count == 1)
        let item = items[0]
        #expect(item.slug == "2024-staff-p-023-seat-assignment-flow")
        #expect(item.imagePath == "/source-images/2024-support-staff-duty-guide/page-025-render.png")
        #expect(item.sourceAxis == "disability-types")
        #expect(item.id == item.slug)
    }

    @Test("Library 구조체는 Equatable이어야 한다")
    func testLibraryItemEquatable() throws {
        let libraryURL = fixtureDir.appendingPathComponent("library.json")
        let items1 = try CatalogStore.libraryItems(from: libraryURL)
        let items2 = try CatalogStore.libraryItems(from: libraryURL)

        #expect(items1[0] == items2[0])
    }

    @Test("Media 구조체는 Equatable이어야 한다")
    func testMediaItemEquatable() throws {
        let mediaURL = fixtureDir.appendingPathComponent("media.json")
        let items1 = try CatalogStore.mediaItems(from: mediaURL)
        let items2 = try CatalogStore.mediaItems(from: mediaURL)

        #expect(items1[0] == items2[0])
    }
}
