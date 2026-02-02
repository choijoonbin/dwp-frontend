"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import {
  BookOpen,
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Hash,
  Building2,
  BadgeCheck,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type DictionaryEntry = {
  id: string
  type: "abbreviation" | "entity_code" | "account" | "cost_center" | "tcode"
  key: string
  value: string
  description?: string
  confidence?: number
  source?: "seed" | "user" | "sap" | "ml"
}

const seed: DictionaryEntry[] = [
  { id: "dict-1", type: "abbreviation", key: "Mtg", value: "Meeting", description: "Common short-hand in free text", confidence: 0.94, source: "seed" },
  { id: "dict-2", type: "tcode", key: "FB60", value: "Enter Vendor Invoice", description: "FI - Accounts Payable", confidence: 0.99, source: "sap" },
  { id: "dict-3", type: "tcode", key: "MIRO", value: "Enter Incoming Invoice", description: "MM - Logistics Invoice Verification", confidence: 0.99, source: "sap" },
  { id: "dict-4", type: "account", key: "510030", value: "Entertainment", description: "Policy-sensitive account", confidence: 0.9, source: "seed" },
  { id: "dict-5", type: "cost_center", key: "CC-1200", value: "Sales - APAC", description: "Regional sales org", confidence: 0.86, source: "user" },
  { id: "dict-6", type: "entity_code", key: "LIFNR", value: "Vendor", description: "SAP entity identifier", confidence: 0.95, source: "sap" },
]

const typeMeta: Record<DictionaryEntry["type"], { label: string; badge: string }> = {
  abbreviation: { label: "Abbreviation", badge: "bg-info/10 text-info border-info/30" },
  entity_code: { label: "Entity Code", badge: "bg-muted/40 text-foreground border-border" },
  account: { label: "Account", badge: "bg-warning/10 text-warning border-warning/30" },
  cost_center: { label: "Cost Center", badge: "bg-primary/10 text-primary border-primary/30" },
  tcode: { label: "T-Code", badge: "bg-success/10 text-success border-success/30" },
}

const sourceMeta: Record<NonNullable<DictionaryEntry["source"]>, { label: string; icon: any }> = {
  seed: { label: "Seed", icon: Hash },
  user: { label: "User", icon: Edit },
  sap: { label: "SAP", icon: Building2 },
  ml: { label: "ML", icon: BadgeCheck },
}

export default function DictionaryPage() {
  const [q, setQ] = useState("")
  const [type, setType] = useState<string>("all")
  const [items, setItems] = useState<DictionaryEntry[]>(seed)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Partial<DictionaryEntry>>({ type: "abbreviation" })

  const rows = useMemo(() => {
    return items.filter((d) => {
      if (type !== "all" && d.type !== type) return false
      if (!q) return true
      const s = `${d.key} ${d.value} ${d.description ?? ""}`.toLowerCase()
      return s.includes(q.toLowerCase())
    })
  }, [items, q, type])

  const saveDraft = () => {
    const key = (draft.key ?? "").trim()
    const value = (draft.value ?? "").trim()
    if (!key || !value) return

    const id = draft.id ?? `dict-${Math.random().toString(16).slice(2)}`
    const next: DictionaryEntry = {
      id,
      type: (draft.type as any) ?? "abbreviation",
      key,
      value,
      description: (draft.description ?? "").trim() || undefined,
      confidence: draft.confidence ?? 0.85,
      source: draft.source ?? "user",
    }

    setItems((prev) => {
      const exists = prev.some((p) => p.id === id)
      return exists ? prev.map((p) => (p.id === id ? next : p)) : [next, ...prev]
    })

    setOpen(false)
    setDraft({ type: "abbreviation" })
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Enterprise Dictionary
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Abbreviations, entity codes, accounts, and SAP-specific vocabulary used for robust text understanding
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add entry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{draft.id ? "Edit entry" : "New entry"}</DialogTitle>
              <DialogDescription>Dictionary entries improve parsing of short-hand text and governance consistency.</DialogDescription>
            </DialogHeader>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={String(draft.type ?? "abbreviation")} onValueChange={(v) => setDraft((p) => ({ ...p, type: v as any }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(typeMeta).map((k) => (
                      <SelectItem key={k} value={k}>
                        {typeMeta[k as DictionaryEntry["type"]].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Source</Label>
                <Select value={String(draft.source ?? "user")} onValueChange={(v) => setDraft((p) => ({ ...p, source: v as any }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(sourceMeta).map((k) => (
                      <SelectItem key={k} value={k}>
                        {sourceMeta[k as keyof typeof sourceMeta].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Key</Label>
                <Input value={draft.key ?? ""} onChange={(e) => setDraft((p) => ({ ...p, key: e.target.value }))} placeholder="e.g., Mtg / FB60 / 510030" />
              </div>

              <div className="space-y-2">
                <Label>Value</Label>
                <Input value={draft.value ?? ""} onChange={(e) => setDraft((p) => ({ ...p, value: e.target.value }))} placeholder="e.g., Meeting / Enter Vendor Invoice" />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Description</Label>
                <Input value={draft.description ?? ""} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} placeholder="Optional context (policy-sensitive, org mapping, etc.)" />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" className="bg-transparent" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveDraft}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search keys, values, and descriptions..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-2 text-xs">
                <Filter className="h-3.5 w-3.5" />
                Type
              </Badge>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {Object.keys(typeMeta).map((k) => (
                    <SelectItem key={k} value={k}>
                      {typeMeta[k as DictionaryEntry["type"]].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Entries</CardTitle>
          <CardDescription className="text-xs">Used by extraction, classification, and policy-aware parsing.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[140px]">Type</TableHead>
                  <TableHead className="w-[170px]">Key</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="hidden lg:table-cell">Description</TableHead>
                  <TableHead className="w-[120px]">Source</TableHead>
                  <TableHead className="w-[120px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 200).map((d) => {
                  const t = typeMeta[d.type]
                  const s = d.source ? sourceMeta[d.source] : null
                  const SIcon = s?.icon

                  return (
                    <TableRow key={d.id} className="hover:bg-muted/30">
                      <TableCell>
                        <Badge variant="outline" className={cn("text-xs", t.badge)}>
                          {t.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{d.key}</TableCell>
                      <TableCell className="text-sm">{d.value}</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{d.description ?? "—"}</TableCell>
                      <TableCell>
                        {s ? (
                          <Badge variant="outline" className="gap-1 text-xs">
                            {SIcon ? <SIcon className="h-3.5 w-3.5" /> : null}
                            {s.label}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-transparent gap-1"
                            onClick={() => {
                              setDraft(d)
                              setOpen(true)
                            }}
                          >
                            <Edit className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-transparent gap-1"
                            onClick={() => setItems((prev) => prev.filter((x) => x.id !== d.id))}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}

                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                      No dictionary entries match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
            <span>Showing {Math.min(200, rows.length)} of {rows.length.toLocaleString()} entries</span>
            <Badge variant="outline" className="gap-1">
              <Hash className="h-3.5 w-3.5" />
              Used in extraction
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
