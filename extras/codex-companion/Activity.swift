import Foundation
import Darwin

enum Hook: String, Codable, CaseIterable {
    case submit = "UserPromptSubmit"
    case before = "PreModelRequest"
    case after = "PostModelRequest"
    case stop = "Stop"
    case interrupt = "Interrupt"
    case compact = "PostCompact"
    case end = "SessionEnd"
}

struct HookInput: Decodable {
    struct Usage: Decodable {
        let input_tokens: Int?
        let cached_input_tokens: Int?
        let cache_write_input_tokens: Int?
    }

    let hook_event_name: Hook
    let session_id: UUID
    let transcript_path: String?
    let turn_id: String?
    let agent_id: String?
    let cwd: String
    let model: String?
    let status: String?
    let token_usage: Usage?
}

struct WeeklyLimit: Codable {
    struct Window: Codable {
        let used_percent: Double
        let window_minutes: Int
        let resets_at: TimeInterval?
    }

    let observedAt: Date
    let window: Window
}

struct SessionTask: Codable {
    let step: String
    let status: String
}

struct TranscriptStatus {
    private struct Entry: Decodable {
        struct Payload: Decodable {
            struct Limits: Decodable {
                let limit_id: String?
                let primary: WeeklyLimit.Window?
                let secondary: WeeklyLimit.Window?
            }
            struct Usage: Decodable {
                struct Tokens: Decodable {
                    let total_tokens: Int
                }
                let last_token_usage: Tokens
                let model_context_window: Int?
            }

            let type: String
            let rate_limits: Limits?
            let info: Usage?
            let plan: [SessionTask]?
            let name: String?
            let arguments: String?
        }

        let timestamp: String
        let payload: Payload
    }

    private struct Plan: Decodable {
        let plan: [SessionTask]
    }

    var weekly: WeeklyLimit?
    var context: Double?
    var tasks: [SessionTask]?

    static func latest(in path: String) -> TranscriptStatus? {
        // lean: Read recent local Codex metadata. Use the App Server if the transcript format changes.
        guard let file = try? FileHandle(forReadingFrom: URL(fileURLWithPath: path)),
              let size = try? file.seekToEnd() else { return nil }
        let start = size > 524_288 ? size - 524_288 : 0
        guard (try? file.seek(toOffset: start)) != nil,
              let tail = try? file.read(upToCount: 524_288) else { return nil }

        let decoder = JSONDecoder()
        let clock = ISO8601DateFormatter()
        clock.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let lines = tail.split(separator: 10).dropFirst(start == 0 ? 0 : 1)
        var result = TranscriptStatus()
        for line in lines.reversed() {
            guard let entry = try? decoder.decode(Entry.self, from: Data(line)) else { continue }
            let payload = entry.payload
            switch payload.type {
            case "token_count":
                if result.context == nil, let info = payload.info,
                   let window = info.model_context_window, window > 0 {
                    result.context = min(1, max(0, Double(info.last_token_usage.total_tokens) / Double(window)))
                }
                if result.weekly == nil, let limits = payload.rate_limits, limits.limit_id == "codex",
                   let observedAt = clock.date(from: entry.timestamp),
                   let window = [limits.primary, limits.secondary].compactMap({ $0 })
                    .first(where: { $0.window_minutes == 10_080 && (0...100).contains($0.used_percent) }) {
                    result.weekly = WeeklyLimit(observedAt: observedAt, window: window)
                }
            case "plan_update":
                if result.tasks == nil { result.tasks = payload.plan }
            case "function_call":
                if result.tasks == nil, payload.name == "update_plan", let arguments = payload.arguments {
                    result.tasks = (try? decoder.decode(Plan.self, from: Data(arguments.utf8)))?.plan
                }
            default: break
            }
            if result.context != nil && result.weekly != nil && result.tasks != nil { break }
        }
        return result
    }
}

