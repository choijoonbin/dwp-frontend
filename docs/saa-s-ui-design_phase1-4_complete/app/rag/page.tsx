"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import {
  Library,
  Upload,
  Search,
  Filter,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Quote,
  Sparkles,
  ExternalLink,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { mockPolicies } from "@/lib/mock-data"

type DocStatus = "indexed" | "indexing" | "error"

const mockDocs = mockPolicies.map((p, idx) => {
  const status: DocStatus = idx % 11 === 0 ? "error" : idx % 4 === 0 ? "indexing" : "indexed"
  const pages = 8 + (idx % 24)
  const chunks = 120 + (idx * 17) % 420
  return {
    id: `doc-${idx + 1}`,
    title: p.title,
    category: p.category,
    version: p.version,
    lastUpdated: p.updatedAt,
    pages,
    chunks,
    status,
    notes: p.description,
  }
})

function StatusBadge({ status }: { status: DocStatus }) {
  const cfg = {
    indexed: { icon: CheckCircle2, label: "Indexed", className: "bg-success/10 text-success border-success/20" },
    indexing: { icon: Clock, label: "Indexing", className: "bg-warning/10 text-warning border-warning/20" },
    error: { icon: AlertTriangle, label: "Error", className: "bg-destructive/10 text-destructive border-destructive/20" },
  } as const
  const { icon: Icon, label, className } = cfg[status]
  return (
    <Badge variant="outline" className={cn("gap-1", className)}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Badge>
  )
}

export default function RAGLibraryPage() {
  const [q, setQ] = useState("")
  const [category, setCategory] = useState<string>("all")
  const [status, setStatus] = useState<string>("all")
  const [selectedId, setSelectedId] = useState<string | null>(mockDocs[0]?.id ?? null)

  const categories = useMemo(() => {
    const set = new Set<string>()
    mockDocs.forEach(d => set.add(d.category))
    return Array.from(set)
  }, [])

  const rows = useMemo(() => {
    return mockDocs
      .filter(d => {
        if (q) {
          const query = q.toLowerCase()
          if (!d.title.toLowerCase().includes(query) && !d.notes.toLowerCase().includes(query)) return false
        }
        if (category !== "all" && d.category !== category) return false
        if (status !== "all" && d.status !== status) return false
        return true
      })
      .slice(0, 200)
  }, [q, category, status])

  const selected = useMemo(() => mockDocs.find(d => d.id === selectedId) ?? null, [selectedId])

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Library className="h-6 w-6 text-primary" />
            RAG Library
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage compliance documents and track indexing health for explainable AI decisions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Upload className="h-4 w-4" />
                Upload Policy Doc
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Upload document (mock)</DialogTitle>
                <DialogDescription>
                  In production, this will store the raw file, extract text, and create embeddings in Milvus.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Category</p>
                    <Input placeholder="Internal Control / Tax / Audit" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Version</p>
                    <Input placeholder="v2026.01" />
                  </div>
                </div>
                <div className="border rounded-lg p-6 text-sm text-muted-foreground flex items-center justify-center">
                  Drag & drop files here (PDF/TXT) — mocked for UI
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="gap-1">
                    <Sparkles className="h-3.5 w-3.5" />
                    Automatic chunking + embedding
                  </Badge>
                  <Button>Start indexing</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockDocs.length}</div>
            <p className="text-xs text-muted-foreground">Across all tenants (mock)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Indexed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockDocs.filter(d => d.status === "indexed").length}</div>
            <p className="text-xs text-muted-foreground">Ready for citations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Attention needed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockDocs.filter(d => d.status !== "indexed").length}</div>
            <p className="text-xs text-muted-foreground">Indexing / errors</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Document Library
          </CardTitle>
          <CardDescription>Search, filter, and inspect the exact evidence returned to users.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-3" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search docs…" className="pl-9" />
            </div>
            <div className="flex items-center gap-2">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="indexed">Indexed</SelectItem>
                  <SelectItem value="indexing">Indexing</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="gap-2 bg-transparent">
                <Filter className="h-4 w-4" />
                Advanced
              </Button>
            </div>
          </div>

          <div className="grid lg:grid-cols-[1.4fr_0.9fr] gap-4">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Chunks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(d => (
                    <TableRow
                      key={d.id}
                      className={cn("cursor-pointer", selectedId === d.id && "bg-muted/40")}
                      onClick={() => setSelectedId(d.id)}
                    >
                      <TableCell>
                        <div className="font-medium">{d.title}</div>
                        <div className="text-xs text-muted-foreground">{d.version} • {d.pages} pages • {new Date(d.lastUpdated).toLocaleDateString()}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{d.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={d.status} />
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{d.chunks}</TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-10">
                        No documents match the current filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <Card className="bg-muted/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Evidence Preview</CardTitle>
                <CardDescription className="text-xs">
                  What the agent will cite in Case Detail.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {selected ? (
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-sm">{selected.title}</div>
                        <div className="text-xs text-muted-foreground">{selected.category} • {selected.version}</div>
                      </div>
                      <Button variant="outline" size="sm" className="gap-1 bg-transparent">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open
                      </Button>
                    </div>
                    <Separator />
                    <ScrollArea className="h-[260px] pr-3">
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Quote className="h-3.5 w-3.5" />
                          Example citations
                        </div>
                        <div className="border rounded-lg p-3 bg-background">
                          <p className="text-xs text-muted-foreground">Page 4 • Chunk #18</p>
                          <p className="mt-1">"Entertainment expenses above threshold require evidence and managerial approval."</p>
                        </div>
                        <div className="border rounded-lg p-3 bg-background">
                          <p className="text-xs text-muted-foreground">Page 9 • Chunk #51</p>
                          <p className="mt-1">"Bank account changes require a cooling period before payments can be released."</p>
                        </div>
                        <div className="border rounded-lg p-3 bg-background">
                          <p className="text-xs text-muted-foreground">Page 12 • Chunk #72</p>
                          <p className="mt-1">"Duplicate invoice detection should consider vendor, amount tolerance, and posting window."</p>
                        </div>
                      </div>
                    </ScrollArea>
                    <div className="flex items-center justify-between pt-2">
                      <Badge variant="outline" className="gap-1">
                        <Sparkles className="h-3.5 w-3.5" />
                        Embeddings healthy
                      </Badge>
                      <Button variant="outline" size="sm" className="bg-transparent">Re-index</Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Select a document to preview evidence.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
