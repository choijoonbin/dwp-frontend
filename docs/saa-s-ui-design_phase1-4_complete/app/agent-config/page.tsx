"use client"

import { useMemo, useState } from "react"
import {
  Bot,
  Sparkles,
  Wrench,
  ScrollText,
  GitBranch,
  History,
  Save,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const models = [
  { key: "gpt-4o", label: "GPT-4o" },
  { key: "gpt-4.1", label: "GPT-4.1" },
  { key: "claude-3.5", label: "Claude 3.5" },
  { key: "azure-openai", label: "Azure OpenAI (Enterprise)" },
]

const toolToggles = [
  { key: "sap_hold_payment", label: "SAP: Set Payment Block" },
  { key: "sap_release_payment", label: "SAP: Release Payment Block" },
  { key: "sap_reverse_doc", label: "SAP: Reversal / Credit Memo" },
  { key: "notify_email", label: "Notify: Email" },
  { key: "notify_slack", label: "Notify: Slack / Teams" },
  { key: "create_case", label: "Ops: Create Case" },
]

const promptTemplates = [
  {
    name: "case_triage_v1",
    purpose: "Convert raw signals into an explainable case summary with citations",
    updatedAt: "2026-02-01T08:40:00Z",
  },
  {
    name: "action_planner_v1",
    purpose: "Generate safe, guardrail-aware action proposals",
    updatedAt: "2026-02-01T08:45:00Z",
  },
  {
    name: "reconciliation_explainer_v1",
    purpose: "Write audit-ready reconciliation narratives",
    updatedAt: "2026-02-01T08:52:00Z",
  },
]

export default function AgentConfigPage() {
  const [model, setModel] = useState(models[0].key)
  const [temperature, setTemperature] = useState("0.2")
  const [maxTokens, setMaxTokens] = useState("2048")
  const [tools, setTools] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(toolToggles.map((t) => [t.key, t.key !== "sap_reverse_doc"]))
  )

  const [selectedTemplate, setSelectedTemplate] = useState(promptTemplates[0].name)
  const template = useMemo(
    () => promptTemplates.find((p) => p.name === selectedTemplate) ?? promptTemplates[0],
    [selectedTemplate]
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold">Agent Configuration</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Model, prompts, and tool permissions. Changes should be versioned and auditable.
          </p>
        </div>
        <Button className="gap-2">
          <Save className="h-4 w-4" />
          Save Draft
        </Button>
      </div>

      <Tabs defaultValue="model" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="model" className="gap-2">
            <Sparkles className="h-4 w-4" /> Model
          </TabsTrigger>
          <TabsTrigger value="prompts" className="gap-2">
            <ScrollText className="h-4 w-4" /> Prompts
          </TabsTrigger>
          <TabsTrigger value="tools" className="gap-2">
            <Wrench className="h-4 w-4" /> Tools
          </TabsTrigger>
        </TabsList>

        <TabsContent value="model" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Model Settings</CardTitle>
                <CardDescription>Safe defaults for enterprise runtime.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Provider / Model</div>
                    <Select value={model} onValueChange={setModel}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        {models.map((m) => (
                          <SelectItem key={m.key} value={m.key}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Temperature</div>
                    <Input value={temperature} onChange={(e) => setTemperature(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Max tokens</div>
                    <Input value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Runtime Guardrails</div>
                    <Badge variant="outline" className="gap-1">
                      <GitBranch className="h-3.5 w-3.5" />
                      versioned
                    </Badge>
                  </div>
                  <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                    <li>All actions must reference a policy citation or numeric evidence.</li>
                    <li>High/Critical cases require explicit approval unless autonomy allows.</li>
                    <li>Every tool call must be recorded to audit trail with before/after.</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Deploy History</CardTitle>
                <CardDescription>Recent config snapshots.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {["v1.0.0", "v1.0.1", "v1.1.0"].map((v, idx) => (
                  <div key={v} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{v}</div>
                      <Badge variant="outline" className={cn(idx === 0 ? "bg-success/10 text-success border-success/20" : "bg-muted")}> 
                        {idx === 0 ? "Active" : "Archived"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <History className="h-3.5 w-3.5" />
                      {idx === 0 ? "Deployed 2 hours ago" : "Deployed last week"}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="prompts" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Prompt Templates</CardTitle>
                <CardDescription>Select a template to edit.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {promptTemplates.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => setSelectedTemplate(p.name)}
                    className={cn(
                      "w-full text-left rounded-lg border p-3 transition-colors",
                      selectedTemplate === p.name ? "bg-primary/10 border-primary/40" : "hover:bg-muted"
                    )}
                  >
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">{p.purpose}</div>
                    <div className="text-[11px] text-muted-foreground mt-2">Updated {new Date(p.updatedAt).toLocaleString()}</div>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Edit: {template.name}</CardTitle>
                <CardDescription>{template.purpose}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-muted-foreground">Template (mock)</div>
                <Textarea
                  className="min-h-[320px] font-mono text-xs"
                  defaultValue={`SYSTEM: You are a safe enterprise finance agent.\n\nINPUT: {case_json} {rag_snippets}\n\nTASK: Produce (1) summary, (2) evidence table, (3) proposed actions with guardrail checks.\n\nOUTPUT JSON: {summary, evidence[], actions[], citations[]}`}
                />
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="gap-1">
                    <ScrollText className="h-3.5 w-3.5" />
                    explainable
                  </Badge>
                  <div className="flex gap-2">
                    <Button variant="outline" className="bg-transparent">Run Dry Test</Button>
                    <Button>Save Template</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tools" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Tool Permissions</CardTitle>
              <CardDescription>Control what the agent is allowed to do.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {toolToggles.map((t) => (
                  <div key={t.key} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <div className="text-sm font-medium">{t.label}</div>
                      <div className="text-xs text-muted-foreground">Logged & reconcilable</div>
                    </div>
                    <Switch
                      checked={!!tools[t.key]}
                      onCheckedChange={(v) => setTools((prev) => ({ ...prev, [t.key]: v }))}
                    />
                  </div>
                ))}
              </div>

              <Separator className="my-4" />
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Tip: connect this screen to your SoD roles in the Admin module.
                </div>
                <Badge variant="outline" className="gap-1">
                  <Wrench className="h-3.5 w-3.5" />
                  guardrail-aware
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
