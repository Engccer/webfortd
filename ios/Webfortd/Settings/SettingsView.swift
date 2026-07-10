import SwiftUI

/// 설정 탭 임시 스텁. 계정·About·버전 정보는 Task 3(TestFlight 준비)에서 교체한다.
struct SettingsView: View {
    var body: some View {
        ContentUnavailableView(
            "준비 중입니다",
            systemImage: "gearshape",
            description: Text("계정·앱 정보 화면은 곧 추가됩니다."))
        .navigationTitle("설정")
    }
}
