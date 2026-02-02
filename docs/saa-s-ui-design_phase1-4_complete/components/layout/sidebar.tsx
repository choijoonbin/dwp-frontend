"use client"

import React from "react"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useApp } from "@/components/providers/app-provider"
import {
  LayoutDashboard,
  ListTodo,
  AlertTriangle,
  TrendingUp,
  Zap,
  Archive,
  FileText,
  Wallet,
  Building2,
  GitBranch,
  BookOpen,
  ShieldCheck,
  Fence,
  BookType,
  MessageSquareMore,
  FileBarChart,
  GitCompare,
  History,
  BarChart3,
  Sliders,
  Bot,
  Plug,
  Settings,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeft
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: number
}

interface NavGroup {
  label: string
  icon: React.ElementType
  items: NavItem[]
  defaultOpen?: boolean
}

const navigation: (NavItem | NavGroup)[] = [
  {
    label: "Intelligence Command Center",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Autonomous Operations",
    icon: Zap,
    defaultOpen: true,
    items: [
      { label: "Case Worklist", href: "/cases", icon: ListTodo, badge: 6 },
      { label: "Anomaly Detection", href: "/anomalies", icon: AlertTriangle },
      { label: "AR/AP Optimization", href: "/optimization", icon: TrendingUp },
      { label: "Action Center", href: "/actions", icon: Zap, badge: 3 },
      { label: "Action Archive", href: "/archive", icon: Archive },
    ]
  },
  {
    label: "Master Data & History",
    icon: FileText,
    items: [
      { label: "FI Documents", href: "/documents", icon: FileText },
      { label: "Open Items", href: "/open-items", icon: Wallet },
      { label: "Entity Hub", href: "/entities", icon: Building2 },
      { label: "Lineage & Evidence", href: "/lineage", icon: GitBranch },
    ]
  },
  {
    label: "Knowledge & Policy Hub",
    icon: BookOpen,
    items: [
      { label: "RAG Library", href: "/rag", icon: BookOpen },
      { label: "Policy Profiles", href: "/policies", icon: ShieldCheck },
      { label: "Guardrails", href: "/guardrails", icon: Fence },
      { label: "Enterprise Dictionary", href: "/dictionary", icon: BookType },
      { label: "Feedback & Labeling", href: "/feedback", icon: MessageSquareMore },
    ]
  },
  {
    label: "Reconciliation & Audit",
    icon: FileBarChart,
    items: [
      { label: "Reconciliation Report", href: "/reconciliation", icon: FileBarChart },
      { label: "Action Reconciliation", href: "/action-recon", icon: GitCompare },
      { label: "Audit Trail", href: "/audit", icon: History },
      { label: "Impact Analytics", href: "/analytics", icon: BarChart3 },
    ]
  },
  {
    label: "Governance & Config",
    icon: Settings,
    items: [
      { label: "Autonomy & Guardrails", href: "/governance", icon: Sliders },
      { label: "Agent Configuration", href: "/agent-config", icon: Bot },
      { label: "Integrations & Data Ops", href: "/integrations", icon: Plug },
      { label: "Admin", href: "/admin", icon: Settings },
    ]
  },
]

function isNavGroup(item: NavItem | NavGroup): item is NavGroup {
  return 'items' in item
}

function NavLinkItem({ item, pathname, collapsed, onClick }: { item: NavItem; pathname: string; collapsed: boolean; onClick?: () => void }) {
  const isActive = pathname === item.href
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        isActive
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        collapsed && "justify-center px-2"
      )}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge !== undefined && (
            <span className={cn(
              "ml-auto text-[10px] font-medium rounded-full px-1.5 py-0.5 min-w-[18px] text-center",
              isActive 
                ? "bg-sidebar-primary-foreground/20 text-sidebar-primary-foreground" 
                : "bg-destructive/15 text-destructive"
            )}>
              {item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  )
}

