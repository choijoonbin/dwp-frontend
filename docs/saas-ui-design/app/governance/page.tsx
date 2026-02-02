"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  Shield,
  ShieldAlert,
  Sliders,
  Lock,
  Plus,
  Trash2,
  Edit,
  AlertTriangle,
  CheckCircle2,
  Brain,
  User,
  Bot,
  ChevronRight,
  Save,
  RotateCcw,
  Info,
  Settings
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { SeverityBadge } from "@/components/finance/severity-badge"

// Autonomy levels
const autonomyLevels = [
  { level: 1, name: 'Human Only', description: 'AI provides analysis only. All actions require human initiation.', icon: User, color: 'bg-muted text-muted-foreground' },
  { level: 2, name: 'AI Assists', description: 'AI suggests actions. Human must review and manually execute.', icon: Brain, color: 'bg-info/20 text-info' },
  { level: 3, name: 'AI Proposes', description: 'AI proposes actions with full detail. Human approves with one click.', icon: Bot, color: 'bg-primary/20 text-primary' },
  { level: 4, name: 'AI Auto + Review', description: 'AI executes low-risk actions automatically. High-risk requires approval.', icon: Bot, color: 'bg-warning/20 text-warning' },
  { level: 5, name: 'Fully Autonomous', description: 'AI executes all actions within guardrails without human intervention.', icon: Bot, color: 'bg-success/20 text-success' },
]

// Anomaly types with autonomy settings
const initialAnomalySettings = [
  { type: 'duplicate_invoice', label: 'Duplicate Invoice', autonomyLevel: 3, riskWeight: 'high', enabled: true },
  { type: 'bank_change', label: 'Bank Account Change', autonomyLevel: 2, riskWeight: 'critical', enabled: true },
  { type: 'policy_violation', label: 'Policy Violation', autonomyLevel: 3, riskWeight: 'high', enabled: true },
  { type: 'integrity_mismatch', label: 'Data Integrity Mismatch', autonomyLevel: 4, riskWeight: 'medium', enabled: true },
  { type: 'amount_variance', label: 'Amount Variance', autonomyLevel: 3, riskWeight: 'high', enabled: true },
  { type: 'timing_anomaly', label: 'Timing Anomaly', autonomyLevel: 4, riskWeight: 'low', enabled: true },
]

// Guardrails
const initialGuardrails = [
  { id: 'gr-1', name: 'CFO Approval for Large Payments', rule: 'Never approve payments over $1,000,000 without CFO signature', threshold: 1000000, enabled: true, severity: 'critical' as const },
  { id: 'gr-2', name: 'Dual Approval Requirement', rule: 'Require dual approval for any reversal action over $100,000', threshold: 100000, enabled: true, severity: 'high' as const },
  { id: 'gr-3', name: 'New Vendor Restriction', rule: 'Block automatic payments to vendors created within last 7 days', threshold: 7, enabled: true, severity: 'high' as const },
  { id: 'gr-4', name: 'Bank Change Cooldown', rule: 'Require manual approval for payments after bank account change within 72 hours', threshold: 72, enabled: true, severity: 'critical' as const },
  { id: 'gr-5', name: 'Daily Limit per Vendor', rule: 'AI cannot approve more than $500,000 total to any single vendor per day', threshold: 500000, enabled: false, severity: 'medium' as const },
]

