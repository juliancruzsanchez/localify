// Thin event-bus so plugins can navigate without importing react-router directly.
// Call setPluginNavigate once in App.tsx after useNavigate() is available.

let _navigate: ((path: string) => void) | null = null;

export function setPluginNavigate(fn: (path: string) => void) {
  _navigate = fn;
}

export function pluginNavigate(path: string) {
  _navigate?.(path);
}
