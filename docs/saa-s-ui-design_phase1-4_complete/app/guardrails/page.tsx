"use client"

import { useMemo, useState } from "react"
import {
  Shield,
  ShieldAlert,
  ShieldX,
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  CheckCircle2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
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

type Severity = "critical" | "high" | "medium" | "low"

type Guardrail = {
  id: string
  name: string
  rule: string
  thresholdLabel?: string
  thresholdValue?: string
  enabled: boolean
  severity: Severity
}

const severityMeta: Record<Severity, { icon: any; label: string; className: string }> = {
  critical: { icon: ShieldX, label: "Critical", className: "bg-destructive/10 text-destructive border-destructive/30" },
  high: { icon: ShieldAlert, label: "High", className: "bg-warning/10 text-warning border-warning/30" },
  medium: { icon: Shield, label: "Medium", className: "bg-info/10 text-info border-info/30" },
  low: { icon: CheckCircle2, label: "Low", className: "bg-success/10 text-success border-success/30" },
}

const seedGuardrails: Guardrail[] = [
  {
    id: "gr-1",
    name: "CFO approval for large payments",
    rule: "Never approve payments over 1,000,000 (base currency) without CFO signature",
    thresholdLabel: "Amount",
    thresholdValue: "1,000,000",
    enabled: true,
    severity: "critical",
  },
  {
    id: "gr-2",
    name: "Dual approval for reversals",
    rule: "Require dual approval for any reversal action over 100,000",
    thresholdLabel: "Amount",
    thresholdValue: "100,000",
    enabled: true,
    severity: "high",
  },
  {
    id: "gr-3",
    name: "New vendor restriction",
    rule: "Block automatic payments to vendors created within the last 7 days",
    thresholdLabel: "Days",
    thresholdValue: "7",
    enabled: true,
    severity: "high",
  },
  {
    id: "gr-4",
    name: "Bank change cooldown",
    rule: "Require manual approval for payments within 72 hours of bank account change",
    thresholdLabel: "Hours",
    thresholdValue: "72",
    enabled: true,
    severity: "critical",
  },
]

export default function GuardrailsPage() {
  const [query, setQuery] = useState("")
  const [severity, setSeverity] = useState<"all" | Severity>("all")
  const [items, setItems] = useState<Guardrail[]>(seedGuardrails)
  const [dialogOpen, setDialogOpen] = useState(false)

  const rows = useMemo(() => {
    return items
      .filter((g) => {
        const q = query.trim().toLowerCase()
        if (!q) return true
        return (
          g.name.toLowerCase().includes(q) ||
          g.rule.toLowerCase().includes(q) ||
          (g.thresholdValue || "").toLowerCase().includes(q)
        )
      })
      .filter((g) => (severity === "all" ? true : g.severity === severity))
  }, [items, query, severity])

  const enabledCount = items.filter((g) => g.enabled).length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Guardrails
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define non-negotiable rules the agent must obey. These rules gate automated actions across all tenants.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Guardrail
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Create guardrail</DialogTitle>
                <DialogDescription>
                  This is a UI prototype. In production, saving here would persist to policy / governance tables.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Name</Label>
                  <Input placeholder="e.g., CFO approval for large payments" />
                </div>
                <div className="grid gap-2">
                  <Label>Rule statement</Label>
                  <Input placeholder="Never approve payments over ..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Severity</Label>
                    <Select defaultValue="high">
                      <SelectTrigger>
                        <SelectValue placeholder="Severity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Threshold</Label>
                    <Input placeholder="e.g., 1,000,000" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" className="bg-transparent" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setDialogOpen(false)}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Enabled guardrails</CardTitle>
            <CardDescription className="text-xs">Active protections enforced by the agent</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{enabledCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Critical rules</CardTitle>
            <CardDescription className="text-xs">Cannot be bypassed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{items.filter((g) => g.severity === "critical").length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Common patterns</CardTitle>
            <CardDescription className="text-xs">Amount caps, bank-change cooldown, SoD</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Amount cap</Badge>
              <Badge variant="outline">Cooldown</Badge>
              <Badge variant="outline">Dual approval</Badge>
              <Badge variant="outline">New vendor</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersTitle />
          </CardTitle>
          <CardDescription>
            Toggle guardrails on/off, set severity, and review the exact constraint enforced.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search guardrails..."
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Filter className="h-3.5 w-3.5" />
                Filter
              </Badge>
              <Select value={severity} onValueChange={(v) => setSeverity(v as any)}>
                <SelectTrigger className="w-[180px]">
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
          </div>

          <div className="divide-y rounded-lg border">
            {rows.map((g) => {
              const meta = severityMeta[g.severity]
              const Icon = meta.icon
              return (
                <div key={g.id} className="p-4 flex flex-col lg:flex-row lg:items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{g.name}</span>
                          <Badge variant="outline" className={cn("gap-1", meta.className)}>
                            <Icon className="h-3.5 w-3.5" />
                            {meta.label}
                          </Badge>
                          {!g.enabled && (
                            <Badge variant="outline" className="text-xs">disabled</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{g.rule}</p>
                        {(g.thresholdLabel || g.thresholdValue) && (
                          <div className="text-xs text-muted-foreground mt-2">
                            Threshold: <span className="text-foreground">{g.thresholdLabel}</span> = {" "}
                            <span className="text-foreground">{g.thresholdValue}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={g.enabled}
                          onCheckedChange={(v) =>
                            setItems((prev) => prev.map((x) => (x.id === g.id ? { ...x, enabled: v } : x)))
                          }
                        />
                        <Button variant="outline" size="icon" className="bg-transparent">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="bg-transparent"
                          onClick={() => setItems((prev) => prev.filter((x) => x.id !== g.id))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            {rows.length === 0 && (
              <div className="p-10 text-sm text-muted-foreground text-center">No guardrails match the current filters.</div>
            )}
          </div>

          <Separator className="my-4" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Showing {rows.length.toLocaleString()} rules</span>
            <Badge variant="outline" className="gap-1">
              <Shield className="h-3.5 w-3.5" />
              Enforced at action-time
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SlidersTitle() {
  return (
    <div className="flex items-center gap-2">
      <ShieldAlert className="h-5 w-5 text-primary" />
      Guardrail Ruleset
    </div>
  )
}
