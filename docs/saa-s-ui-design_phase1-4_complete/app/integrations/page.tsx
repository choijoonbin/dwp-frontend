"use client"

import { useMemo, useState } from "react"
import {
  PlugZap,
  Cloud,
  Cable,
  Database,
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCcw,
  Search,
  Filter,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Channel = {
  id: string
  name: string
  type: "s3" | "jco" | "idoc" | "api" | "milvus" | "postgres"
  status: "healthy" | "degraded" | "down"
  lastHeartbeat: string
  lagSeconds: number
  throughputPerMin: number
}

type IngestionIssue = {
  id: string
  channelId: string
  severity: "critical" | "high" | "medium" | "low"
  title: string
  details: string
  at: string
}

const channels: Channel[] = [
  {
    id: "sap-s3",
    name: "SAP Extract via S3",
    type: "s3",
    status: "healthy",
    lastHeartbeat: new Date(Date.now() - 2 * 60_000).toISOString(),
    lagSeconds: 120,
    throughputPerMin: 2400,
  },
  {
    id: "sap-jco",
    name: "SAP RFC (JCo)",
    type: "jco",
    status: "degraded",
    lastHeartbeat: new Date(Date.now() - 8 * 60_000).toISOString(),
    lagSeconds: 520,
    throughputPerMin: 380,
  },
  {
    id: "sap-idoc",
    name: "IDoc Listener",
    type: "idoc",
    status: "healthy",
    lastHeartbeat: new Date(Date.now() - 3 * 60_000).toISOString(),
    lagSeconds: 210,
    throughputPerMin: 1100,
  },
  {
    id: "milvus",
    name: "Milvus Vector Store",
    type: "milvus",
    status: "healthy",
    lastHeartbeat: new Date(Date.now() - 1 * 60_000).toISOString(),
    lagSeconds: 0,
    throughputPerMin: 0,
  },
  {
    id: "postgres",
    name: "PostgreSQL (Self-healing schema)",
    type: "postgres",
    status: "healthy",
    lastHeartbeat: new Date(Date.now() - 1 * 60_000).toISOString(),
    lagSeconds: 0,
    throughputPerMin: 0,
  },
]

const issues: IngestionIssue[] = [
  {
    id: "iss_001",
    channelId: "sap-jco",
    severity: "high",
    title: "RFC latency spike",
    details: "Avg response time exceeded 2s (p95). Consider failover to S3 batch for non-urgent loads.",
    at: new Date(Date.now() - 12 * 60_000).toISOString(),
  },
  {
    id: "iss_002",
    channelId: "sap-jco",
    severity: "medium",
    title: "Transient auth errors",
    details: "3 retries succeeded after token refresh. Validate rotation schedule.",
    at: new Date(Date.now() - 42 * 60_000).toISOString(),
  },
  {
    id: "iss_003",
    channelId: "sap-idoc",
    severity: "low",
    title: "Out-of-order message",
    details: "Received IDoc sequence gap; ingestion reconciled via dedupe keys.",
    at: new Date(Date.now() - 3 * 60 * 60_000).toISOString(),
  },
]

function statusMeta(status: Channel["status"]) {
  if (status === "healthy") return { label: "Healthy", icon: CheckCircle2, className: "bg-success/10 text-success border-success/30" }
  if (status === "degraded") return { label: "Degraded", icon: AlertTriangle, className: "bg-warning/10 text-warning border-warning/30" }
  return { label: "Down", icon: AlertTriangle, className: "bg-destructive/10 text-destructive border-destructive/30" }
}

function severityMeta(sev: IngestionIssue["severity"]) {
  const map: Record<IngestionIssue["severity"], string> = {
    critical: "bg-destructive/10 text-destructive border-destructive/20",
    high: "bg-warning/10 text-warning border-warning/20",
    medium: "bg-info/10 text-info border-info/20",
    low: "bg-success/10 text-success border-success/20",
  }
  return map[sev]
}

function iconByType(type: Channel["type"]) {
  switch (type) {
    case "s3":
      return Cloud
    case "jco":
      return Cable
    case "idoc":
      return PlugZap
    case "api":
      return Activity
    case "milvus":
      return Database
    case "postgres":
      return Database
  }
}

export default function IntegrationsPage() {
  const [q, setQ] = useState("")
  const [channel, setChannel] = useState<string>("all")

  const filtered = useMemo(() => {
    let rows = issues
    if (channel !== "all") rows = rows.filter((i) => i.channelId === channel)
    if (q.trim()) {
      const qq = q.toLowerCase()
      rows = rows.filter((i) => i.title.toLowerCase().includes(qq) || i.details.toLowerCase().includes(qq))
    }
    return rows.sort((a, b) => (a.at < b.at ? 1 : -1))
  }, [q, channel])

  const channelStats = useMemo(() => {
    const totals = {
      healthy: channels.filter((c) => c.status === "healthy").length,
      degraded: channels.filter((c) => c.status === "degraded").length,
      down: channels.filter((c) => c.status === "down").length,
    }
    return {
      ...totals,
      total: channels.length,
      healthPct: Math.round((totals.healthy / channels.length) * 100),
    }
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Integrations & Data Ops</h1>
          <p className="text-sm text-muted-foreground">Monitor ingestion channels (S3/JCo/IDoc/API) and data pipeline health for audit-grade operations.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="bg-transparent gap-2">
            <RefreshCcw className="h-4 w-4" />
            Reprocess Queue
          </Button>
          <Button className="gap-2">
            <PlugZap className="h-4 w-4" />
            Add Integration
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Channel health</CardTitle>
            <CardDescription>Aggregated from heartbeats</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{channelStats.healthPct}%</div>
            <div className="mt-2">
              <Progress value={channelStats.healthPct} />
            </div>
            <div className="mt-3 text-xs text-muted-foreground flex items-center justify-between">
              <span>{channelStats.healthy} healthy</span>
              <span>{channelStats.degraded} degraded</span>
              <span>{channelStats.down} down</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Throughput</CardTitle>
            <CardDescription>Records per minute</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{channels.reduce((s, c) => s + c.throughputPerMin, 0).toLocaleString()}</div>
            <div className="mt-3 text-xs text-muted-foreground">Includes batch + realtime channels</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Max lag</CardTitle>
            <CardDescription>Worst channel delay</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{Math.max(...channels.map((c) => c.lagSeconds))}s</div>
            <div className="mt-3 text-xs text-muted-foreground">Auto-escalate if lag exceeds policy thresholds</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Integration Channels</CardTitle>
          <CardDescription>Realtime heartbeat, lag and readiness indicators.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {channels.map((c) => {
              const meta = statusMeta(c.status)
              const Icon = iconByType(c.type)
              const M = meta.icon
              return (
                <div key={c.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-md border flex items-center justify-center">
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">Last heartbeat: {new Date(c.lastHeartbeat).toLocaleString()}</div>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn("gap-1 border", meta.className)}>
                      <M className="h-3.5 w-3.5" />
                      {meta.label}
                    </Badge>
                  </div>

                  <Separator className="my-3" />
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Lag</div>
                      <div className="font-medium">{c.lagSeconds}s</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Throughput</div>
                      <div className="font-medium">{c.throughputPerMin.toLocaleString()}/min</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Type</div>
                      <div className="font-medium uppercase">{c.type}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ingestion Issues</CardTitle>
          <CardDescription>Operational incidents that impact traceability and reconciliation.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="w-[260px] pl-9" placeholder="Search issues…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All channels</SelectItem>
                  {channels.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" className="bg-transparent gap-2">
              <Filter className="h-4 w-4" />
              Advanced filters
            </Button>
          </div>

          <div className="mt-4 rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 200).map((i) => {
                  const c = channels.find((x) => x.id === i.channelId)
                  return (
                    <TableRow key={i.id} className="hover:bg-muted/40">
                      <TableCell className="text-xs text-muted-foreground">{new Date(i.at).toLocaleString()}</TableCell>
                      <TableCell className="text-sm">{c?.name ?? i.channelId}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("border", severityMeta(i.severity))}>
                          {i.severity.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{i.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{i.details}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" className="bg-transparent gap-2">
                          <RefreshCcw className="h-4 w-4" />
                          Retry
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      No issues match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <Separator className="my-4" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Showing {Math.min(200, filtered.length)} of {filtered.length.toLocaleString()} issues</span>
            <Badge variant="outline" className="gap-1">
              <Database className="h-3.5 w-3.5" />
              ingestion-observable
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