function NavGroupItem({ 
  group, 
  isOpen, 
  onToggle, 
  pathname, 
  collapsed,
  onNavClick 
}: { 
  group: NavGroup
  isOpen: boolean
  onToggle: () => void
  pathname: string
  collapsed: boolean
  onNavClick?: () => void
}) {
  const Icon = group.icon
  const hasActiveChild = group.items.some(item => pathname === item.href)
  const totalBadge = group.items.reduce((acc, item) => acc + (item.badge || 0), 0)

  if (collapsed) {
    return (
      <div className="relative group">
        <div className={cn(
          "flex items-center justify-center rounded-lg px-2 py-2 text-sm transition-colors cursor-pointer",
          hasActiveChild
            ? "bg-sidebar-accent text-sidebar-primary"
            : "text-sidebar-foreground hover:bg-sidebar-accent"
        )}>
          <Icon className="h-4 w-4" />
        </div>
        {/* Tooltip for collapsed state */}
        <div className="absolute left-full top-0 ml-2 hidden group-hover:block z-50">
          <div className="bg-popover border border-border rounded-lg shadow-lg p-2 min-w-[180px]">
            <div className="text-xs font-semibold text-muted-foreground mb-2 px-2">
              {group.label}
            </div>
            {group.items.map(item => (
              <Link
                key={item.label}
                href={item.href}
                onClick={onNavClick}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                  pathname === item.href
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent"
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="ml-auto text-[10px] font-medium bg-destructive/15 text-destructive rounded-full px-1.5">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        hasActiveChild
          ? "text-sidebar-primary"
          : "text-sidebar-foreground hover:bg-sidebar-accent"
      )}>
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1 text-left truncate font-medium">{group.label}</span>
        {totalBadge > 0 && (
          <span className="text-[10px] font-medium bg-destructive/15 text-destructive rounded-full px-1.5 py-0.5">
            {totalBadge}
          </span>
        )}
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 ml-4 pl-3 border-l border-sidebar-border space-y-1">
          {group.items.map(item => (
            <NavLinkItem key={item.label} item={item} pathname={pathname} collapsed={false} onClick={onNavClick} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, setSidebarCollapsed, mobileMenuOpen, setMobileMenuOpen } = useApp()
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    navigation.forEach(item => {
      if (isNavGroup(item) && item.defaultOpen) {
        initial[item.label] = true
      }
    })
    return initial
  })

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }))
  }

  // Close mobile menu when route changes
  const handleNavClick = () => {
    if (mobileMenuOpen) {
      setMobileMenuOpen(false)
    }
  }

  return (
    <>
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      
      <aside className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-sidebar-border bg-sidebar transition-all duration-300",
        // Desktop
        "hidden lg:block",
        sidebarCollapsed ? "lg:w-16" : "lg:w-64",
        // Mobile - show when menu is open
        mobileMenuOpen && "block w-64"
      )}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className={cn(
            "flex h-14 items-center border-b border-sidebar-border px-4",
            sidebarCollapsed && "justify-center px-2"
          )}>
            {!sidebarCollapsed && (
              <Link href="/" className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                  <Zap className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-sidebar-foreground">FinanceAI</span>
                  <span className="text-[10px] text-muted-foreground -mt-0.5">Self-Healing Finance</span>
                </div>
              </Link>
            )}
            {sidebarCollapsed && (
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Zap className="h-5 w-5 text-primary-foreground" />
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4 px-2">
            <div className="space-y-1">
              {navigation.map((item) => {
                if (isNavGroup(item)) {
                  return (
                    <NavGroupItem
                      key={item.label}
                      group={item}
                      isOpen={openGroups[item.label] || false}
                      onToggle={() => toggleGroup(item.label)}
                      pathname={pathname}
                      collapsed={sidebarCollapsed}
                      onNavClick={handleNavClick}
                    />
                  )
                }
                return (
                  <NavLinkItem
                    key={item.label}
                    item={item}
                    pathname={pathname}
                    collapsed={sidebarCollapsed}
                    onClick={handleNavClick}
                  />
                )
              })}
            </div>
          </nav>

          {/* Collapse Toggle */}
          <div className="border-t border-sidebar-border p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full justify-center text-sidebar-foreground hover:bg-sidebar-accent"
            >
              {sidebarCollapsed ? (
                <PanelLeft className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </aside>
    </>
  )
}
