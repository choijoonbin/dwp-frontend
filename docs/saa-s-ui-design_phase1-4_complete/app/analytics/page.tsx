"use client"

import { useMemo, useState } from "react"
import {
  BarChart3,
  TrendingDown,
  TrendingUp,
  Search,
  Filter,
  Download,
  Sparkles,
  Gauge,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { mockCases, mockActions } from "@/lib/mock-data"

function money(amt: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amt)
}

export default function AnalyticsPage() {
  const [q, setQ] = useState("")
  const [window, setWindow] = useState<"7d" | "30d" | "90d">("30d")
  const [currency, setCurrency] = useState("USD")

  const derived = useMemo(() => {
    const allCases = mockCases
    const allActions = mockActions

    const actionSuccess = allActions.filter((a) => a.status === "completed").length
    const actionTotal = allActions.length
    const successRate = actionTotal > 0 ? (actionSuccess / actionTotal) * 100 : 0

    const critical = allCases.filter((c) => c.severity === "critical").length
    const high = allCases.filter((c) => c.severity === "high").length

    // rough savings estimate (mock)
    const savings = allActions.reduce((acc, a) => acc + (a.estimatedImpact?.amount ?? 0), 0)

    const byType = allCases.reduce<Record<string, number>>((acc, c) => {
      acc[c.anomalyType] = (acc[c.anomalyType] ?? 0) + 1
      return acc
    }, {})

    const topTypes = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([k, v]) => ({ type: k, count: v }))

    const rows = allCases
      .filter((c) => {
        if (!q) return true
        const s = `${c.id} ${c.title} ${c.anomalyType} ${c.companyCode}`.toLowerCase()
        return s.includes(q.toLowerCase())
      })
      .slice(0, 80)
      .map((c) => ({
        id: c.id,
        title: c.title,
        type: c.anomalyType,
        severity: c.severity,
        company: c.companyCode,
        createdAt: c.createdAt,
        status: c.status,
      }))

    return {
      successRate,
      critical,
      high,
      savings,
      topTypes,
      rows,
    }
  }, [q])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Impact Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Outcome and effectiveness metrics for enterprise adoption, audits, and executive reporting.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 bg-transparent">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button className="gap-2">
            <Sparkles className="h-4 w-4" />
            Generate Executive Summary
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Gauge className="h-4 w-4 text-primary" />
              Action Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{derived.successRate.toFixed(0)}%</div>
            <Progress value={derived.successRate} className="h-2 mt-2" />
            <p className="text-xs text-muted-foreground mt-2">Includes retries; excludes simulation-only runs.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Estimated Savings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{money(derived.savings, currency)}</div>
            <p className="text-xs text-muted-foreground mt-2">Based on policy savings heuristics (mock).</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-primary" />
              Critical Backlog
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{derived.critical}</div>
            <p className="text-xs text-muted-foreground mt-2">Cases requiring immediate approval or action.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              High Severity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{derived.high}</div>
            <p className="text-xs text-muted-foreground mt-2">Tracked for SLA & escalation.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Risk Drivers & Case Outcomes
          </CardTitle>
          <CardDescription>
            Top anomaly categories and representative cases (mocked). Use this view to justify ROI and tune policies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-[340px]">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cases, types, company codes..." className="pl-8" />
              </div>
              <Badge variant="outline" className="gap-1">
                <Filter className="h-3.5 w-3.5" />
                {window.toUpperCase()}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Select value={window} onValueChange={(v) => setWindow(v as any)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Window" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="KRW">KRW</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="gap-2 bg-transparent">
                <SlidersPill />
                Compare Baseline
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 mt-4">
            <div className="rounded-lg border p-3">
              <div className="text-sm font-medium">Top Risk Drivers</div>
              <div className="mt-3 space-y-2">
                {derived.topTypes.map((t) => {
                  const pct = derived.topTypes.reduce((a, b) => a + b.count, 0) > 0 ? (t.count / derived.topTypes.reduce((a, b) => a + b.count, 0)) * 100 : 0
                  return (
                    <div key={t.type} className="flex items-center gap-3">
                      <div className="w-[140px] text-xs text-muted-foreground truncate">{t.type.replaceAll("_", " ")}</div>
                      <div className="flex-1">
                        <Progress value={pct} className="h-2" />
                      </div>
                      <div className="w-[60px] text-xs text-muted-foreground text-right">{t.count}</div>
                    </div>
                  )
                })}
              </div>
              <Separator className="my-3" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Signals are explainable and policy-citable.</span>
                <Badge variant="outline" className="gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  Evidence-first
                </Badge>
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <div className="text-sm font-medium">Adoption Health</div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Avg approval time</div>
                  <div className="text-lg font-semibold mt-1">18m</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Escalations</div>
                  <div className="text-lg font-semibold mt-1">{Math.max(3, Math.floor(derived.critical / 5))}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Policy overrides</div>
                  <div className="text-lg font-semibold mt-1">12</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Trust index</div>
                  <div className="text-lg font-semibold mt-1">82</div>
                </div>
              </div>
              <Separator className="my-3" />
              <div className="text-xs text-muted-foreground">
                Use this panel to drive rollout decisions (pilot → standard → strict) and governance adjustments.
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Case ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="w-[180px]">Type</TableHead>
                  <TableHead className="w-[120px]">Severity</TableHead>
                  <TableHead className="w-[90px]">Company</TableHead>
                  <TableHead className="w-[150px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {derived.rows.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/40">
                    <TableCell className="font-mono text-xs">{r.id}</TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{r.title}</span>
                        <Badge variant="outline" className="text-[10px]">{new Date(r.createdAt).toLocaleDateString()}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.type.replaceAll("_", " ")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs", severityPill(r.severity))}>
                        {r.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{r.company}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {r.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {derived.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                      No cases match your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
            <span>Mock analytics view. Wire to real metrics once ingestion + actions are connected.</span>
            <Badge variant="outline" className="gap-1">
              <BarChart3 className="h-3.5 w-3.5" />
              Executive-ready
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SlidersPill() {
  return <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-muted text-[10px]">A/B</span>
}

function severityPill(sev: string) {
  const map: Record<string, string> = {
    critical: "bg-destructive/10 text-destructive border-destructive/20",
    high: "bg-warning/10 text-warning border-warning/20",
    medium: "bg-info/10 text-info border-info/20",
    low: "bg-success/10 text-success border-success/20",
  }
  return map[sev] ?? ""
}
