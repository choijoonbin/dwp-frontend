"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  Search,
  Filter,
  Sparkles,
  ArrowUpRight,
  CircleDollarSign,
  Landmark,
  FileWarning,
  GitCompare,
  Clock,
  SlidersHorizontal,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { SeverityBadge } from "@/components/finance/severity-badge"
import { mockCases, mockCompanyCodes } from "@/lib/mock-data"

const anomalyTypeMeta: Record<string, { label: string; icon: any; hint: string; color: string }> = {
  duplicate_invoice: {
    label: "Duplicate Invoice",
    icon: GitCompare,
    hint: "Potential duplicate invoice or repeated posting pattern",
    color: "bg-warning/10 text-warning border-warning/30",
  },
  bank_change: {
    label: "Bank Change Risk",
    icon: Landmark,
    hint: "Payment risk after vendor bank account changes",
    color: "bg-destructive/10 text-destructive border-destructive/30",
  },
  policy_violation: {
    label: "Policy Violation",
    icon: FileWarning,
    hint: "Violation of finance policy / approval matrix",
    color: "bg-info/10 text-info border-info/30",
  },
  integrity_mismatch: {
    label: "Integrity Mismatch",
    icon: AlertTriangle,
    hint: "Header/line mismatch, FX/tax inconsistency, or missing references",
    color: "bg-warning/10 text-warning border-warning/30",
  },
  amount_variance: {
    label: "Amount Variance",
    icon: CircleDollarSign,
    hint: "Outlier amount compared to historical baseline",
    color: "bg-destructive/10 text-destructive border-destructive/30",
  },
  timing_anomaly: {
    label: "Timing Anomaly",
    icon: Clock,
    hint: "Off-hours / holiday activity or suspicious timing",
    color: "bg-muted text-muted-foreground border-border",
  },
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function AnomaliesPage() {
  const [q, setQ] = useState("")
  const [severity, setSeverity] = useState<string>("all")
  const [atype, setAtype] = useState<string>("all")
  const [bukrs, setBukrs] = useState<string>("all")

  const rows = useMemo(() => {
    return mockCases
      .filter((c) => {
        if (severity !== "all" && c.severity !== severity) return false
        if (atype !== "all" && c.anomalyType !== atype) return false
        if (bukrs !== "all" && c.companyCode !== bukrs) return false
        if (!q) return true
        const s = q.toLowerCase()
        return (
          c.caseNumber.toLowerCase().includes(s) ||
          c.counterparty.toLowerCase().includes(s) ||
          c.docNumber.toLowerCase().includes(s) ||
          c.anomalyType.toLowerCase().includes(s)
        )
      })
      .sort((a, b) => {
        const sevRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
        const d = sevRank[a.severity] - sevRank[b.severity]
        if (d !== 0) return d
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
  }, [q, severity, atype, bukrs])

  const kpi = useMemo(() => {
    const bySev = rows.reduce(
      (acc, r) => {
        acc[r.severity] = (acc[r.severity] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )
    const highRisk = (bySev.critical || 0) + (bySev.high || 0)
    const avgConfidence = rows.length ? rows.reduce((s, r) => s + r.confidence, 0) / rows.length : 0
    const totalExposure = rows.reduce((s, r) => s + r.amount, 0)
    const currency = rows[0]?.currency || "USD"
    return { bySev, highRisk, avgConfidence, totalExposure, currency }
  }, [rows])

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-warning" />
            Anomaly Detection
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            High-signal anomaly workbench across FI/AP/AR/GL transactions, optimized for review and escalation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 bg-transparent">
            <SlidersHorizontal className="h-4 w-4" />
            Thresholds
          </Button>
          <Button className="gap-2">
            <Sparkles className="h-4 w-4" />
            Run Scan
          </Button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total anomalies</CardTitle>
            <CardDescription className="text-xs">Filtered view</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rows.length.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Critical {kpi.bySev.critical || 0} · High {kpi.bySev.high || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">High-risk backlog</CardTitle>
            <CardDescription className="text-xs">Needs approval or action</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpi.highRisk.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">Sorted by severity then recency</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Avg confidence</CardTitle>
            <CardDescription className="text-xs">Model + rules ensemble</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(kpi.avgConfidence * 100)}%</div>
            <div className="text-xs text-muted-foreground mt-1">Explainable-by-default in case detail</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Exposure (sum)</CardTitle>
            <CardDescription className="text-xs">Across filtered anomalies</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(kpi.totalExposure, kpi.currency)}</div>
            <div className="text-xs text-muted-foreground mt-1">Currency displayed per record currency</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            Review queue
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-5 relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search case #, vendor/customer, document #, type…"
                className="pl-8"
              />
            </div>
            <div className="lg:col-span-2">
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger>
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-3">
              <Select value={atype} onValueChange={setAtype}>
                <SelectTrigger>
                  <SelectValue placeholder="Anomaly type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {Object.entries(anomalyTypeMeta).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-2">
              <Select value={bukrs} onValueChange={setBukrs}>
                <SelectTrigger>
                  <SelectValue placeholder="Company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All companies</SelectItem>
                  {mockCompanyCodes.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Case</TableHead>
                  <TableHead className="w-[170px]">Type</TableHead>
                  <TableHead>Counterparty</TableHead>
                  <TableHead className="w-[160px]">Document</TableHead>
                  <TableHead className="w-[140px] text-right">Amount</TableHead>
                  <TableHead className="w-[120px] text-right">Confidence</TableHead>
                  <TableHead className="w-[160px]">SLA</TableHead>
                  <TableHead className="w-[90px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 200).map((c) => {
                  const meta = anomalyTypeMeta[c.anomalyType]
                  const TypeIcon = meta?.icon || AlertTriangle
                  const slaHours = Math.max(
                    0,
                    Math.round((new Date(c.slaDue).getTime() - Date.now()) / (1000 * 60 * 60))
                  )
                  return (
                    <TableRow key={c.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <SeverityBadge severity={c.severity} size="sm" />
                          <Link href={`/cases/${c.id}`} className="font-medium hover:underline">
                            {c.caseNumber}
                          </Link>
                        </div>
                        <div className="text-xs text-muted-foreground">{c.companyCode} · {c.currency}</div>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border",
                                  meta?.color || "bg-muted text-muted-foreground border-border"
                                )}
                              >
                                <TypeIcon className="h-3.5 w-3.5" />
                                {meta?.label || c.anomalyType}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[280px]">
                              <p className="text-xs">{meta?.hint}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{c.counterparty}</div>
                        <div className="text-xs text-muted-foreground">Assignee: {c.assignee || "Unassigned"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-xs">{c.docNumber}</div>
                        <div className="text-xs text-muted-foreground">{c.docType?.toUpperCase()}</div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMoney(c.amount, c.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={cn(
                          "text-xs",
                          c.confidence >= 0.9
                            ? "bg-success/10 text-success border-success/20"
                            : c.confidence >= 0.75
                              ? "bg-warning/10 text-warning border-warning/20"
                              : "bg-muted text-muted-foreground"
                        )}>
                          {Math.round(c.confidence * 100)}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{new Date(c.slaDue).toLocaleString()}</div>
                        <div className={cn(
                          "text-xs",
                          slaHours <= 6 ? "text-destructive" : slaHours <= 24 ? "text-warning" : "text-muted-foreground"
                        )}>
                          {slaHours <= 0 ? "SLA breached" : `${slaHours}h remaining`}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm" className="gap-1">
                          <Link href={`/cases/${c.id}`}>
                            Open <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}

                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">
                      No anomalies match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
            <span>Showing {Math.min(200, rows.length)} of {rows.length.toLocaleString()} records</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Explainable-by-default
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                RAG citations available
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
