# Localify

Spotify but for your local files.

## Plugin System

### Plugin discovery path

On startup Localify scans every sub-directory inside:

```
{app_data_dir}/plugins/{plugin_id}/
```

Each sub-directory must contain a `plugin.json` manifest. Directories without one are silently skipped. Individual load errors are logged but do not prevent other plugins from loading.

### Plugin manifest format (`plugin.json`)

```json
{
  "id": "com.example.my-plugin",        // reverse-DNS, required
  "name": "My Plugin",                   // required
  "version": "1.0.0",                   // required
  "api_version": "1",                   // must be "1"
  "description": "Optional description",
  "capabilities": ["ui_components", "audio_source", "library_hooks", "player_hooks", "ipc_commands"],
  "backend": {
    "kind": "subprocess",               // or "none" for frontend-only plugins
    "executable": {
      "macos":   "bin/my-plugin-macos",
      "windows": "bin/my-plugin-windows.exe",
      "linux":   "bin/my-plugin-linux"
    },
    "args": [],                         // optional extra CLI args
    "env": {},                          // optional extra env vars
    "startup_timeout_ms": 5000
  },
  "frontend": { "entry": "dist/index.js", "styles": "dist/index.css" },
  "permissions": {
    "network": false,
    "filesystem": false,
    "exec_subprocess": false,
    "read_library_db": false,
    "write_library_db": false,
    "player_control": false,
    "player_observe": false
  },
  "settings_schema": { "type": "object", "properties": {} }
}
```

### Backend IPC commands

| Command | Arguments | Return |
|---|---|---|
| `plugin_list` | — | `PluginManifest[]` |
| `plugin_install` | `source_dir: string` | `PluginManifest` |
| `plugin_uninstall` | `plugin_id: string` | `void` |
| `plugin_get_settings` | `plugin_id: string` | `Record<string, unknown>` |
| `plugin_save_settings` | `plugin_id: string, settings: Record<string, unknown>` | `void` |
| `plugin_dispatch` | `plugin_id: string, method: string, params: unknown` | `unknown` |
| `plugin_audio_source_search` | `plugin_id: string, query: string, limit: number` | `PluginTrack[]` |
| `plugin_audio_source_browse_root` | `plugin_id: string` | `PluginBrowseItem[]` |
| `plugin_audio_source_browse_collection` | `plugin_id: string, collection_id: string` | `PluginTrack[]` |
| `plugin_audio_source_play` | `plugin_id: string, track_id: string` | `ResolvedStream` |

Settings are persisted in SQLite (`plugin_settings` table). All other plugin commands require the corresponding capability declared in the manifest.

### JSON-RPC protocol (subprocess plugins)

Communication is newline-delimited JSON-RPC 2.0 over stdin/stdout.

**Blocking calls** (host waits for a response): `init`, `audio_source.*`, `ipc_commands` dispatches.

**Notifications** (fire-and-forget, no response expected): `shutdown`, all `library.*` and `player.*` events.

Methods the host sends to the plugin process:

| Method | Type | Params |
|---|---|---|
| `init` | call | `{config: object}` |
| `shutdown` | notify | `{}` |
| `audio_source.search` | call | `{query, limit}` |
| `audio_source.browse_root` | call | `{}` |
| `audio_source.browse_collection` | call | `{collection_id}` |
| `audio_source.resolve_stream` | call | `{track_id}` |
| `library.on_scan_started` | notify | `{paths: string[]}` |
| `library.on_scan_progress` | notify | `{scanned, total}` |
| `library.on_scan_finished` | notify | `{}` |
| `library.on_track_added` | notify | `{track_id, file_path}` |
| `library.on_track_removed` | notify | `{track_id, file_path}` |
| `player.on_play` | notify | `{track_id, position_ms}` |
| `player.on_pause` | notify | `{track_id, position_ms}` |
| `player.on_resume` | notify | `{track_id, position_ms}` |
| `player.on_seek` | notify | `{track_id, position_ms}` |
| `player.on_track_ended` | notify | `{track_id}` |
| `player.on_stop` | notify | `{}` |

Any other method name is routed through `plugin_dispatch` (requires `ipc_commands` capability).

### Frontend hooks

```typescript
import { usePluginRegistry, usePluginRegistrySnapshot } from "@/plugins/PluginRegistryContext";
```

- `usePluginRegistry()` — returns the `PluginRegistry` singleton. Does not re-render on changes.
- `usePluginRegistrySnapshot()` — same, but re-renders whenever plugins are installed or uninstalled (uses `useSyncExternalStore`).

### Registering UI contributions

A bundled plugin calls `registry.registerContribution(pluginId, contribution)` where `contribution` is a `PluginUiContribution`:

```typescript
interface PluginUiContribution {
  sidebarItems?: PluginSidebarItem[];         // below main nav in sidebar
  settingsSections?: PluginSettingsSection[]; // extra sections in Settings view
  trackContextMenuItems?: PluginTrackContextMenuItem[]; // track right-click menu
  nowPlayingActions?: PluginNowPlayingAction[]; // icon buttons in NowPlayingBar
  routes?: PluginRoute[];                     // custom views at /plugins/:id/...
}
```

Use `registry.buildApi(pluginId)` to get a `PluginApi` for a bundled plugin's backend calls.

Full developer guide: `docs/plugin-api.md`.