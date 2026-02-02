"use client"

import React from "react"

import { cn } from "@/lib/utils"
import { useApp } from "@/components/providers/app-provider"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { sidebarCollapsed } = useApp()

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <Topbar />
      <main className={cn(
        "pt-14 min-h-screen transition-all duration-300",
        // Desktop
        "lg:pl-64",
        sidebarCollapsed && "lg:pl-16",
        // Mobile - no sidebar padding
        "pl-0"
      )}>
        {children}
      </main>
    </div>
  )
}
