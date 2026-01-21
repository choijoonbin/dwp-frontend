"use client"

import React from "react"

import { useState, useRef, useEffect } from "react"
import {
  Send,
  Sparkles,
  Brain,
  ListChecks,
  Terminal,
  FileText,
  ChevronRight,
  ChevronDown,
  Clock,
  Check,
  AlertCircle,
  Loader2,
  RotateCcw,
  Copy,
  ArrowLeft,
  PanelRightOpen,
  PanelRightClose,
  GripVertical,
  Play,
  Pause,
  SkipForward,
  Info,
  Code2,
  MessageSquare,
  Lightbulb,
  Settings2,
  Zap,
  CheckCircle2,
  XCircle,
  CircleDashed,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

// Types based on aura.md spec
interface ThoughtChain {
  id: string
  type: "analysis" | "planning" | "execution" | "verification"
  content: string
  timestamp: Date
  sources?: Array<{
    type: "code" | "conversation" | "metadata"
    name: string
    path?: string
  }>
}

interface PlanStep {
  id: string
  title: string
  description: string
  order: number
  canSkip: boolean
  status: "pending" | "approved" | "skipped" | "executing" | "completed" | "failed"
  confidence?: number
}

interface ExecutionLog {
  id: string
  timestamp: Date
  type: "command" | "api" | "info" | "error" | "success"
  content: string
  metadata?: Record<string, unknown>
}

interface AgentMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  isStreaming?: boolean
  result?: {
    type: "diff" | "preview" | "checklist" | "text"
    content: string
    title: string
  }
}

interface HitlRequest {
  id: string
  stepId: string
  message: string
  action: string
  params: Record<string, unknown>
  timestamp: Date
  confidence?: number
  editableContent?: string
}

interface ContextSnapshot {
  url: string
  pathname: string
  title: string
  activeApp?: string
  selectedItemIds?: string[]
  metadata?: Record<string, unknown>
  timestamp: Date
}

// Mock Data
const mockThoughts: ThoughtChain[] = [
  {
    id: "1",
    type: "analysis",
    content: "사용자 요청을 분석하고 있습니다. 현재 페이지의 컴포넌트 구조를 파악 중...",
    timestamp: new Date(Date.now() - 60000),
    sources: [
      { type: "code", name: "page.tsx", path: "/app/admin/users/page.tsx" },
      { type: "conversation", name: "이전 대화" },
    ],
  },
  {
    id: "2",
    type: "planning",
    content: "사용자 관리 화면의 필터 기능 개선을 위한 계획을 수립하고 있습니다.",
    timestamp: new Date(Date.now() - 45000),
  },
  {
    id: "3",
    type: "execution",
    content: "필터 컴포넌트를 분석하여 최적화 포인트를 식별했습니다.",
    timestamp: new Date(Date.now() - 30000),
    sources: [
      { type: "metadata", name: "컴포넌트 분석 결과" },
    ],
  },
]

const mockPlanSteps: PlanStep[] = [
  {
    id: "1",
    title: "현재 필터 구조 분석",
    description: "기존 필터 컴포넌트의 구조와 상태 관리 방식을 분석합니다.",
    order: 0,
    canSkip: false,
    status: "completed",
    confidence: 0.95,
  },
  {
    id: "2",
    title: "필터 상태 최적화",
    description: "불필요한 리렌더링을 방지하기 위해 필터 상태를 최적화합니다.",
    order: 1,
    canSkip: false,
    status: "executing",
    confidence: 0.88,
  },
  {
    id: "3",
    title: "디바운스 적용",
    description: "검색 입력에 디바운스를 적용하여 API 호출을 최적화합니다.",
    order: 2,
    canSkip: true,
    status: "pending",
    confidence: 0.92,
  },
  {
    id: "4",
    title: "결과 검증",
    description: "변경 사항이 의도한 대로 작동하는지 검증합니다.",
    order: 3,
    canSkip: false,
    status: "pending",
    confidence: 0.85,
  },
]

const mockExecutionLogs: ExecutionLog[] = [
  {
    id: "1",
    timestamp: new Date(Date.now() - 50000),
    type: "info",
    content: "작업을 시작합니다...",
  },
  {
    id: "2",
    timestamp: new Date(Date.now() - 45000),
    type: "command",
    content: "$ analyzing /app/admin/users/page.tsx",
  },
  {
    id: "3",
    timestamp: new Date(Date.now() - 40000),
    type: "api",
    content: "GET /api/users?page=1&limit=10 - 200 OK (45ms)",
  },
  {
    id: "4",
    timestamp: new Date(Date.now() - 35000),
    type: "success",
    content: "컴포넌트 분석 완료: 3개의 최적화 포인트 발견",
  },
  {
    id: "5",
    timestamp: new Date(Date.now() - 30000),
    type: "info",
    content: "필터 상태 최적화 중...",
  },
]

