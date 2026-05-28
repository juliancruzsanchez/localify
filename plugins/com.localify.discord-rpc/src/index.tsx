import type { PluginApi, PluginUiContribution } from "../../../src/plugins/types";
import { DiscordRpcSettings } from "./DiscordRpcSettings";

const PLUGIN_ID = "com.localify.discord-rpc";

export function register(_api: PluginApi): PluginUiContribution {
  return {
    settingsSections: [
      {
        id:        `${PLUGIN_ID}:settings`,
        label:     "Discord Rich Presence",
        component: DiscordRpcSettings,
      },
    ],
  };
}
