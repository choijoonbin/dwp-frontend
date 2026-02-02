"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { useApp } from "@/components/providers/app-provider"
import { mockTenants, mockSavedViews } from "@/lib/mock-data"
import {
  Search,
  Command,
  Building2,
  Calendar,
  Activity,
  Bookmark,
  Bell,
  HelpCircle,
  User,
  Sun,
  Moon,
  ChevronDown,
  Check,
  AlertTriangle,
  Loader2,
  Menu,
  X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

export function Topbar() {
  const {
    theme,
    setTheme,
    currentTenant,
    setCurrentTenant,
    currentCompanyCode,
    setCurrentCompanyCode,
    companyCodes,
    savedViews,
    currentView,
    setCurrentView,
    agentStatus,
    sidebarCollapsed,
    mobileMenuOpen,
    setMobileMenuOpen
  } = useApp()

  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <header className={cn(
      "fixed top-0 right-0 z-30 h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-300",
      // Desktop
      "lg:left-64",
      sidebarCollapsed && "lg:left-16",
      // Mobile
      "left-0"
    )}>
      <div className="flex h-full items-center justify-between px-4 gap-4">
        {/* Mobile Menu Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-8 w-8"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        
        {/* Left Section: Search */}
        <div className="flex items-center gap-3 flex-1 max-w-xl">
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-muted-foreground gap-2 h-9 px-3 bg-transparent"
              >
                <Search className="h-4 w-4" />
                <span className="flex-1 text-left">Search cases, documents, entities...</span>
                <kbd className="hidden md:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  <Command className="h-3 w-3" />K
                </kbd>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
              <div className="p-3 border-b border-border">
                <Input
                  placeholder="Search across cases, documents, entities, open items..."
                  className="h-9"
                  autoFocus
                />
              </div>
              <div className="p-2">
                <div className="text-xs font-medium text-muted-foreground px-2 py-1">Recent Searches</div>
                <div className="space-y-1">
                  <button className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-foreground hover:bg-accent rounded-md transition-colors">
                    <Search className="h-3.5 w-3.5 text-muted-foreground" />
                    Vendor Alpha duplicate invoices
                  </button>
                  <button className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-foreground hover:bg-accent rounded-md transition-colors">
                    <Search className="h-3.5 w-3.5 text-muted-foreground" />
                    Bank change alerts Q1
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Center Section: Filters */}
        <div className="hidden lg:flex items-center gap-2">
          {/* Tenant Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-2 bg-transparent">
                <Building2 className="h-3.5 w-3.5" />
                <span className="max-w-[100px] truncate">{currentTenant.code}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuLabel>Select Tenant</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {mockTenants.map(tenant => (
                <DropdownMenuItem
                  key={tenant.code}
                  onClick={() => setCurrentTenant(tenant)}
                  className="gap-2"
                >
                  <Check className={cn(
                    "h-4 w-4",
                    currentTenant.id === tenant.id ? "opacity-100" : "opacity-0"
                  )} />
                  <span>{tenant.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{tenant.code}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Company Code */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-2 bg-transparent">
                <span className="max-w-[80px] truncate">{currentCompanyCode?.id || "All"}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuLabel>Company Code</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {companyCodes.map(cc => (
                <DropdownMenuItem
                  key={cc.id}
                  onClick={() => setCurrentCompanyCode(cc)}
                  className="gap-2"
                >
                  <Check className={cn(
                    "h-4 w-4",
                    currentCompanyCode?.id === cc.id ? "opacity-100" : "opacity-0"
                  )} />
                  <span>{cc.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{cc.id}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Date Range */}
          <Button variant="outline" size="sm" className="h-8 gap-2 bg-transparent">
            <Calendar className="h-3.5 w-3.5" />
            <span>Jan 1 - Jan 30, 2026</span>
          </Button>

          {/* Agent Status */}
          <div className={cn(
            "flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium",
            agentStatus === 'live' && "bg-success/15 text-success",
            agentStatus === 'processing' && "bg-info/15 text-info",
            agentStatus === 'degraded' && "bg-warning/15 text-warning"
          )}>
            {agentStatus === 'live' && <Activity className="h-3 w-3" />}
            {agentStatus === 'processing' && <Loader2 className="h-3 w-3 animate-spin" />}
            {agentStatus === 'degraded' && <AlertTriangle className="h-3 w-3" />}
            <span className="capitalize">{agentStatus}</span>
          </div>

          {/* Saved Views */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-2 bg-transparent">
                <Bookmark className="h-3.5 w-3.5" />
                <span className="max-w-[100px] truncate">{currentView?.name || "Views"}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuLabel>Saved Views</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {savedViews.map(view => (
                <DropdownMenuItem
                  key={view.id}
                  onClick={() => setCurrentView(view)}
                  className="gap-2"
                >
                  <Check className={cn(
                    "h-4 w-4",
                    currentView?.id === view.id ? "opacity-100" : "opacity-0"
                  )} />
                  <span>{view.name}</span>
                  {view.isDefault && (
                    <Badge variant="secondary" className="ml-auto text-[10px] h-4">Default</Badge>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right Section: Actions */}
        <div className="flex items-center gap-1">
          {/* Notifications */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-8 w-8">
                <Bell className="h-4 w-4" />
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
                  3
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="p-3 border-b border-border">
                <h4 className="font-semibold text-sm">Notifications</h4>
                <p className="text-xs text-muted-foreground">3 critical alerts requiring attention</p>
              </div>
              <div className="divide-y divide-border">
                <NotificationItem
                  type="critical"
                  title="Critical: Duplicate Invoice Detected"
                  message="Case CS-2026-0001 requires approval within 2h"
                  time="5m ago"
                />
                <NotificationItem
                  type="high"
                  title="Bank Account Change Alert"
                  message="Vendor Beta LLC bank details modified"
                  time="1h ago"
                />
                <NotificationItem
                  type="critical"
                  title="SLA Breach Warning"
                  message="2 cases at risk of SLA breach"
                  time="2h ago"
                />
              </div>
              <div className="p-2 border-t border-border">
                <Button variant="ghost" size="sm" className="w-full text-xs">
                  View All Notifications
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Help */}
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <HelpCircle className="h-4 w-4" />
          </Button>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <User className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <div>John Smith</div>
                <div className="text-xs font-normal text-muted-foreground">john.smith@acme.com</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile Settings</DropdownMenuItem>
              <DropdownMenuItem>Preferences</DropdownMenuItem>
              <DropdownMenuItem>Keyboard Shortcuts</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">Sign Out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

function NotificationItem({
  type,
  title,
  message,
  time
}: {
  type: 'critical' | 'high' | 'medium'
  title: string
  message: string
  time: string
}) {
  return (
    <div className="flex gap-3 p-3 hover:bg-accent/50 transition-colors cursor-pointer">
      <div className={cn(
        "h-2 w-2 rounded-full mt-1.5 flex-shrink-0",
        type === 'critical' && "bg-destructive",
        type === 'high' && "bg-warning",
        type === 'medium' && "bg-info"
      )} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">{title}</div>
        <div className="text-xs text-muted-foreground truncate">{message}</div>
        <div className="text-[10px] text-muted-foreground mt-1">{time}</div>
      </div>
    </div>
  )
}
