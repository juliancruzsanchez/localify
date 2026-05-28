/**
 * com.localify.visualizer — example Localify plugin
 *
 * This file is the plugin entry point. Localify calls `register(api)` once at
 * startup and uses the returned PluginUiContribution to wire up UI slots.
 *
 * For bundled (built-in) usage the app imports this directly.
 * For standalone usage `npm run build` compiles it to dist/index.js.
 */

import { Activity } from "lucide-react";
import type { PluginApi, PluginUiContribution } from "../../../src/plugins/types";
import { pluginNavigate } from "../../../src/plugins/navigation";
import { VisualizerPage } from "./VisualizerPage";

const PLUGIN_ID  = "com.localify.visualizer";
const ROUTE_PATH = `plugins/${PLUGIN_ID}/view`;

export function register(_api: PluginApi): PluginUiContribution {
  return {
    nowPlayingActions: [
      {
        id:    `${PLUGIN_ID}:open`,
        label: "Visualizer",
        icon:  <Activity size={18} />,
        onClick: () => pluginNavigate(`/${ROUTE_PATH}`),
      },
    ],

    routes: [
      {
        path:      ROUTE_PATH,
        component: VisualizerPage,
      },
    ],
  };
}
