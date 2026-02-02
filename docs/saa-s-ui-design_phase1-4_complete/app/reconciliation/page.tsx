"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  GitPullRequest,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  RefreshCcw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { mockCompanyCodes, mockOpenItems, mockCases } from "@/lib/mock-data"

function pct(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)))
}

export default function ReconciliationPage() {
  const [q, setQ] = useState("")
  const [company, setCompany] = useState<string>("all")

  // Mock reconciliation signals derived from existing mock data
  const derived = useMemo(() => {
    const totalRaw = 200000
    const totalDocs = 199420
    const totalOpenItems = mockOpenItems.length
    const missingDocs = totalRaw - totalDocs
    const dupEvents = 412
    const latencyP95 = 88

    const issues = [
      {
        id: "iss-001",
        type: "missing",
        severity: "high" as const,
        title: "Missing FI documents after ingestion",
        company: "1000",
        count: missingDocs,
        hint: "Raw events exist but normalized fi_doc records are missing",
        action: "Reprocess window",
      },
      {
        id: "iss-002",
        type: "duplicate",
        severity: "medium" as const,
        title: "Duplicate raw events detected",
        company: "2000",
        count: dupEvents,
        hint: "Multiple identical event payloads received within short window",
        action: "Deduplicate",
      },
      {
        id: "iss-003",
        type: "latency",
        severity: "low" as const,
        title: "Ingestion latency p95 above target",
        company: "1000",
        count: latencyP95,
        hint: "p95 is over the 60s SLA during peak hours",
        action: "Scale workers",
      },
    ]

    return {
      totalRaw,
      totalDocs,
      totalOpenItems,
      missingDocs,
      dupEvents,
      latencyP95,
      integrityPct: pct((totalDocs / totalRaw) * 100),
      issues,
      lastSyncAt: new Date().toISOString(),
    }
  }, [])

  const rows = useMemo(() => {
    let list = derived.issues
    if (company !== "all") list = list.filter((i) => i.company === company)
    if (q.trim()) {
      const s = q.toLowerCase()
      list = list.filter((i) =>
        [i.title, i.type, i.company, i.hint].some((v) => v.toLowerCase().includes(s))
      )
    }
    return list
  }, [derived.issues, company, q])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <GitPullRequest className="h-6 w-6 text-primary" />
            Reconciliation Report
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Validate ingestion integrity between SAP source events and normalized finance tables.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 bg-transparent">
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
          <Button className="gap-2" asChild>
            <Link href="/action-recon">
              Action Reconciliation <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Raw Events (SAP)</CardTitle>
            <CardDescription className="text-xs">Last 24h</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{derived.totalRaw.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">IDoc / API / S3 ingestion</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">FI Documents</CardTitle>
            <CardDescription className="text-xs">Normalized</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{derived.totalDocs.toLocaleString()}</div>
            <div className="flex items-center gap-2 mt-2">
              <Progress value={derived.integrityPct} className="h-2" />
              <span className="text-xs text-muted-foreground">{derived.integrityPct}%</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Open Items</CardTitle>
            <CardDescription className="text-xs">AR/AP</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{derived.totalOpenItems.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">Used for risk & reminders</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Cases</CardTitle>
            <CardDescription className="text-xs">agent_case</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockCases.length.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">Investigations & actions</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Integrity Issues
              </CardTitle>
              <CardDescription>Exceptions that require attention or reprocessing</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search issues, company code, hints..."
                  className="pl-9"
                />
              </div>
              <Button variant="outline" className="gap-2 bg-transparent">
                <Filter className="h-4 w-4" />
                Filters
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-3 text-xs">
            <span className="text-muted-foreground">Company:</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCompany("all")}
                className={cn(
                  "px-2 py-1 rounded-md border",
                  company === "all" ? "bg-primary/10 border-primary/40" : "bg-muted/30"
                )}
              >
                All
              </button>
              {mockCompanyCodes.slice(0, 2).map((c) => (
                <button
                  key={c.bukrs}
                  onClick={() => setCompany(c.bukrs)}
                  className={cn(
                    "px-2 py-1 rounded-md border",
                    company === c.bukrs ? "bg-primary/10 border-primary/40" : "bg-muted/30"
                  )}
                >
                  {c.bukrs}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Severity</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead className="w-[120px]">Company</TableHead>
                  <TableHead className="w-[140px] text-right">Count</TableHead>
                  <TableHead className="w-[160px]">Recommended</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/30">
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "gap-1",
                          r.severity === "high"
                            ? "bg-warning/10 text-warning border-warning/30"
                            : r.severity === "medium"
                              ? "bg-info/10 text-info border-info/30"
                              : "bg-success/10 text-success border-success/30"
                        )}
                      >
                        {r.severity === "high" ? (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        ) : r.severity === "medium" ? (
                          <Clock className="h-3.5 w-3.5" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        {r.severity.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{r.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{r.hint}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.company}</TableCell>
                    <TableCell className="text-right font-semibold">{r.count.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        {r.action}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">
                      No issues match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <Separator className="my-4" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Last sync: {new Date(derived.lastSyncAt).toLocaleString()}</span>
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Audit-ready traceability
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
