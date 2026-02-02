"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  TrendingUp,
  Search,
  Filter,
  Send,
  ShieldAlert,
  Clock,
  ArrowUpRight,
  Sparkles,
  CircleDollarSign,
  Building2,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SeverityBadge } from "@/components/finance/severity-badge"
import { mockOpenItems, mockEntities, type OpenItem } from "@/lib/mock-data"

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

type Mode = "ar" | "ap"

function recommendationFor(item: OpenItem): { label: string; action: "remind" | "review" | "hold"; tone: string } {
  // Very lightweight mock heuristic for UI.
  if (item.overdueDays > 60) return { label: "Escalate & propose dunning", action: "remind", tone: "bg-destructive/10 text-destructive border-destructive/30" }
  if (item.overdueDays > 30) return { label: "Send reminder + confirm promise date", action: "remind", tone: "bg-warning/10 text-warning border-warning/30" }
  if (item.amount > 500000) return { label: "High-value review + approval required", action: "review", tone: "bg-info/10 text-info border-info/30" }
  return { label: "Auto-follow-up eligible", action: "remind", tone: "bg-success/10 text-success border-success/30" }
}

export default function OptimizationPage() {
  const [mode, setMode] = useState<Mode>("ar")
  const [search, setSearch] = useState("")
  const [risk, setRisk] = useState<string>("all")
  const [bucket, setBucket] = useState<string>("all")

  const rows = useMemo(() => {
    const filtered = mockOpenItems
      .filter((i) => (mode === "ar" ? i.type === "AR" : i.type === "AP"))
      .filter((i) => {
        if (!search) return true
        const q = search.toLowerCase()
        return (
          i.documentId.toLowerCase().includes(q) ||
          i.entityId.toLowerCase().includes(q) ||
          i.reference.toLowerCase().includes(q)
        )
      })
      .filter((i) => {
        if (bucket === "all") return true
        if (bucket === "0-30") return i.overdueDays >= 0 && i.overdueDays <= 30
        if (bucket === "31-60") return i.overdueDays >= 31 && i.overdueDays <= 60
        if (bucket === "60+") return i.overdueDays > 60
        return true
      })
      .filter((i) => {
        if (risk === "all") return true
        const rec = recommendationFor(i)
        if (risk === "critical") return rec.tone.includes("destructive")
        if (risk === "high") return rec.tone.includes("warning")
        if (risk === "medium") return rec.tone.includes("info")
        if (risk === "low") return rec.tone.includes("success")
        return true
      })

    return filtered
  }, [mode, search, risk, bucket])

  const totals = useMemo(() => {
    const sum = rows.reduce((acc, r) => acc + r.amount, 0)
    const overdue = rows.filter((r) => r.overdueDays > 0).reduce((acc, r) => acc + r.amount, 0)
    const highValue = rows.filter((r) => r.amount > 500000).length
    return { sum, overdue, highValue }
  }, [rows])

  const getEntityName = (id: string) => mockEntities.find((e) => e.id === id)?.name || id

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            AR/AP Optimization
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Prioritize open items, apply guardrails, and execute consistent follow-up at enterprise scale.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 bg-transparent">
            <Sparkles className="h-4 w-4" />
            Auto-recommend (mock)
          </Button>
          <Button className="gap-2">
            <Send className="h-4 w-4" />
            Send Bulk Reminders
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
              Total Exposure
            </CardTitle>
            <CardDescription className="text-xs">Current selection</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{formatMoney(totals.sum, "USD")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Overdue Amount
            </CardTitle>
            <CardDescription className="text-xs">Only overdue items</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{formatMoney(totals.overdue, "USD")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
              High-value Items
            </CardTitle>
            <CardDescription className="text-xs">> 500K requires approval</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{totals.highValue.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            Worklist Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex items-center gap-2">
              <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <TabsList>
                  <TabsTrigger value="ar">AR (Receivables)</TabsTrigger>
                  <TabsTrigger value="ap">AP (Payables)</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by document, entity, reference..."
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={bucket} onValueChange={setBucket}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Aging" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="0-30">0–30</SelectItem>
                  <SelectItem value="31-60">31–60</SelectItem>
                  <SelectItem value="60+">60+</SelectItem>
                </SelectContent>
              </Select>
              <Select value={risk} onValueChange={setRisk}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Risk" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All risks</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Optimization Worklist
          </CardTitle>
          <CardDescription className="text-xs">
            Recommendations are mocked; production will be driven by the Agent + policy profiles.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Open Item</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead className="w-[140px]">Amount</TableHead>
                  <TableHead className="w-[120px]">Overdue</TableHead>
                  <TableHead>Recommendation</TableHead>
                  <TableHead className="w-[160px]">Next</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 200).map((item) => {
                  const rec = recommendationFor(item)
                  return (
                    <TableRow key={item.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs">
                        <Link href={`/open-items?openItemId=${encodeURIComponent(item.id)}`} className="hover:underline">
                          {item.documentId}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-medium">{getEntityName(item.entityId)}</div>
                            <div className="text-xs text-muted-foreground font-mono">{item.entityId}</div>
                          </div>
                          <Link href={`/entities/${encodeURIComponent(item.entityId)}`} className="text-muted-foreground hover:text-foreground">
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{formatMoney(item.amount, item.currency)}</TableCell>
                      <TableCell>
                        {item.overdueDays > 0 ? (
                          <SeverityBadge severity={item.overdueDays > 60 ? "critical" : item.overdueDays > 30 ? "high" : "medium"} size="sm" />
                        ) : (
                          <Badge variant="outline" className="text-xs">Not due</Badge>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">{item.overdueDays}d</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-xs", rec.tone)}>
                          {rec.label}
                        </Badge>
                        <div className="text-xs text-muted-foreground mt-1">Ref: {item.reference}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="bg-transparent">
                            {rec.action === "hold" ? "Set Block" : rec.action === "review" ? "Request Approval" : "Send"}
                          </Button>
                          <Button size="sm" variant="ghost" className="gap-1">
                            <span className="text-xs">Create case</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                      No items match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
            <span>Showing {Math.min(200, rows.length)} of {rows.length.toLocaleString()} items</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <ShieldAlert className="h-3.5 w-3.5" />
                Guardrails applied
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                Agent suggestions
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
