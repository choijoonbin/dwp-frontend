"use client"

import React from "react"

import { useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  Heart,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  ArrowRight,
  Activity,
  CheckCircle2,
  XCircle,
  Zap,
  Eye,
  BarChart3,
  Users,
  FileText,
  Bot,
  Shield,
  ChevronRight,
  Play,
  RefreshCw
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SeverityBadge } from "@/components/finance/severity-badge"
import { StatusPill } from "@/components/finance/status-pill"
import {
  mockKPIs,
  mockCases,
  mockAgentActivity,
  mockRiskDrivers,
  mockTeamSnapshot,
  mockActions
} from "@/lib/mock-data"

export default function DashboardPage() {
  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Intelligence Command Center</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time overview of autonomous finance operations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 bg-transparent">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button size="sm" className="gap-2">
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">View All Cases</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Financial Health Index"
          value={mockKPIs.financialHealthIndex}
          suffix="/100"
          trend={mockKPIs.financialHealthTrend}
          trendLabel="vs last month"
          icon={Heart}
          iconColor="text-success"
          iconBg="bg-success/10"
        />
        <KPICard
          title="Open Cases by Severity"
          value={mockKPIs.openCasesBySeverity.critical + mockKPIs.openCasesBySeverity.high}
          suffix=" critical/high"
          subValue={`${mockKPIs.openCasesBySeverity.medium + mockKPIs.openCasesBySeverity.low} medium/low`}
          icon={AlertTriangle}
          iconColor="text-warning"
          iconBg="bg-warning/10"
        />
        <KPICard
          title="AI Action Success Rate"
          value={mockKPIs.aiActionSuccessRate}
          suffix="%"
          trend={mockKPIs.aiActionSuccessTrend}
          trendLabel="vs last week"
          icon={Zap}
          iconColor="text-primary"
          iconBg="bg-primary/10"
        />
        <KPICard
          title="Est. Prevented Loss"
          value={`$${(mockKPIs.estimatedPreventedLoss / 1000000).toFixed(2)}M`}
          trend={mockKPIs.preventedLossTrend}
          trendLabel="this quarter"
          icon={DollarSign}
          iconColor="text-success"
          iconBg="bg-success/10"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Action Required Queue */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-warning" />
                    Action Required
                  </CardTitle>
                  <CardDescription>Approvals waiting for your review</CardDescription>
                </div>
                <Badge variant="secondary" className="bg-warning/15 text-warning">
                  {mockActions.filter(a => a.status === 'pending').length} Pending
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockActions.filter(a => a.status === 'pending').slice(0, 3).map(action => {
                  const relatedCase = mockCases.find(c => c.id === action.caseId)
                  return (
                    <div
                      key={action.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0",
                          action.riskLevel === 'critical' && "bg-destructive/10",
                          action.riskLevel === 'high' && "bg-warning/10",
                          action.riskLevel === 'medium' && "bg-info/10"
                        )}>
                          <Zap className={cn(
                            "h-5 w-5",
                            action.riskLevel === 'critical' && "text-destructive",
                            action.riskLevel === 'high' && "text-warning",
                            action.riskLevel === 'medium' && "text-info"
                          )} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground truncate">
                              {action.description}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">
                              {relatedCase?.caseNumber}
                            </span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <SeverityBadge severity={action.riskLevel} size="sm" showIcon={false} />
                          </div>
                        </div>
                      </div>
                      <Link href={`/actions?id=${action.id}`}>
                        <Button size="sm" className="gap-1">
                          Review
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    </div>
                  )
                })}
              </div>
              <Link href="/actions">
                <Button variant="ghost" className="w-full mt-3 text-muted-foreground">
                  View All Pending Actions
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Top Risk Drivers */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Top Risk Drivers
                  </CardTitle>
                  <CardDescription>Primary anomaly categories requiring attention</CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  View Analytics
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockRiskDrivers.map(driver => (
                  <div key={driver.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{driver.label}</span>
                        <Badge variant="secondary" className="text-[10px] h-5">
                          {driver.count} cases
                        </Badge>
                        {driver.trend === 'up' && (
                          <TrendingUp className="h-3.5 w-3.5 text-destructive" />
                        )}
                        {driver.trend === 'down' && (
                          <TrendingDown className="h-3.5 w-3.5 text-success" />
                        )}
                      </div>
                      <span className="text-sm font-semibold text-foreground">
                        ${(driver.amount / 1000).toFixed(0)}K
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          driver.type === 'duplicate_invoice' && "bg-destructive",
                          driver.type === 'bank_change' && "bg-warning",
                          driver.type === 'policy_violation' && "bg-info",
                          driver.type === 'integrity_mismatch' && "bg-primary"
                        )}
                        style={{ width: `${(driver.amount / 500000) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Team Snapshot */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Team Snapshot
                  </CardTitle>
                  <CardDescription>Workload and performance metrics</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left font-medium text-muted-foreground py-2 pr-4">Analyst</th>
                      <th className="text-center font-medium text-muted-foreground py-2 px-4">Open Cases</th>
                      <th className="text-center font-medium text-muted-foreground py-2 px-4">SLA Risk</th>
                      <th className="text-right font-medium text-muted-foreground py-2 pl-4">Avg Lead Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockTeamSnapshot.map(member => (
                      <tr key={member.id} className="border-b border-border last:border-0">
                        <td className="py-3 pr-4">
                          <div>
                            <div className="font-medium text-foreground">{member.name}</div>
                            <div className="text-xs text-muted-foreground">{member.role}</div>
                          </div>
                        </td>
                        <td className="text-center py-3 px-4">
                          <span className="font-semibold text-foreground">{member.openCases}</span>
                        </td>
                        <td className="text-center py-3 px-4">
                          {member.slaRisk > 0 ? (
                            <Badge variant="destructive" className="text-[10px]">
                              {member.slaRisk} at risk
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-success/15 text-success text-[10px]">
                              On track
                            </Badge>
                          )}
                        </td>
                        <td className="text-right py-3 pl-4">
                          <span className="font-medium text-foreground">{member.avgLeadTime}h</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Agent Activity Stream */}
        <div className="space-y-6">
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    Agent Execution Stream
                  </CardTitle>
                  <CardDescription>Real-time AI agent activity</CardDescription>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                  </span>
                  <span className="text-xs text-success font-medium">Live</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 rounded-lg border border-border overflow-hidden">
                <div className="p-2 border-b border-border bg-muted/80 flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                    <div className="h-2.5 w-2.5 rounded-full bg-warning/60" />
                    <div className="h-2.5 w-2.5 rounded-full bg-success/60" />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">agent-stream.log</span>
                </div>
                <div className="p-3 font-mono text-xs space-y-2 max-h-[400px] overflow-y-auto">
                  {mockAgentActivity.map(activity => (
                    <ActivityLogItem key={activity.id} activity={activity} />
                  ))}
                </div>
              </div>
              <Button variant="ghost" className="w-full mt-3 text-muted-foreground text-xs">
                View Full Audit Log
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Quick Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Pending Approvals</span>
                  <span className="text-lg font-bold text-foreground">{mockKPIs.pendingApprovals}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">SLA at Risk</span>
                  <span className="text-lg font-bold text-warning">{mockKPIs.slaAtRisk}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Avg Lead Time</span>
                  <span className="text-lg font-bold text-foreground">{mockKPIs.avgLeadTime}h</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Backlog</span>
                  <span className="text-lg font-bold text-foreground">{mockKPIs.backlogCount}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function KPICard({
  title,
  value,
  suffix,
  subValue,
  trend,
  trendLabel,
  icon: Icon,
  iconColor,
  iconBg
}: {
  title: string
  value: string | number
  suffix?: string
  subValue?: string
  trend?: number
  trendLabel?: string
  icon: React.ElementType
  iconColor: string
  iconBg: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-foreground">{value}</span>
              {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
            </div>
            {subValue && (
              <p className="text-xs text-muted-foreground">{subValue}</p>
            )}
            {trend !== undefined && (
              <div className="flex items-center gap-1 pt-1">
                {trend > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 text-success" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                )}
                <span className={cn(
                  "text-xs font-medium",
                  trend > 0 ? "text-success" : "text-destructive"
                )}>
                  {trend > 0 ? "+" : ""}{trend}%
                </span>
                {trendLabel && (
                  <span className="text-xs text-muted-foreground">{trendLabel}</span>
                )}
              </div>
            )}
          </div>
          <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", iconBg)}>
            <Icon className={cn("h-5 w-5", iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ActivityLogItem({ activity }: { activity: typeof mockAgentActivity[0] }) {
  const time = new Date(activity.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

  const statusColors = {
    complete: "text-muted-foreground",
    success: "text-success",
    alert: "text-warning",
    error: "text-destructive"
  }

  const actionColors = {
    SCAN: "text-info",
    DETECT: "text-warning",
    EXECUTE: "text-success",
    SIMULATE: "text-primary",
    ANALYZE: "text-info",
    MATCH: "text-primary"
  }

  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground/60 flex-shrink-0">{time}</span>
      <span className={cn("flex-shrink-0", actionColors[activity.action as keyof typeof actionColors] || "text-foreground")}>
        [{activity.action}]
      </span>
      <span className={cn("flex-1", statusColors[activity.status as keyof typeof statusColors] || "text-foreground")}>
        {activity.message}
      </span>
    </div>
  )
}
