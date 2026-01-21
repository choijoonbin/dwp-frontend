"use client"

import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Menu, Bell, Sun, Moon, User, LogOut, Settings } from "lucide-react"
import { useState } from "react"

const pageTitles: Record<string, { title: string; description: string }> = {
  "/admin": {
    title: "대시보드",
    description: "시스템 현황 및 통계 요약",
  },
  "/admin/menus": {
    title: "메뉴 관리",
    description: "사이드바 메뉴 트리 구성 및 관리",
  },
  "/admin/codes": {
    title: "코드 관리",
    description: "드롭다운/검증에 사용되는 코드 관리 · 운영 변경 주의",
  },
  "/admin/code-usage": {
    title: "코드 사용 정의",
    description: "메뉴별 드롭다운 코드 그룹 매핑 · 매핑이 없으면 selectbox가 비활성화됩니다",
  },
  "/admin/audit-logs": {
    title: "감사 로그",
    description: "운영 변경 이력 조회 및 보안 감사",
  },
  "/admin/settings": {
    title: "시스템 설정",
    description: "시스템 전역 설정 관리",
  },
}

interface AdminHeaderProps {
  onMenuClick: () => void
}

export function AdminHeader({ onMenuClick }: AdminHeaderProps) {
  const pathname = usePathname()
  const [isDark, setIsDark] = useState(true)
  
  const pageInfo = pageTitles[pathname || "/admin"] || pageTitles["/admin"]

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle("dark")
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden shrink-0"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">메뉴 열기</span>
      </Button>

      {/* Page Title */}
      <div className="flex flex-col min-w-0 flex-1">
        <h1 className="text-lg font-semibold text-foreground truncate">
          {pageInfo.title}
        </h1>
        <p className="text-sm text-muted-foreground truncate hidden sm:block">
          {pageInfo.description}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="hidden sm:flex"
        >
          {isDark ? (
            <Sun className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Moon className="h-5 w-5 text-muted-foreground" />
          )}
          <span className="sr-only">테마 변경</span>
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
            3
          </span>
          <span className="sr-only">알림</span>
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary text-sm font-medium">
                A
              </div>
              <span className="sr-only">사용자 메뉴</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>Admin User</span>
                <span className="text-xs font-normal text-muted-foreground">admin@dwp.com</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              프로필
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              설정
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
