"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  Sliders,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ArrowUpRight,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type AutonomyLevel = 1 | 3 | 5

const anomalyTypes = [
  { key: "duplicate_invoice", label: "Duplicate Invoice" },
  { key: "policy_violation", label: "Policy Violation" },
  { key: "bank_change", label: "Bank Change Risk" },
  { key: "late_payment", label: "AR Late Payment" },
] as const

function levelLabel(level: AutonomyLevel) {
  if (level === 1) return { label: "Human Only", icon: ShieldX }
  if (level === 3) return { label: "AI Proposes + Human Approves", icon: ShieldAlert }
  return { label: "Fully Autonomous", icon: ShieldCheck }
}

export default function AutonomyPage() {
  const [scope, setScope] = useState("tenant")
  const [currency, setCurrency] = useState("USD")
  const [globalLevel, setGlobalLevel] = useState<AutonomyLevel>(3)
  const [override, setOverride] = useState<Record<string, AutonomyLevel>>({
    duplicate_invoice: 3,
    policy_violation: 1,
    bank_change: 1,
    late_payment: 3,
  })
  const [simulationRequired, setSimulationRequired] = useState(true)

  const globalMeta = useMemo(() => levelLabel(globalLevel), [globalLevel])
  const GlobalIcon = globalMeta.icon

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Autonomy Level</h1>
          <p className="text-sm text-muted-foreground">Control how far the agent can go without human approval. Use this page for fast tuning; the full governance workspace lives in <Link className="underline underline-offset-4" href="/governance">Governance & Configuration</Link>.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Sparkles className="h-3.5 w-3.5" />
            Guardrails enforced
          </Badge>
          <Button asChild variant="outline" className="bg-transparent gap-2">
            <Link href="/governance">
              Open Governance
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sliders className="h-5 w-5 text-primary" /> Scope & Defaults</CardTitle>
          <CardDescription>Apply defaults at tenant/company/currency scope and override per anomaly type.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Scope</div>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger><SelectValue placeholder="Select scope" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tenant">Tenant-wide</SelectItem>
                  <SelectItem value="company">Company code</SelectItem>
                  <SelectItem value="currency">Currency</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Currency (optional)</div>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue placeholder="Currency" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="KRW">KRW</SelectItem>
                  <SelectItem value="JPY">JPY</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Simulation Required</div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">Pre-execution simulation</span>
                <Switch checked={simulationRequired} onCheckedChange={setSimulationRequired} />
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Default autonomy</div>
                  <div className="text-xs text-muted-foreground">Used when no override exists.</div>
                </div>
                <Badge variant="outline" className={cn("gap-1", globalLevel === 1 ? "border-destructive/30 text-destructive" : globalLevel === 3 ? "border-warning/30 text-warning" : "border-success/30 text-success")}>
                  <GlobalIcon className="h-3.5 w-3.5" />
                  {globalMeta.label}
                </Badge>
              </div>
              <div className="mt-4">
                <Slider
                  value={[globalLevel]}
                  min={1}
                  max={5}
                  step={2}
                  onValueChange={(v) => setGlobalLevel((v[0] as AutonomyLevel) ?? 3)}
                />
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>1</span>
                  <span>3</span>
                  <span>5</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="text-sm font-medium">Override coverage</div>
              <div className="text-xs text-muted-foreground">How many anomaly types explicitly override the default.</div>
              <div className="mt-4 flex items-end justify-between">
                <div className="text-3xl font-semibold">{Object.keys(override).length}/{anomalyTypes.length}</div>
                <Badge variant="outline" className="gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  Policy-driven
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Per anomaly-type autonomy</div>
                <div className="text-xs text-muted-foreground">Enterprise pattern: strict for money movement, flexible for notifications.</div>
              </div>
              <Button variant="outline" className="bg-transparent">Reset to defaults</Button>
            </div>
            <div className="rounded-lg border overflow-hidden">
              {anomalyTypes.map((t) => {
                const level = override[t.key] ?? globalLevel
                const meta = levelLabel(level)
                const Icon = meta.icon
                return (
                  <div key={t.key} className="flex items-center justify-between gap-4 p-3 border-b last:border-b-0">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{t.label}</div>
                      <div className="text-xs text-muted-foreground">Autonomy for this detection category</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={String(level)} onValueChange={(v) => setOverride((prev) => ({ ...prev, [t.key]: Number(v) as AutonomyLevel }))}>
                        <SelectTrigger className="w-[260px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Level 1 — Human Only</SelectItem>
                          <SelectItem value="3">Level 3 — AI Proposes + Approves</SelectItem>
                          <SelectItem value="5">Level 5 — Fully Autonomous</SelectItem>
                        </SelectContent>
                      </Select>
                      <Badge variant="outline" className={cn("gap-1", level === 1 ? "border-destructive/30 text-destructive" : level === 3 ? "border-warning/30 text-warning" : "border-success/30 text-success")}>
                        <Icon className="h-3.5 w-3.5" />
                        {meta.label}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Where this is enforced</CardTitle>
          <CardDescription>In production, the autonomy level is evaluated at action-time in the backend before any SAP workflow call.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Use this screen for rapid tuning with stakeholders. The authoritative policy is still stored in the Policy Profiles and Guardrails modules.
        </CardContent>
      </Card>
    </div>
  )
}
