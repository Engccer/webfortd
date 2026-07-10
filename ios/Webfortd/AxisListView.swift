import SwiftUI
import WebfortdKit

struct AxisListView: View {
    let store: KBStore?
    let axis: KBAxis
    var body: some View { Text(axis.rawValue) }
}
