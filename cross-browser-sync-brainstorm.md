# Cross-Browser Tab, Tab Group & Bookmark Sync: Feasibility Brainstorm

## Goal

Synchronize open tabs, tab groups, and bookmarks between Safari and Chrome
every 5–15 minutes, across multiple macOS machines and iOS/iPadOS devices.

---

## Part 1: Hard Constraints (The Landscape)

Every approach runs into the same platform walls. Understanding these first
prevents wasted effort.

### macOS — Chrome (the easy side)

| Capability | Support | Mechanism |
|---|---|---|
| Read open tabs | Full | `chrome.tabs.query({})` |
| Write tabs (open/close) | Full | `chrome.tabs.create()` / `chrome.tabs.remove()` |
| Read tab groups | Full | `chrome.tabGroups.query({})` (name, color, tab IDs) |
| Write tab groups | Full | `chrome.tabs.group()` / `chrome.tabGroups.update()` |
| Read bookmarks | Full | `chrome.bookmarks.getTree()` |
| Write bookmarks | Full | `chrome.bookmarks.create()` / `remove()` / `move()` |
| Background timer | Yes | `chrome.alarms` (30-second minimum interval) |
| Native Messaging | Yes | `chrome.runtime.connectNative()` — stdin/stdout JSON, 1 MB limit |
| Distribution | Easy | Chrome Web Store or self-hosted `.crx` |

### macOS — Safari (the hard side)

| Capability | Support | Mechanism |
|---|---|---|
| Read open tabs | Yes | AppleScript: `tell application "Safari" to get URL of tabs of windows` |
| Write tabs (open URLs) | Yes | AppleScript: `tell application "Safari" to open location "url"` |
| Close specific tabs | Clunky | AppleScript: `close tab X of window Y` (index-based, fragile) |
| Read tab groups via API | **NO** | `browser.tabGroups` does not exist in Safari extensions |
| Read tab groups via AppleScript | **NO** | AppleScript has no Tab Groups dictionary |
| Read tab groups via SafariTabs.db | **YES (fragile)** | `~/Library/Containers/Safari/Data/Library/Safari/SafariTabs.db` — SQLite DB, tab groups confirmed present. Requires parsing binary plist BLOBs from the `bookmarks` table (`extra_attributes` and `local_attributes` columns). First 4 bytes of `SessionState` plist are padding that must be stripped. Undocumented, may break across Safari versions. |
| Read tab groups via Accessibility API | **Possible (fragile)** | `AXUIElement` can traverse Safari's UI tree (`AXWindow → AXSplitGroup → AXTabGroup → ...`) to find sidebar elements. Known bugs: FB9724675 reports tab group elements sometimes return incorrect results. Structure changes between Safari versions. Tools: AXorcist (Swift), Hammerspoon. Requires Accessibility permissions. |
| Write tab groups | **NO** | No mechanism exists (API, AppleScript, database, or Accessibility) |
| Read bookmarks via API | **NO** | `browser.bookmarks` not implemented in Safari extensions |
| Read bookmarks via plist | Yes | Parse `~/Library/Safari/Bookmarks.plist` (binary plist → XML) |
| Write bookmarks | **NO** | No writable API. Manual plist editing is dangerous (Safari overwrites on launch) |
| Background timer in extension | **NO** | Safari extensions activate only on user interaction |
| Native Messaging | Yes | Built into Safari Web Extension framework; communicates with containing macOS app |
| Distribution | Heavier | Must be inside a native macOS app. Mac App Store ($99/yr) or Developer ID notarization |

### iOS/iPadOS — Safari

