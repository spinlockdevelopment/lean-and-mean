import Foundation

struct ProjectStatus {
    let root: String
    let branch: String?
    let worktree: String?

    var rootName: String {
        URL(fileURLWithPath: root).lastPathComponent
    }

    init(cwd: String) {
        let files = FileManager.default
        let directory = URL(fileURLWithPath: cwd, isDirectory: true)
        var repo = directory
        if !files.fileExists(atPath: directory.appendingPathComponent("AGENTS.md").path),
           Self.git(in: directory, ["rev-parse", "--verify", "HEAD"]).isEmpty {
            let children = (try? files.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil,
                                                           options: .skipsHiddenFiles)) ?? []
            let checkouts = children.filter {
                files.fileExists(atPath: $0.appendingPathComponent(".git").path)
                    && files.fileExists(atPath: $0.appendingPathComponent("AGENTS.md").path)
            }
            if checkouts.count == 1 { repo = checkouts[0] }
        }

        let locations = Self.git(in: repo, ["rev-parse", "--path-format=absolute", "--show-toplevel", "--git-common-dir"])
        if locations.count == 2 {
            let top = locations[0]
            let common = URL(fileURLWithPath: locations[1])
            root = common.lastPathComponent == ".git" ? common.deletingLastPathComponent().path : top
            branch = Self.git(in: repo, ["symbolic-ref", "--quiet", "--short", "HEAD"]).first ?? "detached"
            worktree = top == root ? nil : URL(fileURLWithPath: top).lastPathComponent
        } else {
            root = cwd
            branch = nil
            worktree = nil
        }
    }

    private static func git(in directory: URL, _ arguments: [String]) -> [String] {
        let git = Process()
        let output = Pipe()
        git.executableURL = URL(fileURLWithPath: "/usr/bin/git")
        git.arguments = ["-C", directory.path] + arguments
        git.standardOutput = output
        git.standardError = FileHandle.nullDevice
        guard (try? git.run()) != nil else { return [] }
        let data = output.fileHandleForReading.readDataToEndOfFile()
        git.waitUntilExit()
        guard git.terminationStatus == 0 else { return [] }
        return String(decoding: data, as: UTF8.self).split(whereSeparator: \.isNewline).map(String.init)
    }

    var next: [String] {
        let file = URL(fileURLWithPath: root).appendingPathComponent("AGENTS.md")
        guard let text = try? String(contentsOf: file, encoding: .utf8) else { return [] }
        let lines = text.components(separatedBy: .newlines)
        let heading = #"^\s*(#{1,6})\s*Next\s*#*\s*$"#
        guard let start = lines.firstIndex(where: { $0.range(of: heading, options: [.regularExpression, .caseInsensitive]) != nil })
        else { return [] }
        let level = lines[start].trimmingCharacters(in: .whitespaces).prefix(while: { $0 == "#" }).count
        var entries: [String] = []
        for line in lines.dropFirst(start + 1) {
            let value = line.trimmingCharacters(in: .whitespaces)
            let hashes = value.prefix(while: { $0 == "#" }).count
            if value.hasPrefix("<!--") || ((1...level).contains(hashes) && value.dropFirst(hashes).first?.isWhitespace == true) {
                break
            }
            if value.isEmpty { continue }
            if !entries.isEmpty, line.first?.isWhitespace == true || line.first?.isLowercase == true {
                entries[entries.count - 1] += " " + value
            } else {
                entries.append(value)
            }
        }
        return entries.map { item in
            let body = item.replacingOccurrences(of: "^[-*]\\s+", with: "", options: .regularExpression)
                .replacingOccurrences(of: "`", with: "")
            if body.range(of: "^P[0-9]\\s", options: .regularExpression) != nil {
                return body.replacingOccurrences(of: "^((P[0-9]))\\s*[—–-]\\s*", with: "$1  ", options: .regularExpression)
            }
            return "• " + body
        }
    }
}
