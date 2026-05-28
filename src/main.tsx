import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/queries/queryClient";
import { router } from "@/router";
import { PluginRegistryProvider } from "@/plugins/PluginRegistryContext";
import { bootstrapTheme } from "@/lib/themes";
import "./globals.css";

bootstrapTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PluginRegistryProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </PluginRegistryProvider>
  </React.StrictMode>,
);
