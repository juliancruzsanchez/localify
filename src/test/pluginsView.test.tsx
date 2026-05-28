import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PluginsView } from "@/views/PluginsView";
import { invoke } from "@tauri-apps/api/core";
import type { PluginManifest } from "@/plugins/types";

// @tauri-apps/api/core, @tauri-apps/api/event, @tauri-apps/plugin-dialog are mocked in setup.ts

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe("PluginsView", () => {
  it("renders heading and install button", () => {
    vi.mocked(invoke).mockResolvedValue([]);
    render(<PluginsView />, { wrapper: makeWrapper() });
    expect(screen.getByText("Plugins")).toBeInTheDocument();
    expect(screen.getByText("Install Plugin")).toBeInTheDocument();
  });

  it("shows empty state when no plugins installed", async () => {
    vi.mocked(invoke).mockResolvedValue([]);
    render(<PluginsView />, { wrapper: makeWrapper() });
    await waitFor(() => {
      expect(screen.getByText(/No plugins installed/i)).toBeInTheDocument();
    });
  });

  it("renders plugin cards when plugins exist", async () => {
    const manifest: PluginManifest = {
      id: "com.test.hello",
      name: "Hello Plugin",
      version: "2.0.0",
      api_version: "1",
      description: "A test plugin",
      capabilities: ["ui_components"],
      permissions: {
        network: false,
        filesystem: false,
        exec_subprocess: false,
        read_library_db: false,
        write_library_db: false,
        player_control: false,
        player_observe: false,
      },
    };
    vi.mocked(invoke).mockResolvedValue([manifest]);
    render(<PluginsView />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Hello Plugin")).toBeInTheDocument();
    });
    expect(screen.getByText("v2.0.0")).toBeInTheDocument();
    expect(screen.getByText("A test plugin")).toBeInTheDocument();
  });

  it("shows capability badges", async () => {
    const manifest: PluginManifest = {
      id: "com.test.caps",
      name: "Caps Plugin",
      version: "1.0.0",
      api_version: "1",
      capabilities: ["audio_source", "ui_components"],
      permissions: {
        network: false,
        filesystem: false,
        exec_subprocess: false,
        read_library_db: false,
        write_library_db: false,
        player_control: false,
        player_observe: false,
      },
    };
    vi.mocked(invoke).mockResolvedValue([manifest]);
    render(<PluginsView />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByText("audio source")).toBeInTheDocument();
      expect(screen.getByText("ui components")).toBeInTheDocument();
    });
  });

  it("uninstall button triggers plugin_uninstall invoke", async () => {
    const user = userEvent.setup();
    const manifest: PluginManifest = {
      id: "com.test.uninstall-me",
      name: "Uninstall Me",
      version: "1.0.0",
      api_version: "1",
      capabilities: [],
      permissions: {
        network: false,
        filesystem: false,
        exec_subprocess: false,
        read_library_db: false,
        write_library_db: false,
        player_control: false,
        player_observe: false,
      },
    };
    // First call (usePlugins) returns the plugin; second call (uninstall) succeeds
    vi.mocked(invoke)
      .mockResolvedValueOnce([manifest]) // plugin_list
      .mockResolvedValueOnce(undefined); // plugin_uninstall

    render(<PluginsView />, { wrapper: makeWrapper() });

    await waitFor(() => expect(screen.getByText("Uninstall Me")).toBeInTheDocument());

    const uninstallBtn = screen.getByRole("button", { name: /uninstall/i });
    await user.click(uninstallBtn);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("plugin_uninstall", { pluginId: "com.test.uninstall-me" });
    });
  });
});
