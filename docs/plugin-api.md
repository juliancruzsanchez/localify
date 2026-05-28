# Localify Plugin Developer Guide

Localify supports first-party and third-party plugins that can add new audio sources, react to library and player events, expose custom UI, and define arbitrary IPC commands callable from the frontend.

---

## Table of Contents

1. [Overview and philosophy](#overview-and-philosophy)
2. [Plugin directory structure](#plugin-directory-structure)
3. [plugin.json reference](#pluginjson-reference)
4. [Capabilities reference](#capabilities-reference)
5. [Permissions reference](#permissions-reference)
6. [Backend subprocess protocol](#backend-subprocess-protocol)
7. [Frontend module format](#frontend-module-format)
8. [UI slot reference](#ui-slot-reference)
9. [Plugin settings](#plugin-settings)
10. [IPC commands reference](#ipc-commands-reference)
11. [Installation](#installation)
12. [Testing plugins](#testing-plugins)
13. [Example: Hello World (frontend-only)](#example-hello-world-frontend-only)
14. [Example: yt-dlp audio source (Python)](#example-yt-dlp-audio-source-python)

---

## Overview and philosophy

A Localify plugin is a directory on disk. It always contains a `plugin.json` manifest, and optionally:

- A **backend subprocess** — any executable (Python, Node, Go, Rust, shell, …) that speaks JSON-RPC 2.0 over stdin/stdout.
- A **frontend JS module** — a bundled ES module loaded by the renderer at startup.

Plugins are kept intentionally simple: the host communicates with the subprocess over pipes, and the subprocess communicates with the UI through Tauri IPC. There is no plugin SDK to install; the protocol is plain JSON.

**Design principles:**

- A plugin that crashes or fails to load does not crash Localify — errors are logged and the plugin is skipped.
- Capabilities are declared up-front in `plugin.json` so the host knows which interfaces to wire without probing the process.
- Settings are persisted in the app's SQLite database, keyed by plugin ID.
- Plugin IDs use reverse-DNS notation (`com.example.my-plugin`) to avoid collisions.

---

## Plugin directory structure

```
com.example.my-plugin/
├── plugin.json          # required — manifest
├── bin/
│   ├── my-plugin-macos  # backend executable (platform-specific)
│   └── my-plugin-linux
└── dist/
    └── index.js         # frontend ES module (optional)
```

The directory name does not have to match the plugin ID, but it is conventional to use the ID as the directory name so installed plugins are easy to identify.

---

## plugin.json reference

```json
{
  "id": "com.example.my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "api_version": "1",
  "description": "A brief human-readable description.",
  "capabilities": ["ui_components"],
  "backend": { "kind": "none" },
  "frontend": {
    "entry": "dist/index.js",
    "styles": "dist/index.css"
  },
  "permissions": {
    "network": false,
    "filesystem": false,
    "exec_subprocess": false,
    "read_library_db": false,
    "write_library_db": false,
    "player_control": false,
    "player_observe": false
  },
  "settings_schema": {
    "type": "object",
    "properties": {
      "api_key": { "type": "string", "title": "API Key" }
    }
  }
}
```

### Field descriptions

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | yes | Reverse-DNS unique identifier. Must contain at least one `.`. |
| `name` | `string` | yes | Human-readable display name. |
| `version` | `string` | yes | Semver string shown in the Plugins UI. |
| `api_version` | `string` | yes | Must be `"1"`. The loader rejects any other value. |
| `description` | `string` | no | Optional description shown in the Plugins UI. |
| `capabilities` | `string[]` | yes (can be `[]`) | List of capability tokens — see Capabilities reference. |
| `backend` | object | yes | Backend configuration. |
| `backend.kind` | `"subprocess"` \| `"none"` | yes | `"none"` for frontend-only plugins. |
| `backend.executable` | object | if kind=subprocess | Per-platform relative paths to the binary (from the plugin directory). |
| `backend.executable.macos` | `string` | no | Relative path on macOS. |
| `backend.executable.windows` | `string` | no | Relative path on Windows. |
| `backend.executable.linux` | `string` | no | Relative path on Linux. |
| `backend.args` | `string[]` | no | Extra CLI arguments passed to the executable. |
| `backend.env` | `object` | no | Extra environment variables set for the process. |
| `backend.startup_timeout_ms` | `number` | no | Not currently enforced by the loader but reserved for future use. |
| `frontend` | object | no | Omit entirely if the plugin has no frontend. |
| `frontend.entry` | `string` | if frontend | Relative path to the bundled ES module. |
| `frontend.styles` | `string` | no | Relative path to an optional CSS file. |
| `permissions` | object | yes | All fields default to `false`. |
| `settings_schema` | JSON Schema object | no | Shown in the Settings UI to generate a settings form. Not validated by the host at runtime. |

---

## Capabilities reference

Capabilities are declared in the `capabilities` array. The loader uses them to determine which trait interfaces to activate for the subprocess.

| Token | What it enables |
|---|---|
| `ui_components` | The frontend module is loaded. The plugin may register sidebar items, settings sections, context menu items, now-playing actions, and custom routes. |
| `audio_source` | The `audio_source.*` JSON-RPC methods are wired. The plugin appears as a browsable/searchable audio source. Requires a subprocess backend. |
| `library_hooks` | The `library.*` notifications are sent to the subprocess whenever the library scanner runs. Requires a subprocess backend. |
| `player_hooks` | The `player.*` notifications are sent to the subprocess on every player state change. Requires a subprocess backend. |
| `ipc_commands` | The `plugin_dispatch` IPC command is routed to the subprocess. The subprocess receives any method name not recognised by the host. Requires a subprocess backend. |

A plugin can declare any combination of capabilities. A pure-backend plugin with no UI omits `ui_components`. A pure-UI plugin with no subprocess sets `"backend": {"kind": "none"}` and omits backend capabilities.

---

## Permissions reference

Permissions are declared for informational purposes and future sandboxing. All default to `false`.

| Permission | Meaning |
|---|---|
| `network` | Plugin makes outbound network requests. |
| `filesystem` | Plugin reads or writes arbitrary files. |
| `exec_subprocess` | Plugin spawns its own child processes. |
| `read_library_db` | Plugin queries the Localify SQLite library. |
| `write_library_db` | Plugin modifies the Localify SQLite library. |
| `player_control` | Plugin sends playback commands (play, pause, seek). |
| `player_observe` | Plugin receives player state notifications. |

---

## Backend subprocess protocol

The host spawns the plugin executable with:
- stdin connected to a pipe — the host writes requests here.
- stdout connected to a pipe — the plugin writes responses here.
- stderr inherited — goes to Localify's log output.

All messages are **newline-delimited JSON-RPC 2.0**. Each message is one line of JSON followed by a newline character (`\n`). Do not emit extra whitespace or multi-line JSON.

### Blocking calls

The host sends a request and waits for exactly one response on the same connection before sending the next request. Requests carry a numeric `id`.

**Request from host:**
```json
{"jsonrpc": "2.0", "id": 1, "method": "init", "params": {"config": {}}}
```

**Success response from plugin:**
```json
{"jsonrpc": "2.0", "id": 1, "result": {"ok": true}}
```

**Error response from plugin:**
```json
{"jsonrpc": "2.0", "id": 1, "error": {"code": -32000, "message": "Something went wrong"}}
```

### Notifications (fire-and-forget)

Notifications have no `id` field. The host does not wait for a response and the plugin must not send one.

```json
{"jsonrpc": "2.0", "method": "player.on_play", "params": {"track_id": "abc", "position_ms": 0}}
```

### All methods

#### `init` (blocking call)

Called once after the process is spawned, before any other method.

Params: `{"config": <saved settings object or {}>}`

Result: any object (ignored by host — use an error response to signal failure).

```json
{"jsonrpc": "2.0", "id": 1, "result": {"ok": true}}
```

#### `shutdown` (notification)

Sent just before the host kills the process. The plugin should flush state and exit cleanly.

Params: `{}`

#### `audio_source.search` (blocking call)

Requires `audio_source` capability.

Params: `{"query": "some text", "limit": 20}`

Result: `{"tracks": PluginTrack[]}`

```json
{
  "jsonrpc": "2.0", "id": 2,
  "result": {
    "tracks": [
      {
        "id": "yt:dQw4w9WgXcQ",
        "title": "Never Gonna Give You Up",
        "artist": "Rick Astley",
        "album": null,
        "duration_secs": 213.0,
        "artwork_url": "https://example.com/thumb.jpg",
        "needs_resolve": true,
        "meta": {}
      }
    ]
  }
}
```

#### `audio_source.browse_root` (blocking call)

Returns the top-level collection list for the audio source.

Params: `{}`

Result: `{"items": PluginBrowseItem[]}`

```json
{
  "jsonrpc": "2.0", "id": 3,
  "result": {
    "items": [
      {"id": "playlist:PL123", "label": "My Playlist", "kind": "collection", "artwork_url": null, "track_count": 42}
    ]
  }
}
```

`kind` is either `"collection"` (a folder/playlist) or `"track"` (a directly playable item).

#### `audio_source.browse_collection` (blocking call)

Returns tracks inside a collection.

Params: `{"collection_id": "playlist:PL123"}`

Result: `{"tracks": PluginTrack[]}`

#### `audio_source.resolve_stream` (blocking call)

Called right before playback to obtain a playable URI. Only called when `needs_resolve` is `true`.

Params: `{"track_id": "yt:dQw4w9WgXcQ"}`

Result: a `ResolvedStream` object:

```json
{
  "jsonrpc": "2.0", "id": 4,
  "result": {
    "uri": "https://rr1---sn-xxx.googlevideo.com/videoplayback?...",
    "content_type": "audio/webm",
    "expires_at": 1748476800,
    "headers": {}
  }
}
```

`uri` can be a `file://` path or an `http(s)://` URL. The audio engine plays it directly. `expires_at` is a Unix timestamp (seconds); `null` means the URI never expires.

#### Library hook notifications

All sent as fire-and-forget notifications. No response is expected.

| Method | Params |
|---|---|
| `library.on_scan_started` | `{"paths": ["~/Music", "/Volumes/NAS"]}` |
| `library.on_scan_progress` | `{"scanned": 150, "total": 2000}` |
| `library.on_scan_finished` | `{}` |
| `library.on_track_added` | `{"track_id": "uuid", "file_path": "/path/to/file.flac"}` |
| `library.on_track_removed` | `{"track_id": "uuid", "file_path": "/path/to/file.flac"}` |

#### Player hook notifications

| Method | Params |
|---|---|
| `player.on_play` | `{"track_id": "uuid", "position_ms": 0}` |
| `player.on_pause` | `{"track_id": "uuid", "position_ms": 45000}` |
| `player.on_resume` | `{"track_id": "uuid", "position_ms": 45000}` |
| `player.on_seek` | `{"track_id": "uuid", "position_ms": 90000}` |
| `player.on_track_ended` | `{"track_id": "uuid"}` |
| `player.on_stop` | `{}` |

#### Custom IPC dispatch

Any method name not listed above is routed to the plugin when `ipc_commands` is declared. The host calls `plugin_dispatch(plugin_id, method, params)` from the frontend, which is forwarded as a blocking call:

```json
{"jsonrpc": "2.0", "id": 5, "method": "my_custom_method", "params": {"foo": "bar"}}
```

---

## Frontend module format

The frontend entry file (specified in `frontend.entry`) must be a bundled ES module that exports a default `PluginFrontendModule`:

```typescript
import type { PluginFrontendModule, PluginApi, PluginUiContribution } from "@localify/plugin-types";

const module: PluginFrontendModule = {
  register(api: PluginApi): PluginUiContribution {
    // Called once on startup. Return your UI contributions.
    return {
      sidebarItems: [...],
      settingsSections: [...],
      // etc.
    };
  },
};

export default module;
```

The `PluginApi` object passed to `register` is pre-built for your plugin ID:

```typescript
interface PluginApi {
  pluginId: string;

  // Call a method on your subprocess via plugin_dispatch IPC.
  invoke<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;

  // Subscribe to a Tauri event emitted as `plugin:{pluginId}:{event}`.
  // Returns an unsubscribe function.
  onEvent(event: string, handler: (payload: unknown) => void): () => void;

  // Get/save persisted settings from SQLite.
  getSettings(): Promise<Record<string, unknown>>;
  saveSettings(settings: Record<string, unknown>): Promise<void>;
}
```

**Note:** Frontend loading is handled by `PluginRegistry.registerContribution` for bundled plugins. Dynamic loading of third-party frontend modules from disk is not yet implemented — `frontend.entry` is stored in the manifest but the file is not automatically imported. For now, ship UI as part of the main app or use the `ipc_commands` capability to let the existing UI call into your subprocess.

---

## UI slot reference

### Sidebar items

Appear below the main navigation links in the left sidebar.

```typescript
interface PluginSidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  route?: string;   // navigate to this path when clicked
  onClick?: () => void; // called instead when no route is provided
}
```

### Settings sections

Appear as additional sections inside the Settings view.

```typescript
interface PluginSettingsSection {
  id: string;
  label: string;               // section heading
  component: React.ComponentType; // rendered below the heading
}
```

### Track context menu items

Appear in the right-click context menu on any track row.

```typescript
interface PluginTrackContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onSelect: (track: Track) => void; // called with the right-clicked track
  enabled?: boolean;                // hide the item when false
}
```

### Now playing actions

Appear as icon buttons in the NowPlayingBar, to the right of the standard controls.

```typescript
interface PluginNowPlayingAction {
  id: string;
  icon: React.ReactNode;
  label: string;         // used as aria-label / tooltip
  onClick: () => void;
  isActive?: boolean;    // renders the button in an active/highlighted state
}
```

### Routes

Custom full-page views registered at `/plugins/{id}/...`.

```typescript
interface PluginRoute {
  path: string;                       // e.g. "plugins/com.example.foo/browse"
  component: React.ComponentType;
}
```

Navigate to a route from a sidebar item using `route: "plugins/com.example.foo/browse"`.

---

## Plugin settings

Settings are stored as a JSON object in the Localify SQLite database (`plugin_settings` table). They are loaded and passed to `init` on every startup.

**From the frontend (PluginApi):**

```typescript
const settings = await api.getSettings();
// settings is Record<string, unknown>, defaults to {} if never saved

await api.saveSettings({ api_key: "sk-abc123", enable_feature: true });
```

**From the frontend (TanStack Query hooks in `src/queries/plugins.ts`):**

```typescript
import { usePluginSettings, useSavePluginSettings } from "@/queries/plugins";

const { data: settings } = usePluginSettings("com.example.my-plugin");
const save = useSavePluginSettings("com.example.my-plugin");
save.mutate({ api_key: "sk-abc123" });
```

**From the backend subprocess:**

The saved settings object is passed as `config` in the `init` call:

```json
{"jsonrpc": "2.0", "id": 1, "method": "init", "params": {"config": {"api_key": "sk-abc123"}}}
```

---

## IPC commands reference

All IPC commands use `invoke` from `@tauri-apps/api/core`. Parameter names follow camelCase in TypeScript.

```typescript
import { invoke } from "@tauri-apps/api/core";

// List all installed plugins
const plugins = await invoke<PluginManifest[]>("plugin_list");

// Install from a local directory (path must be on the local filesystem)
const manifest = await invoke<PluginManifest>("plugin_install", { sourceDir: "/path/to/plugin-dir" });

// Uninstall (removes the directory from app_data_dir/plugins/)
await invoke<void>("plugin_uninstall", { pluginId: "com.example.my-plugin" });

// Get persisted settings
const settings = await invoke<Record<string, unknown>>("plugin_get_settings", { pluginId: "com.example.my-plugin" });

// Save persisted settings
await invoke<void>("plugin_save_settings", { pluginId: "com.example.my-plugin", settings: { key: "value" } });

// Dispatch a custom method to a plugin (requires ipc_commands capability)
const result = await invoke<unknown>("plugin_dispatch", {
  pluginId: "com.example.my-plugin",
  method: "my_method",
  params: { foo: "bar" },
});

// Audio source commands
const tracks = await invoke<PluginTrack[]>("plugin_audio_source_search", {
  pluginId: "com.example.my-plugin",
  query: "never gonna give",
  limit: 20,
});

const items = await invoke<PluginBrowseItem[]>("plugin_audio_source_browse_root", {
  pluginId: "com.example.my-plugin",
});

const tracks2 = await invoke<PluginTrack[]>("plugin_audio_source_browse_collection", {
  pluginId: "com.example.my-plugin",
  collectionId: "playlist:PL123",
});

// Resolve stream and start playback
const stream = await invoke<ResolvedStream>("plugin_audio_source_play", {
  pluginId: "com.example.my-plugin",
  trackId: "yt:dQw4w9WgXcQ",
});
```

---

## Installation

Copy the plugin directory into the Localify plugins folder:

```
# macOS
~/Library/Application Support/localify/plugins/com.example.my-plugin/

# Linux
~/.local/share/localify/plugins/com.example.my-plugin/

# Windows
%APPDATA%\localify\plugins\com.example.my-plugin\
```

Localify loads plugins on startup. To install without restarting, use the Plugins view (Settings sidebar → Plugins → "Install Plugin") or call `plugin_install` with the source directory path. The install command copies the directory into the plugins folder and registers the plugin immediately.

To uninstall, click "Uninstall" in the Plugins view or call `plugin_uninstall`. This removes the plugin from the registry and deletes the directory from disk.

---

## Testing plugins

### Testing the backend subprocess in isolation

Because the protocol is plain JSON over stdin/stdout, you can test it with any tool that can pipe text:

```bash
# Start the subprocess manually and type requests
echo '{"jsonrpc":"2.0","id":1,"method":"init","params":{"config":{}}}' | ./bin/my-plugin-macos
```

Or write a test script:

```python
import subprocess, json

proc = subprocess.Popen(
    ["./bin/my-plugin-macos"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
)

def call(method, params):
    req = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}) + "\n"
    proc.stdin.write(req.encode())
    proc.stdin.flush()
    return json.loads(proc.stdout.readline())

print(call("init", {"config": {}}))
print(call("audio_source.search", {"query": "test", "limit": 5}))
proc.terminate()
```

### Testing the frontend in isolation

Register a contribution directly via the registry singleton in a test or dev harness:

```typescript
import { PluginRegistry } from "@/plugins/PluginRegistry";

const registry = PluginRegistry.getInstance();
registry.registerContribution("com.example.my-plugin", {
  sidebarItems: [
    { id: "my-item", label: "My Plugin", icon: null, route: "plugins/com.example.my-plugin/index" },
  ],
});
```

### Running Rust unit tests

The loader, registry, and subprocess modules all have unit tests:

```bash
cd src-tauri
cargo test --lib plugins
```

---

## Example: Hello World (frontend-only)

This plugin adds a sidebar item that navigates to a simple "Hello World" page.

### Directory structure

```
com.example.hello/
├── plugin.json
└── dist/
    └── index.js   # not yet auto-loaded; register via registerContribution for now
```

### `plugin.json`

```json
{
  "id": "com.example.hello",
  "name": "Hello World",
  "version": "1.0.0",
  "api_version": "1",
  "description": "A minimal example plugin.",
  "capabilities": ["ui_components"],
  "backend": { "kind": "none" },
  "frontend": { "entry": "dist/index.js" },
  "permissions": {}
}
```

### Registering the contribution in the app (until dynamic loading is implemented)

In `src/main.tsx` (or any file that runs once on startup), after `PluginRegistryProvider` wraps the tree:

```typescript
import { PluginRegistry } from "@/plugins/PluginRegistry";

const registry = PluginRegistry.getInstance();

registry.registerContribution("com.example.hello", {
  sidebarItems: [
    {
      id: "hello-nav",
      label: "Hello World",
      icon: <span>👋</span>,
      route: "plugins/com.example.hello/index",
    },
  ],
  routes: [
    {
      path: "plugins/com.example.hello/index",
      component: HelloWorldView,
    },
  ],
});
```

```tsx
// HelloWorldView.tsx
export function HelloWorldView() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <h1 className="text-4xl font-bold text-white">Hello from a plugin!</h1>
    </div>
  );
}
```

---

## Example: yt-dlp audio source (Python)

This example shows a subprocess plugin that searches YouTube and streams audio via yt-dlp.

### Directory structure

```
com.example.ytdlp/
├── plugin.json
└── main.py
```

### `plugin.json`

```json
{
  "id": "com.example.ytdlp",
  "name": "YouTube via yt-dlp",
  "version": "1.0.0",
  "api_version": "1",
  "description": "Search and play YouTube tracks using yt-dlp.",
  "capabilities": ["audio_source", "ui_components"],
  "backend": {
    "kind": "subprocess",
    "executable": {
      "macos": "main.py",
      "linux": "main.py",
      "windows": "main.py"
    }
  },
  "frontend": { "entry": "dist/index.js" },
  "permissions": {
    "network": true,
    "exec_subprocess": true
  }
}
```

> **Note:** On macOS/Linux, `main.py` must be executable (`chmod +x main.py`) and have a shebang line such as `#!/usr/bin/env python3`.

### `main.py`

```python
#!/usr/bin/env python3
"""
Localify plugin: YouTube via yt-dlp
Protocol: newline-delimited JSON-RPC 2.0 over stdin/stdout
"""

import sys
import json
import subprocess


def log(msg: str) -> None:
    # stderr is inherited by the host — use it for debug output.
    print(f"[ytdlp] {msg}", file=sys.stderr, flush=True)


def respond(req_id, result):
    print(json.dumps({"jsonrpc": "2.0", "id": req_id, "result": result}), flush=True)


def error(req_id, message: str):
    print(json.dumps({"jsonrpc": "2.0", "id": req_id,
                       "error": {"code": -32000, "message": message}}), flush=True)


def yt_search(query: str, limit: int) -> list[dict]:
    result = subprocess.run(
        ["yt-dlp", f"ytsearch{limit}:{query}",
         "--flat-playlist", "--print", "%(id)s\t%(title)s\t%(uploader)s\t%(duration)s"],
        capture_output=True, text=True, timeout=15,
    )
    tracks = []
    for line in result.stdout.strip().splitlines():
        parts = line.split("\t")
        if len(parts) < 4:
            continue
        vid_id, title, artist, dur = parts[0], parts[1], parts[2], parts[3]
        tracks.append({
            "id": f"yt:{vid_id}",
            "title": title,
            "artist": artist,
            "album": None,
            "duration_secs": float(dur) if dur.isdigit() else 0.0,
            "artwork_url": f"https://img.youtube.com/vi/{vid_id}/mqdefault.jpg",
            "needs_resolve": True,
            "meta": {"video_id": vid_id},
        })
    return tracks


def yt_resolve(track_id: str) -> dict:
    video_id = track_id.removeprefix("yt:")
    result = subprocess.run(
        ["yt-dlp", f"https://www.youtube.com/watch?v={video_id}",
         "-f", "bestaudio", "--get-url"],
        capture_output=True, text=True, timeout=20,
    )
    uri = result.stdout.strip()
    if not uri:
        raise RuntimeError("yt-dlp returned no URL")
    return {"uri": uri, "content_type": "audio/webm", "expires_at": None, "headers": {}}


def handle(req: dict) -> None:
    method = req.get("method", "")
    params = req.get("params", {})
    req_id = req.get("id")  # None for notifications

    if method == "init":
        log("initialised")
        respond(req_id, {"ok": True})

    elif method == "audio_source.search":
        try:
            tracks = yt_search(params["query"], int(params.get("limit", 10)))
            respond(req_id, {"tracks": tracks})
        except Exception as exc:
            error(req_id, str(exc))

    elif method == "audio_source.browse_root":
        # No browsable library — return an empty list.
        respond(req_id, {"items": []})

    elif method == "audio_source.browse_collection":
        respond(req_id, {"tracks": []})

    elif method == "audio_source.resolve_stream":
        try:
            stream = yt_resolve(params["track_id"])
            respond(req_id, stream)
        except Exception as exc:
            error(req_id, str(exc))

    elif method == "shutdown":
        log("shutting down")
        sys.exit(0)

    # All other methods (library/player notifications) — nothing to do.


def main() -> None:
    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError as exc:
            log(f"bad JSON: {exc}")
            continue
        handle(req)


if __name__ == "__main__":
    main()
```

### Using the plugin

1. Install yt-dlp: `pip install yt-dlp` (or `brew install yt-dlp`).
2. Make the script executable: `chmod +x main.py`.
3. Copy the directory to the plugins folder (or use the Plugins UI to install it).
4. Restart Localify. The plugin should appear in the Plugins view.
5. Use `plugin_audio_source_search` from the frontend to search YouTube.
