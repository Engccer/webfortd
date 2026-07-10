import Testing
@testable import WebfortdKit

@Suite struct KBIndexTests {
    @Test func 자리표시_타입이_존재한다() {
        let axis = KBAxis.agreements
        #expect(axis.rawValue == "agreements")
    }
}