const mockMessages: AgentMessage[] = [
  {
    id: "1",
    role: "user",
    content: "사용자 관리 화면의 필터 기능을 개선해줘. 검색할 때 너무 느린 것 같아.",
    timestamp: new Date(Date.now() - 120000),
  },
  {
    id: "2",
    role: "assistant",
    content: "네, 사용자 관리 화면의 필터 성능을 분석하고 개선하겠습니다.\n\n현재 분석 결과:\n1. 검색 입력 시 즉시 API 호출이 발생하고 있습니다.\n2. 필터 상태 변경 시 전체 컴포넌트가 리렌더링됩니다.\n\n다음 최적화를 제안합니다:\n- 검색 입력에 300ms 디바운스 적용\n- 필터 상태를 메모이제이션하여 불필요한 리렌더링 방지\n- API 호출 결과 캐싱",
    timestamp: new Date(Date.now() - 90000),
  },
]

const mockContext: ContextSnapshot = {
  url: "https://dwp.example.com/admin/users",
  pathname: "/admin/users",
  title: "사용자 관리 - DWP Admin",
  activeApp: "admin",
  selectedItemIds: [],
  metadata: {
    screen: "users",
    filters: { status: "all" },
  },
  timestamp: new Date(),
}

// Utility functions
const formatTime = (date: Date) => {
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

const getThoughtTypeConfig = (type: ThoughtChain["type"]) => {
  const configs = {
    analysis: { label: "분석", icon: Brain, color: "text-blue-500 bg-blue-500/10" },
    planning: { label: "계획", icon: ListChecks, color: "text-amber-500 bg-amber-500/10" },
    execution: { label: "실행", icon: Zap, color: "text-emerald-500 bg-emerald-500/10" },
    verification: { label: "검증", icon: Check, color: "text-violet-500 bg-violet-500/10" },
  }
  return configs[type]
}

const getStepStatusConfig = (status: PlanStep["status"]) => {
  const configs = {
    pending: { label: "대기", icon: CircleDashed, color: "text-muted-foreground" },
    approved: { label: "승인", icon: Check, color: "text-blue-500" },
    skipped: { label: "건너뜀", icon: SkipForward, color: "text-muted-foreground" },
    executing: { label: "실행 중", icon: Loader2, color: "text-amber-500", animate: true },
    completed: { label: "완료", icon: CheckCircle2, color: "text-emerald-500" },
    failed: { label: "실패", icon: XCircle, color: "text-destructive" },
  }
  return configs[status]
}

const getLogTypeConfig = (type: ExecutionLog["type"]) => {
  const configs = {
    command: { color: "text-cyan-400" },
    api: { color: "text-yellow-400" },
    info: { color: "text-muted-foreground" },
    error: { color: "text-red-400" },
    success: { color: "text-emerald-400" },
  }
  return configs[type]
}

export default function AIWorkspacePage() {
  const [messages, setMessages] = useState<AgentMessage[]>(mockMessages)
  const [thoughts, setThoughts] = useState<ThoughtChain[]>(mockThoughts)
  const [planSteps, setPlanSteps] = useState<PlanStep[]>(mockPlanSteps)
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>(mockExecutionLogs)
  const [context, setContext] = useState<ContextSnapshot>(mockContext)
  
  const [inputValue, setInputValue] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [activeTab, setActiveTab] = useState("thoughts")
  const [contextPanelOpen, setContextPanelOpen] = useState(false)
  const [hitlRequest, setHitlRequest] = useState<HitlRequest | null>(null)
  const [hitlDialogOpen, setHitlDialogOpen] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [executionLogs])

  const handleSend = () => {
    if (!inputValue.trim() || isStreaming) return

    const newMessage: AgentMessage = {
      id: String(Date.now()),
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    }
    setMessages([...messages, newMessage])
    setInputValue("")
    setIsStreaming(true)
    setIsThinking(true)

    // Simulate AI response
    setTimeout(() => {
      setIsThinking(false)
      const response: AgentMessage = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: "요청을 처리하고 있습니다. 잠시만 기다려주세요...",
        timestamp: new Date(),
        isStreaming: true,
      }
      setMessages((prev) => [...prev, response])

      // Simulate streaming completion
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === response.id
              ? {
                  ...m,
                  content: "분석이 완료되었습니다. 좌측 탭에서 상세 결과를 확인하실 수 있습니다.",
                  isStreaming: false,
                }
              : m
          )
        )
        setIsStreaming(false)
      }, 2000)
    }, 1500)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleApproveStep = (stepId: string) => {
    setPlanSteps((steps) =>
      steps.map((s) => (s.id === stepId ? { ...s, status: "approved" as const } : s))
    )
  }

  const handleSkipStep = (stepId: string) => {
    setPlanSteps((steps) =>
      steps.map((s) => (s.id === stepId ? { ...s, status: "skipped" as const } : s))
    )
  }

  const handleHitlApprove = () => {
    setHitlDialogOpen(false)
    setHitlRequest(null)
    // Continue streaming...
  }

  const handleHitlReject = () => {
    setHitlDialogOpen(false)
    setHitlRequest(null)
    setIsStreaming(false)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 p-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">AI Workspace</h1>
              <p className="text-xs text-muted-foreground">Aura AI Agent</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isStreaming && (
              <Badge variant="secondary" className="gap-1.5 animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" />
                처리 중
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setContextPanelOpen(!contextPanelOpen)}
              className="gap-2 hidden lg:flex"
            >
              {contextPanelOpen ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRightOpen className="h-4 w-4" />
              )}
              컨텍스트
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 lg:hidden bg-transparent">
                  <Info className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <SheetHeader>
                  <SheetTitle>컨텍스트 정보</SheetTitle>
                </SheetHeader>
                <ContextPanel context={context} />
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Chat Panel */}
          <div className="w-full lg:w-[420px] flex flex-col border-r border-border bg-background">
            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                        <Sparkles className="h-4 w-4 text-white" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-3",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted rounded-bl-md"
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {message.content}
                        {message.isStreaming && (
                          <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
                        )}
                      </p>
                      <p className={cn(
                        "text-[10px] mt-1.5",
                        message.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}>
                        {formatTime(message.timestamp)}
                      </p>
                    </div>
                    {message.role === "user" && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-medium">
                        U
                      </div>
                    )}
                  </div>
                ))}
                {isThinking && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t border-border bg-muted/30">
              <div className="flex gap-2">
                <Textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="메시지를 입력하세요... (Shift+Enter로 줄바꿈)"
                  className="min-h-[44px] max-h-32 resize-none"
                  disabled={isStreaming}
                />
                <Button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isStreaming}
                  size="icon"
                  className="h-11 w-11 shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Tabs Panel */}
          <div className="hidden lg:flex flex-1 flex-col bg-muted/20">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <div className="px-4 pt-4 pb-2 border-b border-border bg-background">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="thoughts" className="gap-2">
                    <Brain className="h-4 w-4" />
                    <span className="hidden xl:inline">사고 과정</span>
                  </TabsTrigger>
                  <TabsTrigger value="plan" className="gap-2">
                    <ListChecks className="h-4 w-4" />
                    <span className="hidden xl:inline">작업 계획</span>
                  </TabsTrigger>
                  <TabsTrigger value="execution" className="gap-2">
                    <Terminal className="h-4 w-4" />
                    <span className="hidden xl:inline">실행 로그</span>
                  </TabsTrigger>
                  <TabsTrigger value="result" className="gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="hidden xl:inline">결과</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="thoughts" className="flex-1 overflow-auto p-4 mt-0">
                <ThoughtsPanel thoughts={thoughts} />
              </TabsContent>

              <TabsContent value="plan" className="flex-1 overflow-auto p-4 mt-0">
                <PlanPanel
                  steps={planSteps}
                  onApprove={handleApproveStep}
                  onSkip={handleSkipStep}
                />
              </TabsContent>

              <TabsContent value="execution" className="flex-1 overflow-auto mt-0">
                <ExecutionPanel logs={executionLogs} logsEndRef={logsEndRef} />
              </TabsContent>

              <TabsContent value="result" className="flex-1 overflow-auto p-4 mt-0">
                <ResultPanel />
              </TabsContent>
            </Tabs>
          </div>

          {/* Mobile Tabs */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="default"
                size="icon"
                className="lg:hidden fixed bottom-20 right-4 h-12 w-12 rounded-full shadow-lg z-50"
              >
                <Brain className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[70vh] rounded-t-xl">
              <SheetHeader className="sr-only">
                <SheetTitle>AI 작업 상세</SheetTitle>
              </SheetHeader>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
                <TabsList className="grid w-full grid-cols-4 mb-4">
                  <TabsTrigger value="thoughts" className="gap-1.5 text-xs">
                    <Brain className="h-4 w-4" />
                    사고
                  </TabsTrigger>
                  <TabsTrigger value="plan" className="gap-1.5 text-xs">
                    <ListChecks className="h-4 w-4" />
                    계획
                  </TabsTrigger>
                  <TabsTrigger value="execution" className="gap-1.5 text-xs">
                    <Terminal className="h-4 w-4" />
                    실행
                  </TabsTrigger>
                  <TabsTrigger value="result" className="gap-1.5 text-xs">
                    <FileText className="h-4 w-4" />
                    결과
                  </TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-auto">
                  <TabsContent value="thoughts" className="mt-0 h-full">
                    <ThoughtsPanel thoughts={thoughts} />
                  </TabsContent>
                  <TabsContent value="plan" className="mt-0 h-full">
                    <PlanPanel steps={planSteps} onApprove={handleApproveStep} onSkip={handleSkipStep} />
                  </TabsContent>
                  <TabsContent value="execution" className="mt-0 h-full">
                    <ExecutionPanel logs={executionLogs} logsEndRef={logsEndRef} />
                  </TabsContent>
                  <TabsContent value="result" className="mt-0 h-full">
                    <ResultPanel />
                  </TabsContent>
                </div>
              </Tabs>
            </SheetContent>
          </Sheet>

          {/* Context Panel - Desktop */}
          {contextPanelOpen && (
            <div className="hidden lg:block w-80 border-l border-border bg-background overflow-auto">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold">컨텍스트 정보</h3>
                <p className="text-xs text-muted-foreground mt-1">현재 페이지 상태</p>
              </div>
              <ContextPanel context={context} />
            </div>
          )}
        </div>

        {/* HITL Approval Dialog */}
        <Dialog open={hitlDialogOpen} onOpenChange={setHitlDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                승인 요청
              </DialogTitle>
              <DialogDescription>
                AI가 다음 작업을 수행하기 전에 승인이 필요합니다.
              </DialogDescription>
            </DialogHeader>
            {hitlRequest && (
              <div className="space-y-4 py-4">
                <div className="rounded-lg border border-border p-4 bg-muted/50">
                  <p className="text-sm">{hitlRequest.message}</p>
                </div>
                {hitlRequest.confidence !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">신뢰도:</span>
                    <Badge
                      variant={
                        hitlRequest.confidence >= 0.8
                          ? "default"
                          : hitlRequest.confidence >= 0.5
                          ? "secondary"
                          : "destructive"
                      }
                    >
                      {Math.round(hitlRequest.confidence * 100)}%
                    </Badge>
                  </div>
                )}
                {hitlRequest.params && Object.keys(hitlRequest.params).length > 0 && (
                  <div className="rounded-lg border border-border p-3 bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-2">파라미터:</p>
                    <pre className="text-xs font-mono overflow-auto">
                      {JSON.stringify(hitlRequest.params, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={handleHitlReject}>
                거절
              </Button>
              <Button onClick={handleHitlApprove}>
                승인
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}

// Sub-components
function ThoughtsPanel({ thoughts }: { thoughts: ThoughtChain[] }) {
  if (thoughts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
        <Brain className="h-12 w-12 mb-4 opacity-30" />
        <p className="text-sm">아직 사고 과정이 없습니다</p>
        <p className="text-xs mt-1">AI에게 질문하면 사고 과정이 표시됩니다</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {thoughts.map((thought, index) => {
        const config = getThoughtTypeConfig(thought.type)
        const Icon = config.icon
        return (
          <div key={thought.id} className="relative">
            {index < thoughts.length - 1 && (
              <div className="absolute left-4 top-10 bottom-0 w-px bg-border" />
            )}
            <div className="flex gap-3">
              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", config.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {config.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{formatTime(thought.timestamp)}</span>
                </div>
                <p className="text-sm leading-relaxed">{thought.content}</p>
                {thought.sources && thought.sources.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {thought.sources.map((source, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] gap-1">
                        {source.type === "code" && <Code2 className="h-3 w-3" />}
                        {source.type === "conversation" && <MessageSquare className="h-3 w-3" />}
                        {source.type === "metadata" && <Info className="h-3 w-3" />}
                        {source.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PlanPanel({
  steps,
  onApprove,
  onSkip,
}: {
  steps: PlanStep[]
  onApprove: (id: string) => void
  onSkip: (id: string) => void
}) {
  if (steps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
        <ListChecks className="h-12 w-12 mb-4 opacity-30" />
        <p className="text-sm">아직 작업 계획이 없습니다</p>
        <p className="text-xs mt-1">AI가 작업을 분석하면 계획이 표시됩니다</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {steps.map((step) => {
        const config = getStepStatusConfig(step.status)
        const StatusIcon = config.icon
        return (
          <Card key={step.id} className={cn(
            "transition-all",
            step.status === "executing" && "ring-2 ring-amber-500/50"
          )}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted",
                  config.color
                )}>
                  <StatusIcon className={cn("h-4 w-4", config.animate && "animate-spin")} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="font-medium text-sm">{step.title}</h4>
                    {step.confidence !== undefined && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          step.confidence >= 0.8
                            ? "border-emerald-500/50 text-emerald-500"
                            : step.confidence >= 0.5
                            ? "border-amber-500/50 text-amber-500"
                            : "border-destructive/50 text-destructive"
                        )}
                      >
                        {Math.round(step.confidence * 100)}%
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                  {step.status === "pending" && (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" onClick={() => onApprove(step.id)} className="h-7 text-xs">
                        <Check className="mr-1 h-3 w-3" />
                        승인
                      </Button>
                      {step.canSkip && (
                        <Button size="sm" variant="outline" onClick={() => onSkip(step.id)} className="h-7 text-xs">
                          <SkipForward className="mr-1 h-3 w-3" />
                          건너뛰기
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function ExecutionPanel({
  logs,
  logsEndRef,
}: {
  logs: ExecutionLog[]
  logsEndRef: React.RefObject<HTMLDivElement>
}) {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
        <Terminal className="h-12 w-12 mb-4 opacity-30" />
        <p className="text-sm">아직 실행 로그가 없습니다</p>
        <p className="text-xs mt-1">작업이 실행되면 로그가 표시됩니다</p>
      </div>
    )
  }

  return (
    <div className="bg-zinc-950 text-zinc-100 font-mono text-xs h-full">
      <div className="p-4 space-y-1">
        {logs.map((log) => {
          const config = getLogTypeConfig(log.type)
          return (
            <div key={log.id} className="flex gap-2">
              <span className="text-zinc-500 shrink-0">
                [{formatTime(log.timestamp)}]
              </span>
              <span className={config.color}>{log.content}</span>
            </div>
          )
        })}
        <div ref={logsEndRef} />
      </div>
    </div>
  )
}

function ResultPanel() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
      <FileText className="h-12 w-12 mb-4 opacity-30" />
      <p className="text-sm">아직 결과가 없습니다</p>
      <p className="text-xs mt-1">작업이 완료되면 결과가 표시됩니다</p>
    </div>
  )
}

function ContextPanel({ context }: { context: ContextSnapshot }) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide">URL</label>
          <div className="flex items-center gap-2 mt-1">
            <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{context.pathname}</code>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyToClipboard(context.url)}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide">페이지 제목</label>
          <p className="text-sm mt-1 truncate">{context.title}</p>
        </div>

        {context.activeApp && (
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide">활성 앱</label>
            <Badge variant="secondary" className="mt-1">{context.activeApp}</Badge>
          </div>
        )}

        {context.selectedItemIds && context.selectedItemIds.length > 0 && (
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide">선택된 항목</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {context.selectedItemIds.map((id) => (
                <Badge key={id} variant="outline" className="text-[10px]">{id}</Badge>
              ))}
            </div>
          </div>
        )}

        {context.metadata && Object.keys(context.metadata).length > 0 && (
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide">메타데이터</label>
            <div className="mt-1 rounded-lg border border-border p-2 bg-muted/30">
              <pre className="text-[10px] font-mono overflow-auto">
                {JSON.stringify(context.metadata, null, 2)}
              </pre>
            </div>
          </div>
        )}

        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide">캡처 시간</label>
          <p className="text-xs mt-1">{context.timestamp.toLocaleString("ko-KR")}</p>
        </div>
      </div>
    </div>
  )
}
