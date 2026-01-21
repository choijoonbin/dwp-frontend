"use client"

import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Copy,
  Check,
  AlertTriangle,
  ArrowRight,
  Clock,
  User,
  Hash,
  Tag,
  FileCode,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { AuditLog } from "@/app/admin/audit-logs/page"

interface AuditLogDetailDrawerProps {
  log: AuditLog | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AuditLogDetailDrawer({
  log,
  open,
  onOpenChange,
}: AuditLogDetailDrawerProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [jsonView, setJsonView] = useState<"split" | "before" | "after">("split")

  if (!log) return null

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const getActionTypeBadge = (actionType: string) => {
    const styles: Record<string, string> = {
      CREATE: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
      UPDATE: "bg-blue-500/10 text-blue-500 border-blue-500/30",
      DELETE: "bg-red-500/10 text-red-500 border-red-500/30",
      REORDER: "bg-amber-500/10 text-amber-500 border-amber-500/30",
    }
    return (
      <Badge variant="outline" className={cn("text-sm", styles[actionType])}>
        {actionType}
      </Badge>
    )
  }

  const renderJsonBlock = (json: string | null, label: string) => {
    if (!json) {
      return (
        <div className="flex items-center justify-center h-full bg-muted/30 rounded-lg text-muted-foreground text-sm">
          데이터 없음
        </div>
      )
    }

    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50 rounded-t-lg">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={() => copyToClipboard(json, label)}
          >
            {copiedField === label ? (
              <>
                <Check className="h-3 w-3 text-emerald-500" />
                복사됨
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                복사
              </>
            )}
          </Button>
        </div>
        <ScrollArea className="flex-1 rounded-b-lg border border-t-0 border-border">
          <pre className="p-3 text-xs font-mono text-foreground leading-relaxed whitespace-pre-wrap">
            {json}
          </pre>
        </ScrollArea>
      </div>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b border-border">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <SheetTitle className="text-xl">감사 로그 상세</SheetTitle>
              <SheetDescription>
                {log.keyword}
              </SheetDescription>
            </div>
            {getActionTypeBadge(log.actionType)}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metadata */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              기본 정보
              <Separator className="flex-1" />
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">시간</p>
                  <p className="text-sm font-medium truncate">{formatTimestamp(log.timestamp)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <User className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">수행자</p>
                  <p className="text-sm font-medium truncate">{log.actorName}</p>
                  <p className="text-xs text-muted-foreground truncate">{log.actorEmail}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">대상 유형</p>
                  <Badge variant="secondary" className="mt-1">{log.targetType}</Badge>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <FileCode className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">대상 ID</p>
                  <p className="text-sm font-mono truncate">{log.targetId}</p>
                </div>
              </div>
            </div>

            {log.resourceKey && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">리소스 키</p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm font-mono bg-background px-2 py-0.5 rounded">
                      {log.resourceKey}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => copyToClipboard(log.resourceKey!, "resourceKey")}
                    >
                      {copiedField === "resourceKey" ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Trace ID</p>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm font-mono bg-background px-2 py-0.5 rounded">
                    {log.traceId}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => copyToClipboard(log.traceId, "traceId")}
                  >
                    {copiedField === "traceId" ? (
                      <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* JSON Diff */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                변경 내용
                <Separator className="flex-1" />
              </h3>
              {log.truncated && (
                <Badge variant="outline" className="border-amber-500/30 text-amber-500 gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  데이터 잘림
                </Badge>
              )}
            </div>

            <Tabs value={jsonView} onValueChange={(v) => setJsonView(v as typeof jsonView)}>
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="split" className="text-xs">
                  분할 보기
                </TabsTrigger>
                <TabsTrigger value="before" className="text-xs">
                  Before
                </TabsTrigger>
                <TabsTrigger value="after" className="text-xs">
                  After
                </TabsTrigger>
              </TabsList>

              <TabsContent value="split" className="mt-4">
                <div className="grid gap-4 lg:grid-cols-2 min-h-[300px]">
                  <div className="h-[300px]">
                    {renderJsonBlock(log.beforeJson, "Before")}
                  </div>
                  <div className="h-[300px] relative">
                    <div className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 hidden lg:block">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <ArrowRight className="h-3 w-3" />
                      </div>
                    </div>
                    {renderJsonBlock(log.afterJson, "After")}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="before" className="mt-4">
                <div className="h-[400px]">
                  {renderJsonBlock(log.beforeJson, "Before")}
                </div>
              </TabsContent>

              <TabsContent value="after" className="mt-4">
                <div className="h-[400px]">
                  {renderJsonBlock(log.afterJson, "After")}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