| Capability | Support | Mechanism |
|---|---|---|
| Read tabs (Shortcuts) | **Partial** | iOS Shortcuts "Find Tabs" action (iOS 16+). Pulls tabs from active tab group — title and URL. Filter options limited; may only see the active group, not all groups. |
| Read tabs (Extension) | **Partial** | `browser.tabs.query()` returns tab objects, BUT `url`/`title`/`favIconUrl` are empty unless user enables "Always Allow on Every Website" per-site. Major usability friction. |
| Read tab groups (Shortcuts) | **Partial** | "Find Tab Groups" (iOS 16+). Lists groups by name. Cannot enumerate which tabs belong to which group. |
| Create/switch tab groups | **YES** | Shortcuts "Create Tab Group" and "Open Tab Group" work by name. Can bind to Focus modes. |
| Write tabs (open URL) | Yes | Shortcuts "Open URLs" or URL schemes |
| Read bookmarks | Yes | Shortcuts "Find Bookmarks" (iOS 16+) |
| Write bookmarks | Partial | "Open Bookmarks" — limited, no create/delete |
| Background sync | **NO** | Extensions: non-persistent background, suspended when Safari inactive. No Background Sync API. Shortcuts: time-of-day or location triggers only, NOT configurable interval. |
| Extension event listeners | Limited | `onCreated`/`onRemoved`/`onUpdated` work while Safari is foregrounded, stop when backgrounded. `onAttached`/`onDetached` broken since Safari 18.4. No `browser.tabGroups` API. |

### iOS/iPadOS — Chrome

| Capability | Support | Mechanism |
|---|---|---|
| Read open tabs | **NO** | Chrome on iOS uses WebKit (Apple policy). No extension API at all. No Shortcuts action to read Chrome tabs. |
| Write (open URLs) | Yes | iOS Shortcuts "Open URLs in Chrome" action. Can also use `googlechrome://` URL scheme. |
| Read bookmarks | **NO** | No API, no Shortcuts action |
| Read tab groups | **NO** | No API, no Shortcuts action |
| Extension support | **NONE** | Chrome on iOS has zero extension capabilities |

### Summary: The Honest Capability Matrix

