// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "WebfortdKit",
    defaultLocalization: "ko",
    platforms: [.iOS(.v26), .macOS(.v26)],
    products: [.library(name: "WebfortdKit", targets: ["WebfortdKit"])],
    dependencies: [
        .package(url: "https://github.com/swiftlang/swift-markdown", from: "0.8.0"),
    ],
    targets: [
        .target(
            name: "WebfortdKit",
            dependencies: [.product(name: "Markdown", package: "swift-markdown")],
            resources: [.copy("Resources/KB")]
        ),
        .testTarget(
            name: "WebfortdKitTests",
            dependencies: ["WebfortdKit"],
            resources: [.copy("Fixtures")]
        ),
    ]
)
