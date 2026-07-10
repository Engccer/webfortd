import SwiftUI
import WebfortdKit

struct DocumentView: View {
    let store: KBStore?
    let slug: String
    var body: some View { Text(slug) }
}