struct Activity: Codable {
    var project: String
    var cwd: String?
    var transcriptPath: String?
    var model: String?
    var updated: Date
    var turn: String?
    var requesting = false
    var requestStarted: Date?
    var lastRequest: Date?
    var input: Int?
    var cached: Int?
    var cacheWritten: Int?
    var weekly: WeeklyLimit?
    var context: Double?
    var tasks: [SessionTask]?

    mutating func apply(_ event: HookInput, now: Date) {
        if event.hook_event_name != .submit && event.hook_event_name != .end,
           let turn, let incoming = event.turn_id, turn != incoming { return }
        updated = now
        switch event.hook_event_name {
        case .submit:
            turn = event.turn_id
            requesting = false
            requestStarted = nil
        case .before:
            turn = event.turn_id
            requesting = true
            requestStarted = now
            if let next = event.model, next != model {
                model = next
                clearCacheObservation()
            }
        case .after:
            requesting = false
            if event.status == "completed" {
                lastRequest = requestStarted ?? now
                input = event.token_usage?.input_tokens
                cached = event.token_usage?.cached_input_tokens
                cacheWritten = event.token_usage?.cache_write_input_tokens
                model = event.model ?? model
            }
            requestStarted = nil
        case .compact:
            clearCacheObservation()
        case .stop, .interrupt, .end:
            turn = nil
            requesting = false
            requestStarted = nil
        }
    }

    private mutating func clearCacheObservation() {
        lastRequest = nil
        cached = nil
        cacheWritten = nil
        input = nil
    }
}

enum ActivityStore {
    static let directory = ProcessInfo.processInfo.environment["CODEX_COMPANION_STATE"].map {
        URL(fileURLWithPath: $0, isDirectory: true)
    } ?? FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Application Support/Codex Companion/Activity", isDirectory: true)

    static func record(_ event: HookInput) throws {
        guard event.agent_id == nil else { return }
        let files = FileManager.default
        try files.createDirectory(at: directory, withIntermediateDirectories: true,
                                  attributes: [.posixPermissions: 0o700])
        let lock = open(directory.appendingPathComponent(".lock").path, O_CREAT | O_RDWR | O_NOFOLLOW, 0o600)
        guard lock >= 0 else { throw POSIXError(.EIO) }
        defer { close(lock) }
        guard flock(lock, LOCK_EX) == 0 else { throw POSIXError(.EIO) }

        let now = Date()
        let file = directory.appendingPathComponent(event.session_id.uuidString + ".json")
        let project = URL(fileURLWithPath: event.cwd).lastPathComponent
        var activity = load(file) ?? Activity(project: project, updated: now)
        activity.apply(event, now: now)
        activity.cwd = event.cwd
        activity.transcriptPath = event.transcript_path ?? activity.transcriptPath
        if [.submit, .after, .stop].contains(event.hook_event_name),
           let path = event.transcript_path, let status = TranscriptStatus.latest(in: path) {
            activity.context = status.context ?? activity.context
            activity.tasks = status.tasks ?? activity.tasks
            if let weekly = status.weekly, weekly.observedAt > (activity.weekly?.observedAt ?? .distantPast) {
                activity.weekly = weekly
            }
        }
        try JSONEncoder().encode(activity).write(to: file, options: .atomic)
    }

    static func recent(now: Date) -> [(UUID, Activity)] {
        let files = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
        return files.compactMap { file -> (UUID, Activity)? in
            guard file.pathExtension == "json",
                  let id = UUID(uuidString: file.deletingPathExtension().lastPathComponent),
                  let activity = load(file), now.timeIntervalSince(activity.updated) < 86_400
            else { return nil }
            return (id, activity)
        }.sorted { $0.1.updated > $1.1.updated }
    }

    private static func load(_ file: URL) -> Activity? {
        guard let data = try? Data(contentsOf: file) else { return nil }
        return try? JSONDecoder().decode(Activity.self, from: data)
    }
}
