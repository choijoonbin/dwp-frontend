"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  Link2,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  ArrowUpRight,
  ShieldAlert,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { mockActions, mockCompanyCodes } from "@/lib/mock-data"

const statusMeta: Record<string, { label: string; icon: any; className: string }> = {
  confirmed: { label: "Confirmed", icon: CheckCircle2, className: "bg-success/10 text-success border-success/30" },
  pending: { label: "Pending", icon: Clock, className: "bg-warning/10 text-warning border-warning/30" },
  failed: { label: "Failed", icon: XCircle, className: "bg-destructive/10 text-destructive border-destructive/30" },
}

function fmtMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function ActionReconciliationPage() {
  const [q, setQ] = useState("")
  const [company, setCompany] = useState<string>("all")
  const [status, setStatus] = useState<string>("all")

  const rows = useMemo(() => {
    const base = mockActions
      .map((a, idx) => {
        const s = idx % 10 === 0 ? "failed" : idx % 3 === 0 ? "pending" : "confirmed"
        const sapRef = `SAP-${a.id.slice(0, 8).toUpperCase()}`
        return { ...a, sapRef, sapStatus: s }
      })
      .filter((r) => {
        const compOk = company === "all" || r.companyCode === company
        const stOk = status === "all" || r.sapStatus === status
        const qOk = !q || [r.id, r.caseId, r.actionType, r.sapRef].some((v) => v.toLowerCase().includes(q.toLowerCase()))
        return compOk && stOk && qOk
      })
    return base.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [q, company, status])

  const summary = useMemo(() => {
    const total = rows.length
    const by = rows.reduce(
      (acc, r) => {
        acc[r.sapStatus] = (acc[r.sapStatus] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )
    return { total, by }
  }, [rows])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Action Reconciliation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verify whether autonomous actions were applied in SAP, and manage retries for partial or failed executions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 bg-transparent">
            <RotateCcw className="h-4 w-4" />
            Refresh Status
          </Button>
          <Button className="gap-2">
            <ArrowUpRight className="h-4 w-4" />
            Open Retry Queue
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Confirmed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(summary.by.confirmed || 0).toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Applied in SAP</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(summary.by.pending || 0).toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Awaiting callback / workflow</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(summary.by.failed || 0).toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Needs retry / investigation</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            SAP Action Verification
          </CardTitle>
          <CardDescription>Cross-check agent actions against SAP execution status.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by action id, case id, type, SAP ref..."
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={company} onValueChange={setCompany}>
                <SelectTrigger className="w-[160px]">
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
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border mt-4 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Action</TableHead>
                  <TableHead className="w-[140px]">SAP Ref</TableHead>
                  <TableHead className="w-[160px]">Type</TableHead>
                  <TableHead className="w-[220px]">Case</TableHead>
                  <TableHead className="w-[120px]">Company</TableHead>
                  <TableHead className="w-[160px]">Amount</TableHead>
                  <TableHead className="w-[140px]">SAP Status</TableHead>
                  <TableHead className="text-right w-[140px]">Ops</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 200).map((r) => {
                  const meta = statusMeta[r.sapStatus]
                  const Icon = meta.icon
                  return (
                    <TableRow key={r.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-xs">{r.id.slice(0, 10)}…</TableCell>
                      <TableCell className="font-mono text-xs">{r.sapRef}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {r.actionType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link href={`/cases/${r.caseId}`} className="text-sm font-medium hover:underline inline-flex items-center gap-1">
                          {r.caseId}
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">{r.companyCode}</TableCell>
                      <TableCell className="text-sm">{fmtMoney(r.amount, r.currency)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("gap-1", meta.className)}>
                          <Icon className="h-3.5 w-3.5" />
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-2">
                          {r.sapStatus === "failed" ? (
                            <Button size="sm" variant="outline" className="bg-transparent gap-2">
                              <RotateCcw className="h-4 w-4" />
                              Retry
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" className="bg-transparent gap-2">
                              <ShieldAlert className="h-4 w-4" />
                              Inspect
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">
                      No actions match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <Separator className="my-4" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Showing {Math.min(200, rows.length)} of {rows.length.toLocaleString()} actions</span>
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Contract-ready reconciliation
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
