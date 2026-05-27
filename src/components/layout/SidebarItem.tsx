import React from "react";
import { NavLink } from "react-router";
import { cn } from "@/lib/utils";

interface SidebarItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
}

export function SidebarItem({ to, icon, label, collapsed }: SidebarItemProps) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
          "hover:text-white",
          collapsed ? "justify-center" : "",
          isActive ? "text-white" : "text-[var(--color-text-muted)]",
        )
      }
    >
      <span className="flex-shrink-0 w-5 h-5">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );
}
