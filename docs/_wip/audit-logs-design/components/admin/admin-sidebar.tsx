"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutGrid,
  Menu,
  Code2,
  Link2,
  FileText,
  Settings,
  Shield,
  Users,
  Sparkles,
} from "lucide-react"

const adminNavigation = [
  {
    name: "대시보드",
    href: "/admin",
    icon: LayoutGrid,
  },
  {
    name: "메뉴 관리",
    href: "/admin/menus",
    icon: Menu,
    description: "사이드바 메뉴 트리 관리",
  },
  {
    name: "코드 관리",
    href: "/admin/codes",
    icon: Code2,
    description: "드롭다운/검증 코드 관리",
  },
  {
    name: "코드 사용 정의",
    href: "/admin/code-usage",
    icon: Link2,
    description: "메뉴별 코드 그룹 매핑",
  },
  {
    name: "감사 로그",
    href: "/admin/audit-logs",
    icon: FileText,
    description: "운영 변경 이력 조회",
  },
  {
    name: "사용자 관리",
    href: "/admin/users",
    icon: Users,
    description: "사용자 계정 및 권한 관리",
  },
]

const generalNavigation = [
  {
    name: "AI Workspace",
    href: "/admin/ai-workspace",
    icon: Sparkles,
    description: "Aura AI 에이전트 워크스페이스",
  },
]

const bottomNavigation = [
  {
    name: "시스템 설정",
    href: "/admin/settings",
    icon: Settings,
  },
]

interface AdminSidebarProps {
  onNavigate?: () => void
}

export function AdminSidebar({ onNavigate }: AdminSidebarProps) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <Shield className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-sidebar-foreground">DWP Admin</span>
          <span className="text-xs text-muted-foreground">Enterprise Console</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-4 px-3 py-4 overflow-y-auto">
        {/* Admin Menu Section */}
        <div>
          <div className="mb-2 px-3">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              관리 메뉴
            </span>
          </div>
          <div className="space-y-1">
            {adminNavigation.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== "/admin" && pathname?.startsWith(item.href))
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5 shrink-0 transition-colors",
                      isActive ? "text-sidebar-primary" : "text-muted-foreground group-hover:text-sidebar-foreground"
                    )}
                  />
                  <span>{item.name}</span>
                  {isActive && (
                    <div className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />
                  )}
                </Link>
              )
            })}
          </div>
        </div>

        {/* General Menu Section */}
        <div>
          <div className="mb-2 px-3">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              일반 메뉴
            </span>
          </div>
          <div className="space-y-1">
            {generalNavigation.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href)
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5 shrink-0 transition-colors",
                      isActive ? "text-sidebar-primary" : "text-muted-foreground group-hover:text-sidebar-foreground"
                    )}
                  />
                  <span>{item.name}</span>
                  {isActive && (
                    <div className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Bottom Navigation */}
      <div className="border-t border-sidebar-border px-3 py-4">
        {bottomNavigation.map((item) => {
          const isActive = pathname === item.href
          
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 shrink-0 transition-colors",
                  isActive ? "text-sidebar-primary" : "text-muted-foreground group-hover:text-sidebar-foreground"
                )}
              />
              <span>{item.name}</span>
            </Link>
          )
        })}

        {/* User Info */}
        <div className="mt-4 flex items-center gap-3 rounded-lg bg-sidebar-accent/30 px-3 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary text-sm font-medium">
            A
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-sidebar-foreground truncate">Admin User</span>
            <span className="text-xs text-muted-foreground truncate">admin@dwp.com</span>
          </div>
        </div>
      </div>
    </div>
  )
}
