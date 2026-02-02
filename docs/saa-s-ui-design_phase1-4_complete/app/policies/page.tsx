"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import {
  Sliders,
  Search,
  Filter,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Edit,
  Copy,
  CircleDollarSign,
  Timer,
  GitCompare,
} from "lucide-react"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { mockPolicies } from "@/lib/mock-data"

type PolicyProfile = {
  id: string
  name: string
  scope: string
  strictness: "pilot" | "standard" | "strict"
  duplicateWindowDays: number
  duplicateAmountTolerancePct: number
  requireAttachmentOver: number
  autoBlockSeverity: "critical" | "high" | "medium" | "low"
  enabled: boolean
}

const seedProfiles: PolicyProfile[] = [
  {
    id: "pp-1",
    name: "Global Standard",
    scope: "All tenants · Multi-company · Multi-currency",
    strictness: "standard",
    duplicateWindowDays: 30,
    duplicateAmountTolerancePct: 1,
    requireAttachmentOver: 500000,
    autoBlockSeverity: "critical",
    enabled: true,
  },
  {
    id: "pp-2",
    name: "Pilot (Low-risk Auto)",
    scope: "Tenant 200000 · Company 1000",
    strictness: "pilot",
    duplicateWindowDays: 14,
    duplicateAmountTolerancePct: 2,
    requireAttachmentOver: 1000000,
    autoBlockSeverity: "high",
    enabled: true,
  },
  {
    id: "pp-3",
    name: "Strict Audit Mode",
    scope: "Tenant 400000 · Company 2000",
    strictness: "strict",
    duplicateWindowDays: 60,
    duplicateAmountTolerancePct: 0,
    requireAttachmentOver: 300000,
    autoBlockSeverity: "high",
    enabled: false,
  },
]

function StrictnessBadge({ v }: { v: PolicyProfile["strictness"] }) {
  const map = {
    pilot: { label: "Pilot", className: "bg-muted text-muted-foreground border-border" },
    standard: { label: "Standard", className: "bg-primary/10 text-primary border-primary/30" },
    strict: { label: "Strict", className: "bg-warning/10 text-warning border-warning/30" },
  } as const
  const c = map[v]
  return <Badge variant="outline" className={cn("text-xs", c.className)}>{c.label}</Badge>
}