export default function GovernancePage() {
  const [globalAutonomyLevel, setGlobalAutonomyLevel] = useState([3])
  const [anomalySettings, setAnomalySettings] = useState(initialAnomalySettings)
  const [guardrails, setGuardrails] = useState(initialGuardrails)
  const [hasChanges, setHasChanges] = useState(false)
  const [newGuardrailOpen, setNewGuardrailOpen] = useState(false)

  const updateAnomalyLevel = (type: string, level: number) => {
    setAnomalySettings(prev => prev.map(a => 
      a.type === type ? { ...a, autonomyLevel: level } : a
    ))
    setHasChanges(true)
  }

  const toggleAnomalyEnabled = (type: string) => {
    setAnomalySettings(prev => prev.map(a => 
      a.type === type ? { ...a, enabled: !a.enabled } : a
    ))
    setHasChanges(true)
  }

  const toggleGuardrail = (id: string) => {
    setGuardrails(prev => prev.map(g => 
      g.id === id ? { ...g, enabled: !g.enabled } : g
    ))
    setHasChanges(true)
  }

  const removeGuardrail = (id: string) => {
    setGuardrails(prev => prev.filter(g => g.id !== id))
    setHasChanges(true)
  }

  const currentLevelConfig = autonomyLevels.find(l => l.level === globalAutonomyLevel[0]) || autonomyLevels[2]
  const LevelIcon = currentLevelConfig.icon

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Page Header */}
      <div className="border-b border-border bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Governance & Autonomy Controls
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Configure AI autonomy levels and define strict guardrails for automated actions
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <>
                <Button variant="outline" size="sm" className="gap-1 bg-transparent" onClick={() => {
                  setAnomalySettings(initialAnomalySettings)
                  setGuardrails(initialGuardrails)
                  setGlobalAutonomyLevel([3])
                  setHasChanges(false)
                }}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>
                <Button size="sm" className="gap-1">
                  <Save className="h-3.5 w-3.5" />
                  Save Changes
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Autonomy Levels */}
        <div className="lg:w-1/2 border-b lg:border-b-0 lg:border-r border-border flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-muted/30">
            <h2 className="text-sm font-medium flex items-center gap-2">
              <Sliders className="h-4 w-4 text-muted-foreground" />
              Autonomy Level Configuration
            </h2>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {/* Global Autonomy Level */}
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Global Default Autonomy Level
                    </span>
                    <Badge variant="outline" className={cn("gap-1", currentLevelConfig.color)}>
                      <LevelIcon className="h-3 w-3" />
                      Level {globalAutonomyLevel[0]}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Default autonomy level applied to all anomaly types unless overridden
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 space-y-4">
                  <div className="px-2">
                    <Slider
                      value={globalAutonomyLevel}
                      onValueChange={(v) => {
                        setGlobalAutonomyLevel(v)
                        setHasChanges(true)
                      }}
                      min={1}
                      max={5}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                      <span>Human Only</span>
                      <span>Fully Auto</span>
                    </div>
                  </div>
                  <div className={cn("p-3 rounded-lg", currentLevelConfig.color)}>
                    <div className="flex items-center gap-2 mb-1">
                      <LevelIcon className="h-4 w-4" />
                      <span className="font-medium text-sm">{currentLevelConfig.name}</span>
                    </div>
                    <p className="text-xs opacity-80">{currentLevelConfig.description}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Autonomy Level Reference */}
              <Card className="bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    Autonomy Level Reference
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {autonomyLevels.map((level) => {
                      const Icon = level.icon
                      return (
                        <div key={level.level} className={cn(
                          "flex items-center gap-3 p-2 rounded-lg transition-colors",
                          globalAutonomyLevel[0] === level.level ? "bg-primary/10" : "bg-muted/30"
                        )}>
                          <div className={cn("h-8 w-8 rounded-full flex items-center justify-center", level.color)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">Level {level.level}: {level.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{level.description}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Per-Anomaly Settings */}
              <Card className="bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    Per-Anomaly Type Settings
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Override global autonomy level for specific anomaly types
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {anomalySettings.map((setting) => (
                      <div 
                        key={setting.type}
                        className={cn(
                          "p-3 rounded-lg border transition-colors",
                          setting.enabled ? "bg-card" : "bg-muted/30 opacity-60"
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={setting.enabled}
                              onCheckedChange={() => toggleAnomalyEnabled(setting.type)}
                            />
                            <span className="text-sm font-medium">{setting.label}</span>
                          </div>
                          <SeverityBadge severity={setting.riskWeight as 'critical' | 'high' | 'medium' | 'low'} size="sm" />
                        </div>
                        {setting.enabled && (
                          <div className="flex items-center gap-3 mt-3">
                            <span className="text-xs text-muted-foreground min-w-[60px]">Level:</span>
                            <div className="flex-1">
                              <Slider
                                value={[setting.autonomyLevel]}
                                onValueChange={(v) => updateAnomalyLevel(setting.type, v[0])}
                                min={1}
                                max={5}
                                step={1}
                              />
                            </div>
                            <Badge variant="outline" className="min-w-[80px] justify-center">
                              Level {setting.autonomyLevel}
                            </Badge>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </div>

        {/* Right: Guardrails */}
        <div className="lg:w-1/2 flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
            <h2 className="text-sm font-medium flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              Guardrail Configuration
            </h2>
            <Dialog open={newGuardrailOpen} onOpenChange={setNewGuardrailOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1 bg-transparent">
                  <Plus className="h-3.5 w-3.5" />
                  Add Guardrail
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Guardrail</DialogTitle>
                  <DialogDescription>
                    Define a strict rule that the AI can never bypass
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Guardrail Name</Label>
                    <Input placeholder="e.g., Weekend Payment Restriction" />
                  </div>
                  <div className="space-y-2">
                    <Label>Rule Description</Label>
                    <Input placeholder="e.g., Never approve payments on weekends" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Threshold Value</Label>
                      <Input type="number" placeholder="0" />
                    </div>
                    <div className="space-y-2">
                      <Label>Severity</Label>
                      <Select defaultValue="high">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="critical">Critical</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setNewGuardrailOpen(false)} className="bg-transparent">
                    Cancel
                  </Button>
                  <Button onClick={() => {
                    setGuardrails(prev => [...prev, {
                      id: `gr-${Date.now()}`,
                      name: 'New Guardrail',
                      rule: 'Custom rule description',
                      threshold: 0,
                      enabled: true,
                      severity: 'high' as const
                    }])
                    setHasChanges(true)
                    setNewGuardrailOpen(false)
                  }}>
                    Add Guardrail
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-4">
              {/* Info Card */}
              <Card className="bg-destructive/10 border-destructive/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-destructive">Strict Guardrails</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        These rules are absolute boundaries that the AI system can NEVER bypass, 
                        regardless of autonomy level. They ensure compliance and prevent catastrophic errors.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Guardrails List */}
              <div className="space-y-3">
                {guardrails.map((guardrail) => (
                  <Card 
                    key={guardrail.id}
                    className={cn(
                      "transition-colors",
                      guardrail.enabled 
                        ? guardrail.severity === 'critical' 
                          ? "bg-destructive/5 border-destructive/30" 
                          : "bg-card"
                        : "bg-muted/30 opacity-60"
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={cn(
                            "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0",
                            guardrail.enabled 
                              ? guardrail.severity === 'critical' 
                                ? "bg-destructive/20 text-destructive" 
                                : "bg-warning/20 text-warning"
                              : "bg-muted text-muted-foreground"
                          )}>
                            <Lock className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium">{guardrail.name}</p>
                              <SeverityBadge severity={guardrail.severity} size="sm" />
                            </div>
                            <p className="text-xs text-muted-foreground">{guardrail.rule}</p>
                            {guardrail.threshold > 0 && (
                              <Badge variant="outline" className="mt-2 text-[10px]">
                                Threshold: {guardrail.threshold.toLocaleString()}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={guardrail.enabled}
                            onCheckedChange={() => toggleGuardrail(guardrail.id)}
                          />
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive bg-transparent"
                                  onClick={() => removeGuardrail(guardrail.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Remove guardrail</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Summary Stats */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {guardrails.filter(g => g.enabled).length}
                      </p>
                      <p className="text-xs text-muted-foreground">Active Guardrails</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-destructive">
                        {guardrails.filter(g => g.enabled && g.severity === 'critical').length}
                      </p>
                      <p className="text-xs text-muted-foreground">Critical Rules</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-warning">
                        {guardrails.filter(g => !g.enabled).length}
                      </p>
                      <p className="text-xs text-muted-foreground">Disabled</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