| Data | macOS Chrome | macOS Safari | iOS Safari | iOS Chrome |
|---|---|---|---|---|
| Read tabs | Full | Yes (AppleScript) | Partial (Shortcuts: active group only; Extension: needs per-site permission) | **NO** |
| Write tabs | Full | Yes (AppleScript: open/close) | Yes (open URLs) | Open URL only |
| Read tab groups | Full | Fragile (SafariTabs.db parsing or Accessibility API) | Partial (Shortcuts: lists names, can't enumerate members) | **NO** |
| Write tab groups | Full | **NO** | Create/switch by name only (Shortcuts) | **NO** |
| Read bookmarks | Full | Yes (plist parse) | Yes (Shortcuts) | **NO** |
| Write bookmarks | Full | **NO** | Partial | Open URL only |
| Auto background sync | Yes (chrome.alarms, 30s min) | **NO** (needs native app timer) | **NO** (Shortcuts: time-of-day triggers only) | **NO** |

**The fundamental asymmetry:** You can read from Safari (with effort) and write
fully to Chrome, but you cannot write tab groups to Safari, and you cannot read
anything from Chrome on iOS.

**Additional macOS Safari detail — SafariTabs.db:**
- Located at `~/Library/Containers/Safari/Data/Library/Safari/SafariTabs.db`
- Tab groups are encoded via parent-child relationships in the `bookmarks` table
  (the `parent` column references another row's `id`)
- BLOB columns `extra_attributes` and `local_attributes` contain binary plists
  (with 4-byte padding on `SessionState` that must be stripped before parsing)
- **Requires Full Disk Access** permission for your app/terminal
- **Safari should ideally be closed** when reading (WAL mode, Safari holds locks)
- Schema is completely undocumented and changes without notice across versions
- CloudTabs.db (same directory) contains iCloud-synced tab data from other devices

**Additional macOS Safari detail — Accessibility API:**
- Navigate: `AXWindow → AXSplitGroup → AXTabGroup → AXGroup → AXScrollArea → AXOutline → AXOutlineRow`
- Requires sidebar to be open/visible
- Known bug FB9724675: tab group elements sometimes return incorrect results
- Requires Accessibility permissions (non-sandboxed, incompatible with App Store)
- Tools: [AXorcist](https://github.com/steipete/AXorcist) (Swift),
  [Hammerspoon](https://github.com/asmagill/hs._asm.axuielement) (Lua)

---

## Part 2: Architectural Options

### Option A: Native macOS App + Chrome Extension + AppleScript + SafariTabs.db

```
┌──────────────────────┐           ┌──────────────────────┐
│   Chrome Extension   │           │   Safari             │
│   (MV3, TypeScript)  │           │   (no extension)     │
│                      │           │                      │
│  tabs, tabGroups,    │           │                      │
│  bookmarks APIs      │           │                      │
└──────────┬───────────┘           └──────────────────────┘
           │ Native Messaging                │  │  │
           │ (stdin/stdout JSON)             │  │  │
           ▼                                 │  │  │
┌──────────────────────────────────────────┐ │  │  │
│        Native macOS App (Swift)          │ │  │  │
│                                          │ │  │  │
│  ┌─ AppleScript ─────────────────────────┼─┘  │  │
│  │  (read/write tabs)                    │    │  │
│  │                                       │    │  │
│  ├─ SafariTabs.db parser ────────────────┼────┘  │
│  │  (read tab groups — fragile)          │       │
│  │                                       │       │
│  ├─ Bookmarks.plist parser ──────────────┼───────┘
│  │  (read bookmarks)                     │
│  │                                       │
│  ├─ Timer (every 5-15 min)               │
│  │                                       │
│  └─ CloudKit / Firebase (optional)───────┼──▶ Cloud
│                                          │
│  Local state: SQLite                     │
└──────────────────────────────────────────┘
```

**How it works:**
- Native macOS app drives everything on a timer
- Chrome side: full read/write via extension + Native Messaging
- Safari side: reads tabs via AppleScript, reads tab groups via SafariTabs.db
  parsing, reads bookmarks via Bookmarks.plist parsing. Writes tabs via
  AppleScript (open URL / close tab)
- No Safari extension needed (simplifies distribution enormously)
- Cloud backend optional for multi-device sync

**Tab Groups strategy:**
- READ Chrome tab groups via `chrome.tabGroups` API (name, color, member tabs)
- READ Safari tab groups by parsing SafariTabs.db (fragile, undocumented)
- WRITE tab groups to Chrome (full support)
- CANNOT write tab groups to Safari — instead, open the correct tabs and let
  user manually assign them to groups, OR show group info in the native app's UI

**Pros:**
- No Safari extension = no Mac App Store review for the extension
- AppleScript is reliable for basic tab read/write
- SafariTabs.db gives the only feasible path to reading Safari tab groups on macOS
- Native app can use `launchd` or Swift `Timer` for automatic periodic sync
- Can be distributed as a notarized `.dmg` or Homebrew formula

**Cons:**
- SafariTabs.db parsing is reverse-engineered and may break with Safari updates
- Cannot write tab groups to Safari (fundamental limitation)
- Requires Swift/Xcode development
- AppleScript is slow for many tabs (~1-3 seconds for 100+ tabs)

**Feasibility: HIGH overall. Tab group READ is fragile but possible. Tab group WRITE to Safari is impossible.**

---

### Option B: Local WebSocket Server (Node.js/Python) + Chrome Extension + AppleScript

```
Chrome Extension ──WebSocket──▶ Local Server (localhost:PORT) ◀── AppleScript (Safari)
                                       │
                                 Local state store
```

**How it works:**
- Same as Option A but replaces the native Swift app with a Node.js or Python
  server process
- Chrome extension connects via WebSocket from its service worker
- Server runs AppleScript via `child_process.exec('osascript ...')`
- SafariTabs.db parsing done in Node.js/Python (both have SQLite + plist libs)

**Pros:**
- Faster to prototype (Node.js/Python vs. Swift)
- Familiar web-dev tooling
- Can still do everything Option A does
- Installable via `npm` or `pip` + a LaunchAgent plist

**Cons:**
- Still needs a persistent background process (LaunchAgent)
- Node.js/Python runtime must be installed
- Slightly less "native" feel
- Safari extension is still not needed (AppleScript handles Safari side)

**Feasibility: HIGH — best option for rapid prototyping.**

---

### Option C: Cloud-First with Extensions in Both Browsers

```
Safari Web Extension ──HTTPS──▶ Cloud Backend ◀──HTTPS── Chrome Extension
     (macOS only)               (Firebase /           (macOS, could also
                                 Supabase)             serve desktop)
```

**How it works:**
- Both browser extensions push tab state to a cloud database
- Cloud handles storage, versioning, conflict resolution
- Chrome extension syncs on a timer; Safari extension syncs on user click
  (no background timer in Safari)

**Pros:**
- Multi-device sync built in from day one
- No local server process to manage
- Firebase Firestore has built-in offline support + real-time sync

**Cons:**
- Safari extension requires native macOS app wrapper + App Store or notarization
- Safari extension STILL can't read tab groups or bookmarks (API gaps remain)
- Safari sync is not automatic (no background timer) — user must click extension
- Privacy: tab URLs sent to cloud
- Network dependency

**Feasibility: MEDIUM — the Safari extension is limited enough that you'll still
need AppleScript/DB parsing on the native side, which defeats the "extension only"
simplicity.**

---

### Option D: iOS/iPadOS Integration via Shortcuts Automations

This is a supplementary architecture for mobile devices, layered on top of
Options A or B for macOS.

```
┌─────────────────────────────────────┐
│  iOS/iPadOS Device                  │
│                                     │
│  Shortcuts Automation               │
│  ├─ "Find Tabs" (Safari)           │
│  ├─ "Find Tab Groups" (Safari)     │
│  ├─ "Find Bookmarks" (Safari)      │
│  │                                  │
│  ├─ HTTP POST to cloud backend ────┼──▶ Cloud (Firebase/Supabase/self-hosted)
│  │   (upload Safari tab state)     │
│  │                                  │
│  ├─ HTTP GET from cloud backend ◀──┼─── Cloud
│  │   (download desired tab state)  │
│  │                                  │
│  ├─ "Open URLs" (Safari)           │
│  └─ "Open URLs in Chrome"          │
│                                     │
│  Trigger: Time of Day / Manual     │
└─────────────────────────────────────┘
```

**How it works:**
- An iOS Shortcut uses "Find Tabs" to get tabs from the active Safari tab group
  and "Find Tab Groups" to list group names
- Posts this state to a cloud backend via "Get Contents of URL" (HTTP POST)
- Fetches the desired state from the cloud (HTTP GET)
- Opens missing URLs in Safari (or Chrome) using "Open URLs"
- Can create/switch tab groups by name using "Create Tab Group" / "Open Tab Group"
- Trigger: time-of-day, location arrival, app open, or manual — but NOT on a
  configurable interval like "every 15 minutes"

**Chrome on iOS limitation:**
- You CANNOT read Chrome's open tabs on iOS. Period. Chrome exposes no
  Shortcuts actions for reading tabs and no extension API.
- You CAN open URLs in Chrome via `googlechrome://` URL scheme or Shortcuts
- This means iOS sync is one-directional for Chrome: push tabs TO Chrome only

**Shortcuts capability nuances:**
- "Find Tabs" reads tabs from the **active** tab group only (not all groups)
- "Find Tab Groups" lists group **names** but cannot enumerate which tabs
  belong to each group
- To read all tabs across all groups, you'd need to: list groups → switch to
  each group → read tabs → repeat. This is slow and disruptive to the user.
- "Get Current Tab from Safari" (legacy Automator action) only returns the
  frontmost tab and doesn't work with Tab Groups

**Pros:**
- No iOS app development needed — pure Shortcuts
- Can read Safari tab names, URLs, and group names
- Can create and switch tab groups
- Free, no App Store review

**Cons:**
- Cannot read all tabs across all groups without switching between them
- Chrome on iOS is a black box (write-only, no read)
- No true periodic timer (time-of-day triggers only, not "every 15 min")
- Shortcuts automations can be flaky and require confirmation for some actions
- No background execution — automations run in foreground
- Limited error handling in Shortcuts

**Feasibility: MEDIUM — excellent for Safari-side reads, but Chrome on iOS is a dead end for reading.**

---

### Option E (Recommended): Hybrid Multi-Platform Architecture

Combines the strongest elements of A, B, and D:

```
                    ┌──────────────────────────────────────────┐
                    │          Cloud Backend                    │
                    │  (Firebase Firestore / self-hosted)       │
                    │  ┌─────────────────────────────────┐     │
                    │  │  Canonical state:                │     │
                    │  │  - tabs[] (url, title, group)    │     │
                    │  │  - tabGroups[] (name, color)     │     │
                    │  │  - bookmarks[] (url, title, dir) │     │
                    │  │  - per-device metadata           │     │
                    │  └─────────────────────────────────┘     │
                    └───────┬──────────┬──────────┬────────────┘
                            │          │          │
              ┌─────────────┘          │          └─────────────┐
              ▼                        ▼                        ▼
┌──────────────────────┐  ┌─────────────────────┐  ┌──────────────────────┐
│  macOS Device        │  │  macOS Device 2      │  │  iOS/iPadOS Device   │
│                      │  │  (same architecture) │  │                      │
│  Native App (Swift   │  │                      │  │  Shortcuts           │
│    or Node.js)       │  │                      │  │  Automation:         │
│  ├─ Chrome Ext ◀─NM  │  │                      │  │  ├─ Find Tabs        │
│  ├─ AppleScript      │  │                      │  │  ├─ Find Tab Groups  │
│  ├─ SafariTabs.db    │  │                      │  │  ├─ HTTP POST → Cloud│
│  ├─ Bookmarks.plist  │  │                      │  │  ├─ HTTP GET ← Cloud │
│  └─ Timer (5-15 min) │  │                      │  │  └─ Open URLs        │
└──────────────────────┘  └─────────────────────┘  └──────────────────────┘
```

**Sync flow (macOS, every 5–15 min):**
1. Read Chrome tabs + tab groups + bookmarks via extension
2. Read Safari tabs via AppleScript
3. Read Safari tab groups from SafariTabs.db (best-effort, fragile)
4. Read Safari bookmarks from Bookmarks.plist
5. Merge local state with cloud canonical state (last-write-wins per URL,
   merge for tab groups)
6. Push merged state to cloud
7. Apply changes: open missing tabs in each browser, create tab groups in
   Chrome, open missing tabs in Safari via AppleScript
8. Tab groups in Safari: show notification or menu bar hint with suggested
   group assignments (user must group manually)

**Sync flow (iOS, triggered by Shortcuts automation):**
1. Run Shortcut (triggered by time-of-day, app open, or manually)
2. "Find Tabs" + "Find Tab Groups" to read Safari state
3. HTTP POST Safari state to cloud
4. HTTP GET desired state from cloud
5. "Open URLs" to open missing tabs in Safari
6. Optionally "Open URLs in Chrome" for Chrome-specific tabs
7. Chrome tabs on iOS cannot be read — they are managed via cloud state pushed
   from macOS Chrome

---

## Part 3: What Tab Group Sync Actually Looks Like

Since tab groups are your critical feature, here's an honest breakdown:

### Best case (what's achievable)

| Direction | macOS | iOS |
|---|---|---|
| Chrome → Cloud | Full (name, color, member tabs) | N/A (Chrome iOS can't be read) |
| Cloud → Chrome | Full (create groups, assign tabs) | N/A (Chrome iOS has no extension API) |
| Safari → Cloud | Fragile read via SafariTabs.db | Partial: Shortcuts lists group names but can't enumerate members per group without switching groups (disruptive). Extension can read tabs with per-site permission friction. |
| Cloud → Safari | **Cannot create tab groups.** Can only open the tabs and show the user which group they belong to. | Can create/switch tab groups by name (Shortcuts) and open URLs, but cannot assign specific tabs to specific groups programmatically. |

**iOS Safari alternative: Safari Web Extension**
- A Safari Web Extension on iOS can use `browser.tabs.query()` to get all tabs
  (with `url`/`title` only if user has granted "Always Allow on Every Website")
- Tab event listeners (`onCreated`, `onRemoved`, `onUpdated`) fire while Safari
  is in the foreground — can capture changes in real time
- Syncs to cloud via `fetch()` from the background script
- **Cannot run periodically** — only reacts to events or user opening the popup
- This is more reliable than Shortcuts for tab reading but adds the complexity
  of building and distributing a Safari Web Extension (requires native iOS app wrapper)

### The "virtual tab groups" workaround

Since you can't write tab groups to Safari, consider:
- The native app / Shortcuts maintains group definitions in the cloud
- When syncing TO Safari, it opens the tabs and presents a notification:
  "5 tabs from group 'Work Research' were opened in Safari. Assign them to a
  Tab Group manually if desired."
- Over time, if Apple adds a Tab Groups API (requested since 2021), the app
  can adopt it immediately

### Alternative: manage groups entirely outside browsers

- Build tab group management into the native app's UI (menu bar app with groups)
- The app owns the group definitions; browsers just have flat tabs
- Clicking a group in the app opens those tabs in the target browser
- This sidesteps the Safari Tab Groups limitation entirely but loses native
  browser Tab Group UI integration

---

## Part 4: Conflict Resolution Strategy

For a 5–15 minute sync interval, conflicts will be rare but possible.

**Recommended approach: URL-based merge with group awareness**

1. Each device pushes a snapshot: `{ tabs: [{url, title, group?, browser}], timestamp }`
2. Cloud maintains the canonical set as a **union** of all device snapshots
3. Merging rules:
   - **New tab** (URL not in canonical set): Add it
   - **Closed tab** (URL in canonical set but not in latest snapshot from the
     device that had it): Mark as "closed by device X". Remove from canonical
     set after all devices have synced at least once since the close
   - **Tab group assignment**: Last-write-wins per URL. If Chrome says tab X is
     in "Work" and Safari says it's in "Research", the most recent assignment wins
   - **Bookmarks**: Merge by URL. If both sides add the same URL, deduplicate.
     Folder structure follows Chrome (since Safari bookmarks can't be written)
4. Deduplication: Normalize URLs before comparing (strip trailing slashes,
   normalize `http` vs `https` if desired, ignore fragments)

---

## Part 5: Technology Stack Recommendation

| Component | Recommendation | Rationale |
|---|---|---|
| **macOS sync app** | Swift + SwiftUI (menu bar app) | Native AppleScript bridge (`NSAppleScript`), SQLite access, LaunchAgent integration, notarization. Alternatively, Node.js for faster prototyping. |
| **Chrome extension** | Manifest V3 + TypeScript | Full API access. Service worker for background sync. Native Messaging for local app communication. |
| **Safari extension** | Skip it — use AppleScript + DB parsing | A Safari extension adds App Store complexity while offering less than AppleScript. Only reconsider if Apple adds Tab Groups to the extension API. |
| **Cloud backend** | Firebase Firestore | Real-time sync, offline support, generous free tier (1 GB storage, 50K reads/day). CloudKit is an alternative if you want Apple-ecosystem-only. |
| **iOS sync** | Shortcuts automation | No app to build. "Find Tabs", "Find Tab Groups", HTTP POST/GET to cloud. Trigger on time-of-day or manual. |
| **Local state** | SQLite | Both Swift and Node.js have excellent SQLite libraries. Stores last-known state for diffing. |

---

## Part 6: Key Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| SafariTabs.db schema changes with Safari update | HIGH | Version-detect Safari, maintain parser per known schema, fall back to AppleScript-only (loses tab groups) |
| Apple adds SIP/TCC protection to SafariTabs.db | HIGH | App may need Full Disk Access permission. Monitor macOS betas. Accessibility API is a fallback (also fragile). |
| Chrome MV3 service worker killed after 5 min idle | MEDIUM | Use `chrome.alarms` to wake the service worker. Alarms persist across restarts. |
| Shortcuts automation on iOS is unreliable | MEDIUM | Add a manual "Sync Now" button in the Shortcut. Use Shortcuts widget for quick access. |
| Chrome on iOS can never be read | PERMANENT | Accept one-way sync for Chrome iOS. Tabs opened in Chrome iOS must be manually shared (share sheet → Shortcut or native app) to enter the sync system. Consider building a Share Extension so users can share from Chrome → your app. |
| Safari Web Extension iOS per-site permissions | HIGH | User must enable "Always Allow on Every Website" for your extension to read tab URLs. Without it, `browser.tabs.query()` returns empty `url`/`title` fields. This is a UX hurdle at first use. |
| iOS Safari extension suspended in background | HIGH | Extension cannot run when Safari is not in foreground. Sync only happens on user interaction or tab events while foregrounded. Combine with Shortcuts time-of-day automation for periodic catch-up. |
| AppleScript performance degrades with many tabs | LOW | Batch reads, cache results, only diff against previous state |
| Firebase costs at scale | LOW | Free tier handles personal use easily. Self-host (e.g., Supabase on a VPS) if needed. |

---

## Part 7: Existing Tools Worth Evaluating

Before building from scratch, evaluate these:

| Tool | What it does | Safari support | Tab Groups | Verdict |
|---|---|---|---|---|
| **xBrowserSync** | Sync bookmarks across browsers | **No Safari** | No | Not useful |
| **Floccus** | Sync bookmarks (WebDAV, Git, Nextcloud) | **No Safari** | No | Not useful |
| **Raindrop.io** | Bookmark manager | Yes (extension) | No | Useful for bookmarks only, not tabs |
| **Tab Session Manager** | Save/restore tab sessions | **No Safari** | No | Chrome-only, no cross-browser |
| **iCloud Bookmarks** | Sync Safari bookmarks to Chrome | macOS Chrome only | No | Buggy, bookmarks only |
| **Safari iCloud Tabs** | Sync tabs across Apple devices | Safari only | Safari Tab Groups sync | Works for Safari↔Safari, not Chrome |

**None of these solve the full problem.** The closest is a combination of
iCloud Tabs (Safari↔Safari) + a custom sync layer (Safari↔Chrome).

---

## Part 8: Recommended Development Phases

### Phase 1 — Proof of Concept (macOS only, tabs only)
- Build a Node.js CLI that reads Chrome tabs (via a minimal Chrome extension +
  Native Messaging) and Safari tabs (via AppleScript)
- Prints a unified tab list to the console
- Estimated effort: a few days
- **Validates:** Native Messaging, AppleScript reliability, tab state diffing

### Phase 2 — Bidirectional Tab Sync (macOS only)
- Add write capability: open missing tabs in each browser
- Add a timer (run every 5–15 min via `setInterval` or `launchd`)
- Add local SQLite state to track "known" tabs and detect opens/closes
- **Validates:** Sync logic, conflict handling, performance with many tabs

### Phase 3 — Tab Groups (macOS only)
- Add SafariTabs.db parser for reading Safari tab groups
- Add Chrome Tab Groups read/write
- Display group mappings in terminal or simple menu bar UI
- **Validates:** SafariTabs.db stability, group sync UX

### Phase 4 — Cloud Sync (multi-device macOS)
- Add Firebase Firestore backend
- Each macOS device pushes/pulls state
- Merge logic in the cloud or in the native app
- **Validates:** Multi-device conflict resolution, latency

### Phase 5 — iOS Integration
- **Option 5a (Shortcuts-only, simpler):** Build an iOS Shortcut that uses
  "Find Tabs" + "Find Tab Groups" to read Safari state, HTTP POST to Firebase,
  HTTP GET desired state, and "Open URLs" to sync. Trigger via time-of-day
  automation. Limitation: only reads active tab group; group member enumeration
  requires switching groups.
- **Option 5b (Extension + native app, more capable):** Build a Safari Web
  Extension for iOS (inside a native iOS app) that uses `browser.tabs.query()`
  and tab event listeners. Syncs to Firebase on tab events (while foregrounded)
  and on popup open. Add a Share Extension for Chrome iOS (user shares pages
  from Chrome to your app). More reliable but significantly more development.
- Set up time-of-day Shortcuts automation as a fallback periodic sync
- **Validates:** iOS sync reliability, per-site permission UX, Shortcuts triggers

### Phase 6 — Polish
- Swift menu bar app (replace Node.js CLI)
- Notification system for sync events
- Settings UI (sync interval, which browsers, which tab groups to sync)
- Error handling, logging, crash recovery

---

## Part 9: The Hardest Honest Answer

**Can you sync tab groups bidirectionally between Safari and Chrome?**

Not fully. Here's what's actually possible:

- Chrome tab groups: full read/write (excellent)
- Safari tab groups on macOS: read-only via reverse-engineered database (fragile)
- Safari tab groups on iOS: read-only via Shortcuts (reliable)
- Writing tab groups to Safari: **impossible on any platform**

The practical outcome is:
- Tab groups created in Chrome propagate to all Chrome instances (via your sync)
  and are visible in your native app — but appear in Safari as flat tabs with a
  notification about which group they belong to
- Tab groups created in Safari can be read (fragily on macOS, reliably on iOS)
  and recreated in Chrome as proper tab groups
- Safari is always the "less capable" side of the sync

If tab group creation in Safari is truly non-negotiable, the only path forward
is to monitor Apple's APIs and adopt them immediately when (if) they become
available. In the meantime, the "virtual groups managed by the native app"
approach gives the closest user experience.
