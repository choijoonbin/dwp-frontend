"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import type { Tenant, CompanyCode, SavedView } from "@/lib/mock-data"
import { mockTenants, mockCompanyCodes, mockSavedViews } from "@/lib/mock-data"

interface AppContextType {
  // Theme
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
  
  // Tenant & Company
  currentTenant: Tenant
  setCurrentTenant: (tenant: Tenant) => void
  currentCompanyCode: CompanyCode | null
  setCurrentCompanyCode: (code: CompanyCode | null) => void
  companyCodes: CompanyCode[]
  
  // Date Range
  dateRange: { from: Date; to: Date }
  setDateRange: (range: { from: Date; to: Date }) => void
  
  // Saved Views
  savedViews: SavedView[]
  currentView: SavedView | null
  setCurrentView: (view: SavedView | null) => void
  
  // Agent Status
  agentStatus: 'live' | 'processing' | 'degraded'
  
  // Sidebar
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  
  // Mobile
  mobileMenuOpen: boolean
  setMobileMenuOpen: (open: boolean) => void
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [currentTenant, setCurrentTenant] = useState<Tenant>(mockTenants[0])
  const [currentCompanyCode, setCurrentCompanyCode] = useState<CompanyCode | null>(mockCompanyCodes[0])
  const [dateRange, setDateRange] = useState({ from: new Date(2026, 0, 1), to: new Date() })
  const [savedViews] = useState<SavedView[]>(mockSavedViews)
  const [currentView, setCurrentView] = useState<SavedView | null>(mockSavedViews[0])
  const [agentStatus] = useState<'live' | 'processing' | 'degraded'>('live')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const companyCodes = mockCompanyCodes.filter(cc => cc.tenantId === currentTenant.id)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    // Reset company code when tenant changes
    const tenantCodes = mockCompanyCodes.filter(cc => cc.tenantId === currentTenant.id)
    if (tenantCodes.length > 0) {
      setCurrentCompanyCode(tenantCodes[0])
    } else {
      setCurrentCompanyCode(null)
    }
  }, [currentTenant])

  return (
    <AppContext.Provider value={{
      theme,
      setTheme,
      currentTenant,
      setCurrentTenant,
      currentCompanyCode,
      setCurrentCompanyCode,
      companyCodes,
      dateRange,
      setDateRange,
      savedViews,
      currentView,
      setCurrentView,
      agentStatus,
      sidebarCollapsed,
      setSidebarCollapsed,
      mobileMenuOpen,
      setMobileMenuOpen
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within AppProvider')
  }
  return context
}
