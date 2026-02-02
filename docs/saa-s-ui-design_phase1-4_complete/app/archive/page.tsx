"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  Archive,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  Download,
  ChevronDown,
  Zap,
  RotateCcw,
} from "lucide-react"
import { cn } from "@/lib/utils"
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { mockActions, mockCases, type Action } from "@/lib/mock-data"
import { SeverityBadge } from "@/components/finance/severity-badge"

const statusMeta: Record<string, { label: string; icon: any; cls: string }> = {
  completed: { label: "Completed", icon: CheckCircle2, cls: "bg-success/10 text-success border-success/30" },
  failed: { label: "Failed", icon: XCircle, cls: "bg-destructive/10 text-destructive border-destructive/30" },
  pending: { label: "Pending", icon: Clock, cls: "bg-warning/10 text-warning border-warning/30" },
}

function formatMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function ArchivePage() {
  const [q, setQ] = useState("")
  const [status, setStatus] = useState<string>("all")
  const [type, setType] = useState<string>("all")
  const [selected, setSelected] = useState<Action | null>(null)

  const rows = useMemo(() => {
    return mockActions
      .filter((a) => {
        if (status !== "all" && a.status !== status) return false
        if (type !== "all" && a.type !== type) return false
        if (q) {
          const s = q.toLowerCase()
          return (
            a.id.toLowerCase().includes(s) ||
            (a.caseId || "").toLowerCase().includes(s) ||
            (a.description || "").toLowerCase().includes(s)
          )
        }
        return true
      })
      .slice()
      .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
  }, [q, status, type])

  const completedCount = mockActions.filter((a) => a.status === "completed").length
  const failedCount = mockActions.filter((a) => a.status === "failed").length
  const pendingCount = mockActions.filter((a) => a.status === "pending").length

  const uniqueTypes = Array.from(new Set(mockActions.map((a) => a.type)))

  const linkedCase = selected?.caseId ? mockCases.find((c) => c.id === selected.caseId) : undefined

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Archive className="h-6 w-6 text-primary" />
            Action Archive
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review executed actions, outcomes, before/after deltas, and audit-ready artifacts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 bg-transparent">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Replay Simulation
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-success/5 border-success/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Completed
              <CheckCircle2 className="h-4 w-4 text-success" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCount}</div>
            <p className="text-xs text-muted-foreground">Executed successfully</p>
          </CardContent>
        </Card>
        <Card className="bg-warning/5 border-warning/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Pending
              <Clock className="h-4 w-4 text-warning" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">Awaiting execution/approval</p>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Failed
              <XCircle className="h-4 w-4 text-destructive" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{failedCount}</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            Search & Filters
          </CardTitle>
          <CardDescription className="text-xs">Filter by status, action type, and linked case.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search action id, case id, description…" className="pl-9" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full lg:w-[200px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-full lg:w-[240px]">
                <SelectValue placeholder="Action type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {uniqueTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            Action Records
          </CardTitle>
          <CardDescription className="text-xs">Click a row to open the audit-ready action detail drawer.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Linked Case</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a) => {
                  const meta = statusMeta[a.status] || { label: a.status, icon: Clock, cls: "bg-muted" }
                  const Icon = meta.icon
                  return (
                    <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(a)}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{a.id}</span>
                          {a.simulation && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                              Simulated
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{a.description}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("gap-1", meta.cls)}>
                          <Icon className="h-3.5 w-3.5" />
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{a.type}</TableCell>
                      <TableCell>
                        {a.caseId ? (
                          <Link href={`/cases/${a.caseId}`} className="text-sm inline-flex items-center gap-1 hover:underline" onClick={(e) => e.stopPropagation()}>
                            {a.caseId}
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {typeof a.amount === "number" ? formatMoney(a.amount) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</TableCell>
                    </TableRow>
                  )
                })}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                      No actions match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl">
          {selected && (
            <div className="h-full flex flex-col">
              <SheetHeader>
                <SheetTitle className="flex items-center justify-between gap-2">
                  <span className="truncate">{selected.id}</span>
                  <Badge variant="outline" className={cn("gap-1", (statusMeta[selected.status] || statusMeta.pending).cls)}>
                    {(() => {
                      const Icon = (statusMeta[selected.status] || statusMeta.pending).icon
                      return <Icon className="h-3.5 w-3.5" />
                    })()}
                    {(statusMeta[selected.status] || statusMeta.pending).label}
                  </Badge>
                </SheetTitle>
                <SheetDescription>{selected.description}</SheetDescription>
              </SheetHeader>

              <Separator className="my-4" />

              <div className="flex-1 overflow-auto space-y-4 pr-1">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Execution Summary</CardTitle>
                    <CardDescription className="text-xs">Audit-ready metadata for this action.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Type</p>
                      <p className="font-medium">{selected.type}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Created</p>
                      <p className="font-medium">{new Date(selected.createdAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Amount</p>
                      <p className="font-medium font-mono">{typeof selected.amount === "number" ? formatMoney(selected.amount) : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Simulation</p>
                      <p className="font-medium">{selected.simulation ? "Pre-execution simulation applied" : "—"}</p>
                    </div>
                  </CardContent>
                </Card>

                {linkedCase && (
                  <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Linked Case</CardTitle>
                      <CardDescription className="text-xs">The anomaly case that triggered this action.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{linkedCase.caseNumber}</span>
                            <SeverityBadge severity={linkedCase.severity} size="sm" />
                          </div>
                          <p className="text-xs text-muted-foreground">{linkedCase.title}</p>
                        </div>
                        <Button asChild size="sm" className="gap-1">
                          <Link href={`/cases/${linkedCase.id}`}>
                            Open
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Before / After</CardTitle>
                    <CardDescription className="text-xs">Mocked delta highlights for demonstration (to be wired to real SAP diffs).</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="rounded-md border p-3 bg-muted/30">
                      <p className="text-xs text-muted-foreground mb-2">Fields updated</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-md border bg-background p-2">
                          <p className="text-[11px] text-muted-foreground">Payment Block</p>
                          <p className="font-mono">None → A (Locked)</p>
                        </div>
                        <div className="rounded-md border bg-background p-2">
                          <p className="text-[11px] text-muted-foreground">Workflow</p>
                          <p className="font-mono">— → Approval Requested</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="gap-1">
                        <ChevronDown className="h-3.5 w-3.5" />
                        Evidence attached
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <ChevronDown className="h-3.5 w-3.5" />
                        Guardrail checks
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Separator className="my-4" />
              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" className="gap-2 bg-transparent">
                  <Download className="h-4 w-4" />
                  Download Audit Package
                </Button>
                <Button className="gap-2">
                  <ArrowUpRight className="h-4 w-4" />
                  Send to Reconciliation
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