export default function PoliciesPage() {
  const [query, setQuery] = useState("")
  const [profiles, setProfiles] = useState<PolicyProfile[]>(seedProfiles)
  const [selected, setSelected] = useState<PolicyProfile | null>(null)

  const rows = useMemo(() => {
    return profiles
      .filter((p) => {
        if (!query) return true
        const q = query.toLowerCase()
        return p.name.toLowerCase().includes(q) || p.scope.toLowerCase().includes(q)
      })
      .sort((a, b) => (a.enabled === b.enabled ? 0 : a.enabled ? -1 : 1))
  }, [profiles, query])

  const linkedPolicies = useMemo(() => {
    return mockPolicies.slice(0, 6)
  }, [])

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Sliders className="h-6 w-6 text-primary" />
            Policy Profiles
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure tenant/company/currency-aware detection rules and compliance thresholds.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 bg-transparent">
            <Copy className="h-4 w-4" />
            Clone Profile
          </Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Profile
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Profiles</CardTitle>
                <CardDescription>Define “what counts as duplicate”, approval thresholds, and auto-block rules.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search profiles…"
                    className="pl-9 w-[240px]"
                  />
                </div>
                <Button variant="outline" size="icon" className="bg-transparent">
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Profile</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead className="w-[120px]">Strictness</TableHead>
                    <TableHead className="w-[120px]">Enabled</TableHead>
                    <TableHead className="w-[110px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => (
                    <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(p)}>
                      <TableCell>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span className="inline-flex items-center gap-1"><GitCompare className="h-3.5 w-3.5" /> {p.duplicateWindowDays}d</span>
                          <span className="inline-flex items-center gap-1"><Timer className="h-3.5 w-3.5" /> ±{p.duplicateAmountTolerancePct}%</span>
                          <span className="inline-flex items-center gap-1"><CircleDollarSign className="h-3.5 w-3.5" /> {p.requireAttachmentOver.toLocaleString()}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.scope}</TableCell>
                      <TableCell><StrictnessBadge v={p.strictness} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {p.enabled ? (
                            <Badge variant="outline" className="bg-success/10 text-success border-success/30">Active</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-muted text-muted-foreground">Disabled</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={(e) => {
                              e.stopPropagation()
                              setSelected(p)
                            }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-[720px]">
                            <DialogHeader>
                              <DialogTitle>Edit Policy Profile</DialogTitle>
                              <DialogDescription>Mock editor for enterprise policy settings (UI-only).</DialogDescription>
                            </DialogHeader>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Profile Name</Label>
                                <Input defaultValue={p.name} />
                              </div>
                              <div className="space-y-2">
                                <Label>Scope</Label>
                                <Input defaultValue={p.scope} />
                              </div>

                              <div className="space-y-2 sm:col-span-2">
                                <div className="flex items-center justify-between">
                                  <Label className="flex items-center gap-2"><GitCompare className="h-4 w-4" /> Duplicate invoice window (days)</Label>
                                  <Badge variant="outline">{p.duplicateWindowDays} days</Badge>
                                </div>
                                <Slider defaultValue={[p.duplicateWindowDays]} min={1} max={120} step={1} />
                              </div>

                              <div className="space-y-2 sm:col-span-2">
                                <div className="flex items-center justify-between">
                                  <Label className="flex items-center gap-2"><Timer className="h-4 w-4" /> Amount tolerance (%)</Label>
                                  <Badge variant="outline">±{p.duplicateAmountTolerancePct}%</Badge>
                                </div>
                                <Slider defaultValue={[p.duplicateAmountTolerancePct]} min={0} max={5} step={0.5} />
                              </div>

                              <div className="space-y-2 sm:col-span-2">
                                <div className="flex items-center justify-between">
                                  <Label className="flex items-center gap-2"><CircleDollarSign className="h-4 w-4" /> Attachment required above</Label>
                                  <Badge variant="outline">{p.requireAttachmentOver.toLocaleString()}</Badge>
                                </div>
                                <Slider defaultValue={[p.requireAttachmentOver]} min={100000} max={3000000} step={50000} />
                              </div>

                              <div className="flex items-center justify-between sm:col-span-2 rounded-lg border p-3">
                                <div>
                                  <div className="text-sm font-medium flex items-center gap-2">
                                    {p.autoBlockSeverity === "critical" ? <ShieldAlert className="h-4 w-4 text-destructive" /> : <ShieldCheck className="h-4 w-4 text-primary" />}
                                    Auto-block threshold
                                  </div>
                                  <div className="text-xs text-muted-foreground">Auto-execute payment block for cases ≥ configured severity.</div>
                                </div>
                                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">{p.autoBlockSeverity.toUpperCase()}</Badge>
                              </div>

                              <div className="flex items-center justify-between sm:col-span-2 rounded-lg border p-3">
                                <div>
                                  <div className="text-sm font-medium">Enabled</div>
                                  <div className="text-xs text-muted-foreground">When disabled, profile is not applied to scoring.</div>
                                </div>
                                <Switch defaultChecked={p.enabled} />
                              </div>
                            </div>

                            <DialogFooter>
                              <Button variant="outline" className="bg-transparent">Cancel</Button>
                              <Button onClick={() => {
                                setProfiles((prev) => prev.map((x) => x.id === p.id ? { ...x, enabled: true } : x))
                              }}>Save (Mock)</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">
                        No profiles match the current search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Linked Compliance Docs</CardTitle>
            <CardDescription>RAG source-of-truth documents powering policy citations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {linkedPolicies.map((p) => (
              <div key={p.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{p.title}</div>
                  <Badge variant="outline" className="text-xs">v{p.version}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{p.category} · updated {p.updatedAt}</div>
              </div>
            ))}
            <div className="rounded-lg border p-3 bg-muted/30">
              <div className="text-sm font-medium">Duplicate invoice definition</div>
              <div className="text-xs text-muted-foreground mt-1">
                Configure key combination and tolerance to match customer policy. (UI for future config table)
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enterprise defaults</CardTitle>
          <CardDescription>These apply when no tenant/company profile override is present.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Duplicate window</div>
            <div className="text-lg font-semibold mt-1">30 days</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Amount tolerance</div>
            <div className="text-lg font-semibold mt-1">±1%</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Default company codes</div>
            <div className="text-lg font-semibold mt-1">{mockCompanyCodes.length}</div>
          </div>
        </CardContent>
      </Card>

      {selected && (
        <div className="text-xs text-muted-foreground">
          Selected: <span className="text-foreground font-medium">{selected.name}</span>
        </div>
      )}
    </div>
  )
}
