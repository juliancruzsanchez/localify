import { useState, useEffect } from "react";
import { Wifi } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import type { PluginApi, PluginUiContribution } from "../../../src/plugins/types";
import { pluginNavigate } from "../../../src/plugins/navigation";
import { RemoteStreamSettings } from "./RemoteStreamSettings";

const PLUGIN_ID       = "com.localify.remote-streaming";
const SETTINGS_ANCHOR = `${PLUGIN_ID}:settings`;

interface RemoteStreamInfo {
  port: number;
  local_ip: string;
  base_url: string;
}

function WifiAction() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    invoke<RemoteStreamInfo | null>("remote_stream_status")
      .then((s) => setActive(s !== null))
      .catch(() => setActive(false));
  }, []);

  return (
    <Wifi
      size={18}
      color={active ? "#1db954" : undefined}
      onClick={() => pluginNavigate(`/settings#${SETTINGS_ANCHOR}`)}
      style={{ cursor: "pointer" }}
    />
  );
}

export function register(_api: PluginApi): PluginUiContribution {
  return {
    nowPlayingActions: [
      {
        id:      `${PLUGIN_ID}:toggle`,
        label:   "Remote Streaming",
        icon:    <WifiAction />,
        onClick: () => pluginNavigate(`/settings#${SETTINGS_ANCHOR}`),
      },
    ],

    settingsSections: [
      {
        id:        SETTINGS_ANCHOR,
        label:     "Remote Streaming",
        component: RemoteStreamSettings,
      },
    ],
  };
}
