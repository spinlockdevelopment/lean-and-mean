import Foundation

enum CodexAppearance: String {
    case system, light, dark

    static func read() -> CodexAppearance {
        let home = ProcessInfo.processInfo.environment["CODEX_HOME"].map {
            URL(fileURLWithPath: $0, isDirectory: true)
        } ?? FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".codex")
        let config = home.appendingPathComponent("config.toml")
        guard let text = try? String(contentsOf: config, encoding: .utf8) else { return .system }
        return parse(text)
    }

    static func parse(_ config: String) -> CodexAppearance {
        // lean: Codex writes this setting as a scalar in the desktop table.
        let table = #"^\[\s*["']?desktop["']?\s*\]\s*(?:#.*)?$"#
        let assignment = #"^\s*["']?appearanceTheme["']?\s*=\s*["'](system|light|dark)["']\s*(?:#.*)?$"#
        let lines = config.components(separatedBy: .newlines)
        guard let index = lines.firstIndex(where: { $0.range(of: table, options: .regularExpression) != nil }),
              let line = lines.dropFirst(index + 1)
                .prefix(while: { !$0.trimmingCharacters(in: .whitespaces).hasPrefix("[") })
                .first(where: { $0.range(of: assignment, options: .regularExpression) != nil })
        else { return .system }
        let value = line.replacingOccurrences(of: assignment, with: "$1", options: .regularExpression)
        return CodexAppearance(rawValue: value) ?? .system
    }
}
