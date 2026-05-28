import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface RemoteStreamInfo {
  port: number;
  local_ip: string;
  base_url: string;
}

export function RemoteStreamSettings() {
  const [info, setInfo] = useState<RemoteStreamInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const status = await invoke<RemoteStreamInfo | null>("remote_stream_status");
      setInfo(status);
    } catch {
      setInfo(null);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleStart = async () => {
    setLoading(true);
    try {
      const result = await invoke<RemoteStreamInfo>("remote_stream_start");
      setInfo(result);
    } catch (e) {
      console.error("[remote-streaming] start failed:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await invoke("remote_stream_stop");
      setInfo(null);
    } catch (e) {
      console.error("[remote-streaming] stop failed:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(info.base_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const isActive = info !== null;

  return (
    <div style={styles.container}>
      <div style={styles.row}>
        <div style={styles.statusDot(isActive)} />
        <span style={styles.statusText}>
          {isActive ? "Server running" : "Server stopped"}
        </span>
        <button
          style={styles.button(isActive, loading)}
          onClick={isActive ? handleStop : handleStart}
          disabled={loading}
        >
          {loading ? "…" : isActive ? "Stop" : "Start"}
        </button>
      </div>

      {isActive && info && (
        <div style={styles.urlBox}>
          <p style={styles.label}>Base URL</p>
          <div style={styles.urlRow}>
            <span style={styles.urlText} title={info.base_url}>
              {info.base_url}
            </span>
            <button style={styles.copyBtn} onClick={handleCopy}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p style={styles.hint}>
            Stream a track at{" "}
            <code style={styles.code}>{info.base_url}/stream/&#123;track_id&#125;</code>
          </p>
          <p style={styles.hint}>
            Get a playlist at{" "}
            <code style={styles.code}>{info.base_url}/playlist.m3u8?ids=id1,id2</code>
          </p>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: "flex" as const,
    flexDirection: "column" as const,
    gap: 16,
  },
  row: {
    display: "flex" as const,
    alignItems: "center" as const,
    gap: 10,
  },
  statusDot: (active: boolean): React.CSSProperties => ({
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: active ? "#1db954" : "rgba(255,255,255,0.25)",
    flexShrink: 0,
  }),
  statusText: {
    flex: 1,
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
  } as React.CSSProperties,
  button: (active: boolean, disabled: boolean): React.CSSProperties => ({
    padding: "6px 14px",
    borderRadius: 6,
    border: "none",
    fontSize: 13,
    fontWeight: 500,
    cursor: disabled ? "default" : "pointer",
    background: active ? "rgba(255,255,255,0.1)" : "#1db954",
    color: active ? "rgba(255,255,255,0.7)" : "#000",
    opacity: disabled ? 0.6 : 1,
    transition: "opacity 150ms",
  }),
  urlBox: {
    background: "rgba(255,255,255,0.05)",
    borderRadius: 8,
    padding: 14,
    display: "flex" as const,
    flexDirection: "column" as const,
    gap: 8,
  },
  label: {
    margin: 0,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    color: "rgba(255,255,255,0.4)",
  },
  urlRow: {
    display: "flex" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  urlText: {
    flex: 1,
    fontSize: 13,
    color: "#fff",
    fontFamily: "monospace",
    overflow: "hidden" as const,
    textOverflow: "ellipsis" as const,
    whiteSpace: "nowrap" as const,
    userSelect: "all" as const,
  },
  copyBtn: {
    padding: "4px 10px",
    borderRadius: 5,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "transparent",
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    cursor: "pointer",
    flexShrink: 0,
  } as React.CSSProperties,
  hint: {
    margin: 0,
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    lineHeight: 1.5,
  },
  code: {
    fontFamily: "monospace",
    background: "rgba(255,255,255,0.08)",
    padding: "1px 4px",
    borderRadius: 3,
    fontSize: 11,
  } as React.CSSProperties,
};
