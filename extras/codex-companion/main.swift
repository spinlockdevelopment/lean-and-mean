import AppKit
import SwiftUI

func elapsed(_ seconds: TimeInterval) -> String {
    let minutes = Int(max(0, seconds) / 60)
    if minutes == 0 { return "<1m" }
    if minutes < 60 { return "\(minutes)m" }
    return "\(minutes / 60)h \(minutes % 60)m"
}

struct Band: View {
    @Environment(\.colorScheme) private var colorScheme
    let activity: Activity?
    let project: ProjectStatus?
    let weekly: WeeklyLimit?
    let now: Date
    let window: Int
    let endSession: (() -> Void)?
    let endStatus: String?

    private var dark: Bool { colorScheme == .dark }
    private var green: Color { dark ? Color(red: 0.30, green: 0.73, blue: 0.35)
        : Color(red: 0.16, green: 0.48, blue: 0.23) }
    private var track: Color { Color(white: dark ? 0.19 : 0.87) }

    private func meter(_ title: String, _ value: String, fraction: Double?, color: Color,
                       note: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title).fontWeight(.semibold)
                Spacer()
                Text(value).foregroundStyle(color).monospacedDigit().fontWeight(.semibold)
            }
            if let fraction {
                GeometryReader { geometry in
                    Capsule().fill(track)
                        .overlay(alignment: .leading) {
                            Capsule().fill(color).frame(width: geometry.size.width * fraction)
                        }
                }
                .frame(height: 18)
                .accessibilityHidden(true)
            }
            if let note {
                Text(note).font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    private func percent(_ fraction: Double) -> String {
        fraction.formatted(.percent.precision(.fractionLength(0)))
    }

    private func resetCaption(_ reset: TimeInterval) -> String {
        let hours = max(0, Int((reset - now.timeIntervalSince1970) / 3600))
        return hours >= 24 ? "resets in \(hours / 24)d \(hours % 24)h"
            : hours > 0 ? "resets in \(hours)h" : "resets in <1h"
    }

    private func tasksSection(_ tasks: [SessionTask]) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("Tasks").fontWeight(.semibold)
                Spacer()
                if !tasks.isEmpty {
                    Text("\(tasks.filter { $0.status == "completed" }.count)/\(tasks.count) complete")
                        .foregroundStyle(.secondary)
                }
            }
            if tasks.isEmpty {
                Text("No task plan reported").foregroundStyle(.secondary)
            }
            ForEach(tasks.indices, id: \.self) { index in
                let task = tasks[index]
                let completed = task.status == "completed"
                let active = task.status == "in_progress" || task.status == "inProgress"
                Label(task.step, systemImage: completed ? "checkmark.circle" : active ? "circle.lefthalf.filled" : "circle")
                    .foregroundStyle(completed ? Color.secondary : active ? .blue : .primary)
                    .lineLimit(1)
                    .help(task.step)
                    .accessibilityLabel("\(completed ? "Completed" : active ? "In progress" : "Pending"): \(task.step)")
            }
        }
    }

    var body: some View {
        ViewThatFits(in: .vertical) {
            content
            ScrollView { content }
        }
        .frame(width: 474)
        .frame(maxHeight: 620)
        .background(Color(white: dark ? 0.095 : 0.97))
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(project?.rootName ?? activity?.project ?? "Codex Companion")
                    .font(.system(size: 14, weight: .semibold))
                    .lineLimit(1).truncationMode(.middle)
                    .textSelection(.enabled)
                if let branch = project?.branch {
                    Text("⎇ \(branch)" + (project?.worktree.map { "  ·  worktree \($0)" } ?? ""))
                        .font(.system(.callout, design: .monospaced))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            if let activity {
                meter("Context", activity.context.map(percent) ?? "—",
                      fraction: activity.context, color: activity.context == nil ? .secondary : green)
                let used = weekly.map { $0.window.used_percent / 100 }
                meter("Weekly limit", used.map(percent) ?? "—", fraction: used,
                      color: used == nil ? .secondary : green.opacity(0.65),
                      note: weekly?.window.resets_at.map(resetCaption))
                if activity.requesting {
                    meter("Cache Idle", "BUSY", fraction: 1, color: .blue)
                } else if let request = activity.lastRequest {
                    let idle = max(0, now.timeIntervalSince(request))
                    let fraction = min(1, idle / Double(window * 60))
                    meter("Cache Idle", elapsed(idle), fraction: fraction,
                          color: fraction < 0.5 ? green : fraction < 1 ? .orange : .gray)
                } else {
                    meter("Cache Idle", "—", fraction: nil, color: .secondary)
                }
                if let cached = activity.cached {
                    let total = activity.input.map { " of \($0.formatted())" } ?? ""
                    let written = activity.cacheWritten.flatMap { $0 > 0 ? " · \($0.formatted()) written" : nil } ?? ""
                    Text("Cache size · \(cached.formatted())\(total) input tokens reused\(written)")
                        .font(.caption).foregroundStyle(.secondary)
                }
                tasksSection(activity.tasks ?? [])
                if let next = project?.next, !next.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Next").fontWeight(.semibold)
                        ForEach(next.indices, id: \.self) { index in
                            Text(next[index])
                                .lineLimit(1)
                                .help(next[index])
                        }
                    }
                }
                if let endSession {
                    Button(action: endSession) { Label("End Session", systemImage: "power") }
                        .buttonStyle(.borderedProminent)
                        .tint(Color(white: dark ? 0.9 : 0.2))
                        .foregroundStyle(dark ? .black : .white)
                        .disabled(endStatus == "Queueing…" || endStatus == "End session queued")
                }
                if let endStatus {
                    Text(endStatus).font(.caption).foregroundStyle(.secondary)
                }
            } else {
                Text("Waiting for a Codex hook.").foregroundStyle(.secondary)
            }
        }
        .font(.system(size: 13))
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

