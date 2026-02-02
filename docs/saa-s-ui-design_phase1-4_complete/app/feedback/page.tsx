"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  MessageSquareQuote,
  Search,
  Filter,
  ThumbsUp,
  ThumbsDown,
  Wand2,
  ArrowUpRight,
  Download,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { SeverityBadge } from "@/components/finance/severity-badge"
import { mockCases } from "@/lib/mock-data"

type FeedbackLabel = "tp" | "fp" | "fn" | "needs_review"

const labelMeta: Record<FeedbackLabel, { label: string; className: string }> = {
  tp: { label: "True Positive", className: "bg-success/10 text-success border-success/30" },
  fp: { label: "False Positive", className: "bg-warning/10 text-warning border-warning/30" },
  fn: { label: "False Negative", className: "bg-destructive/10 text-destructive border-destructive/30" },
  needs_review: { label: "Needs Review", className: "bg-muted text-muted-foreground border-border" },
}

export default function FeedbackPage() {
  const [q, setQ] = useState("")
  const [severity, setSeverity] = useState<string>("all")
  const [label, setLabel] = useState<FeedbackLabel>("needs_review")
  const [suggestion, setSuggestion] = useState("")

  const rows = useMemo(() => {
    const base = mockCases
      .filter((c) => ["open", "triage", "review"].includes(String(c.status)))
      .map((c) => ({
        caseId: c.id,
        title: c.title,
        severity: c.severity,
        anomalyType: c.anomalyType,
        createdAt: c.createdAt,
        confidence: c.confidence,
      }))

    return base.filter((r) => {
      const text = `${r.caseId} ${r.title} ${r.anomalyType}`.toLowerCase()
      const okQ = !q || text.includes(q.toLowerCase())
      const okS = severity === "all" || r.severity === severity
      return okQ && okS
    })
  }, [q, severity])

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <MessageSquareQuote className="h-5 w-5 text-primary" />
            Feedback & Labeling
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Human-in-the-loop quality loop: label outcomes, attach rationale, and generate policy suggestions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 bg-transparent">
            <Download className="h-4 w-4" />
            Export Labels (CSV)
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Wand2 className="h-4 w-4" />
                Policy Suggestion
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Policy Suggestion (Mock)</DialogTitle>
                <DialogDescription>
                  Turn a labeling decision into a concrete policy or prompt adjustment proposal.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Label</Label>
                  <Select value={label} onValueChange={(v) => setLabel(v as FeedbackLabel)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(labelMeta).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Suggestion</Label>
                  <Textarea
                    value={suggestion}
                    onChange={(e) => setSuggestion(e.target.value)}
                    placeholder="e.g., Tighten duplicate detection for vendors with bank change within 72 hours..."
                    className="min-h-[120px]"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" className="bg-transparent" onClick={() => setSuggestion("")}
                >
                  Reset
                </Button>
                <Button onClick={() => { /* mock */ }}>
                  Submit
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            Labeling Queue
          </CardTitle>
          <CardDescription className="text-xs">Prioritize ambiguous cases for rapid quality improvement.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-2 lg:items-center lg:justify-between">
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search cases, titles, anomaly types…"
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All severity</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Anomaly Type</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Label</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 200).map((r) => (
                  <TableRow key={r.caseId} className="hover:bg-muted/40">
                    <TableCell>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-medium text-sm">{r.title}</div>
                          <div className="text-xs text-muted-foreground">{r.caseId}</div>
                        </div>
                        <Link
                          href={`/cases/${encodeURIComponent(r.caseId)}`}
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                        >
                          Review <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell><SeverityBadge severity={r.severity as any} size="sm" /></TableCell>
                    <TableCell className="text-xs">{r.anomalyType}</TableCell>
                    <TableCell className="text-xs">{Math.round((r.confidence ?? 0) * 100)}%</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button variant="outline" size="sm" className="gap-1 bg-transparent">
                          <ThumbsUp className="h-3.5 w-3.5" /> TP
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1 bg-transparent">
                          <ThumbsDown className="h-3.5 w-3.5" /> FP
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                      No cases match your current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <Separator className="my-4" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Showing {Math.min(200, rows.length)} of {rows.length.toLocaleString()} cases</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn("border", labelMeta.needs_review.className)}>
                {labelMeta.needs_review.label}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Wand2 className="h-3.5 w-3.5" />
                Policy Suggestion
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