@MainActor
final class Companion: NSObject, NSApplicationDelegate {
    private let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    private let panel = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 322, height: 160),
                                styleMask: [.titled, .closable, .nonactivatingPanel],
                                backing: .buffered, defer: false)
    private var host: NSHostingView<Band>?
    private var selected: UUID?
    private var shownChat: UUID?
    private var project: ProjectStatus?
    private var projectUpdated: Date?
    private var appearance: CodexAppearance?
    private var endStatus: [UUID: String] = [:]
    private var window: Int {
        UserDefaults.standard.object(forKey: "EstimateMinutes") as? Int ?? 30
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        panel.title = "Session"
        panel.level = .floating
        panel.hidesOnDeactivate = false
        panel.isReleasedWhenClosed = false
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.center()
        item.button?.target = self
        item.button?.action = #selector(showMenu)
        refresh()
        panel.orderFrontRegardless()
        Timer.scheduledTimer(timeInterval: 1, target: self, selector: #selector(refresh),
                             userInfo: nil, repeats: true)
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        panel.orderFrontRegardless()
        return false
    }

    @objc private func refresh() {
        let now = Date()
        let chats = ActivityStore.recent(now: now)
        let chat = chats.first { $0.0 == selected } ?? chats.first
        var activity = chat?.1
        if let path = activity?.transcriptPath, activity?.turn != nil,
           let tasks = TranscriptStatus.latest(in: path)?.tasks {
            activity?.tasks = tasks
        }
        let mode = CodexAppearance.read()
        if appearance != mode {
            appearance = mode
            switch mode {
            case .system: panel.appearance = nil
            case .light: panel.appearance = NSAppearance(named: .aqua)
            case .dark: panel.appearance = NSAppearance(named: .darkAqua)
            }
        }
        if shownChat != chat?.0 || projectUpdated != activity?.updated {
            shownChat = chat?.0
            projectUpdated = activity?.updated
            project = activity?.cwd.map(ProjectStatus.init)
        }
        if activity?.requesting == true {
            item.button?.title = "Codex BUSY"
        } else if let request = activity?.lastRequest {
            item.button?.title = "Codex \(elapsed(now.timeIntervalSince(request)))"
        } else {
            item.button?.title = "Codex"
        }
        item.button?.toolTip = "Codex Session Status"
        let latestLimit = chats.compactMap { $0.1.weekly }.max { $0.observedAt < $1.observedAt }
        let weekly = latestLimit.flatMap { limit in
            limit.window.resets_at.map { $0 <= now.timeIntervalSince1970 } == true ? nil : limit
        }
        let band = Band(activity: activity, project: project, weekly: weekly, now: now, window: window,
                        endSession: chat.map { id, _ in { [weak self] in self?.queueEndSession(id) } },
                        endStatus: chat.flatMap { endStatus[$0.0] })
        if let host {
            host.rootView = band
        } else {
            let view = NSHostingView(rootView: band)
            panel.contentView = view
            host = view
        }
        if let host {
            let size = host.fittingSize
            if panel.contentLayoutRect.size != size { panel.setContentSize(size) }
        }
    }

    private func queueEndSession(_ id: UUID) {
        let bundled = "/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex"
        let paths = (ProcessInfo.processInfo.environment["PATH"] ?? "").split(separator: ":")
            .map { "\($0)/codex" }
        guard let executable = ([bundled] + paths + ["/opt/homebrew/bin/codex", "/usr/local/bin/codex"])
            .first(where: FileManager.default.isExecutableFile(atPath:)) else {
            endStatus[id] = "Codex CLI unavailable"
            refresh()
            return
        }
        let command = Process()
        command.executableURL = URL(fileURLWithPath: executable)
        command.arguments = ["queue", "--thread", id.uuidString.lowercased(), "--message", "$endsession", "--resume"]
        command.standardOutput = FileHandle.nullDevice
        command.standardError = FileHandle.nullDevice
        command.terminationHandler = { [weak self] process in
            let success = process.terminationStatus == 0
            DispatchQueue.main.async {
                self?.endStatus[id] = success ? "End session queued" : "Could not queue end session"
                self?.refresh()
            }
        }
        do {
            try command.run()
            endStatus[id] = "Queueing…"
        } catch {
            endStatus[id] = "Could not launch Codex CLI"
        }
        refresh()
    }

    @objc private func showMenu() {
        guard let button = item.button else { return }
        let menu = NSMenu()
        func add(_ title: String, _ action: Selector, value: Any? = nil, checked: Bool = false) {
            let entry = menu.addItem(withTitle: title, action: action, keyEquivalent: "")
            entry.target = self
            entry.representedObject = value
            entry.state = checked ? .on : .off
        }
        add(panel.isVisible ? "Hide floating panel" : "Show floating panel", #selector(togglePanel))
        menu.addItem(.separator())
        add("Follow most recent chat", #selector(selectChat(_:)), checked: selected == nil)
        for (id, activity) in ActivityStore.recent(now: Date()).prefix(10) {
            add("\(activity.project) · \(id.uuidString.prefix(8))", #selector(selectChat(_:)),
                value: id, checked: id == selected)
        }
        menu.addItem(.separator())
        for minutes in [10, 30, 60] {
            add("Estimate window · \(minutes)m", #selector(setWindow(_:)), value: minutes, checked: window == minutes)
        }
        menu.addItem(.separator())
        add("Quit Codex Companion", #selector(quit))
        menu.popUp(positioning: nil, at: NSPoint(x: 0, y: button.bounds.minY), in: button)
    }

    @objc private func togglePanel() {
        if panel.isVisible { panel.orderOut(nil) }
        else { panel.orderFrontRegardless() }
    }

    @objc private func selectChat(_ sender: NSMenuItem) {
        selected = sender.representedObject as? UUID
        refresh()
    }

    @objc private func setWindow(_ sender: NSMenuItem) {
        guard let minutes = sender.representedObject as? Int else { return }
        UserDefaults.standard.set(minutes, forKey: "EstimateMinutes")
        refresh()
    }

    @objc private func quit() { NSApp.terminate(nil) }
}

if CommandLine.arguments.dropFirst().first == "--hook" {
    do {
        let input = FileHandle.standardInput.readDataToEndOfFile()
        try ActivityStore.record(JSONDecoder().decode(HookInput.self, from: input))
    } catch {
        // Hook output can reach Codex. Keep payloads and local paths out of diagnostics.
        FileHandle.standardError.write(Data("Codex Companion could not record a hook event.\n".utf8))
    }
    print("{}")
} else {
    MainActor.assumeIsolated {
        let app = NSApplication.shared
        let companion = Companion()
        app.setActivationPolicy(.accessory)
        app.delegate = companion
        withExtendedLifetime(companion) { app.run() }
    }
}
