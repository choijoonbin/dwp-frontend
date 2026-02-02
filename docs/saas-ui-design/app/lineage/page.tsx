"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Database,
  Brain,
  AlertTriangle,
  Server,
  ChevronRight,
  Building2,
  User,
  History,
  RefreshCw,
  Eye,
  FileText,
  CheckCircle2,
  ArrowRight
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { SeverityBadge } from "@/components/finance/severity-badge"

// Mock lineage data
const mockLineageSteps = [
  {
    id: 'step-1',
    name: 'SAP Raw Event',
    timestamp: '2026-01-28T14:00:00Z',
    status: 'complete',
    system: 'SAP ECC',
    details: {
      eventType: 'FI_DOCUMENT_CREATED',
      documentNumber: '1900001234',
      transactionCode: 'FB01'
    }
  },
  {
    id: 'step-2',
    name: 'Data Ingestion',
    timestamp: '2026-01-28T14:05:00Z',
    status: 'complete',
    system: 'ETL Pipeline',
    details: {
      batchId: 'BATCH-2026-001234',
      recordsProcessed: 1,
      validationStatus: 'Passed'
    }
  },
  {
    id: 'step-3',
    name: 'AI Risk Scoring',
    timestamp: '2026-01-28T14:06:00Z',
    status: 'complete',
    system: 'Risk Engine',
    details: {
      modelVersion: 'v2.4.1',
      confidenceScore: 94,
      riskLevel: 'Critical'
    }
  },
  {
    id: 'step-4',
    name: 'Case Created',
    timestamp: '2026-01-28T14:10:00Z',
    status: 'complete',
    system: 'Case Manager',
    details: {
      caseId: 'CS-2026-0001',
      assignee: 'John Smith',
      slaDeadline: '2026-01-30T14:00:00Z'
    }
  }
]

// Mock vendor master data at different times
const mockVendorMasterSnapshots = {
  transaction: {
    timestamp: '2026-01-28T14:00:00Z',
    data: {
      vendorId: 'V-10001',
      vendorName: 'Vendor Alpha Inc',
      bankAccount: 'DE89370400440532013000',
      bankName: 'Deutsche Bank',
      paymentTerms: 'NET30',
      taxId: 'US123456789',
      address: '123 Main St, New York, NY 10001',
      contactEmail: 'ap@vendoralpha.com',
      riskCategory: 'Medium',
      creditLimit: 500000,
      lastModified: '2026-01-25T10:30:00Z',
      modifiedBy: 'SYSTEM_BATCH'
    }
  },
  current: {
    timestamp: '2026-01-30T09:00:00Z',
    data: {
      vendorId: 'V-10001',
      vendorName: 'Vendor Alpha Inc',
      bankAccount: 'GB82WEST12345698765432',
      bankName: 'Barclays Bank',
      paymentTerms: 'NET30',
      taxId: 'US123456789',
      address: '123 Main St, New York, NY 10001',
      contactEmail: 'ap@vendoralpha.com',
      riskCategory: 'High',
      creditLimit: 500000,
      lastModified: '2026-01-29T08:15:00Z',
      modifiedBy: 'USER_AP001'
    }
  }
}

const getChangedFields = () => {
  const changes: { field: string; oldValue: string; newValue: string }[] = []
  const txnData = mockVendorMasterSnapshots.transaction.data
  const currData = mockVendorMasterSnapshots.current.data
  
  Object.keys(txnData).forEach(key => {
    const k = key as keyof typeof txnData
    if (txnData[k] !== currData[k]) {
      changes.push({
        field: key,
        oldValue: String(txnData[k]),
        newValue: String(currData[k])
      })
    }
  })
  return changes
}

export default function LineagePage() {
  const searchParams = useSearchParams()
  const caseId = searchParams.get('caseId') || 'case-001'
  
  const [timeTravelValue, setTimeTravelValue] = useState([0])
  const [selectedStep, setSelectedStep] = useState<string | null>(null)
  
  // Time-travel: 0 = transaction time, 100 = current
  const isTransactionTime = timeTravelValue[0] < 50
  const activeSnapshot = isTransactionTime 
    ? mockVendorMasterSnapshots.transaction 
    : mockVendorMasterSnapshots.current
  
  const changedFields = getChangedFields()

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Page Header */}
      <div className="border-b border-border bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/cases/${caseId}`}>
              <Button variant="ghost" size="icon" className="h-8 w-8 bg-transparent">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Data Lineage & Evidence</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Trace the complete data journey from source to case creation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <FileText className="h-3 w-3" />
              Case: CS-2026-0001
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Lineage Flow */}
        <div className="lg:w-1/2 border-b lg:border-b-0 lg:border-r border-border flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-muted/30">
            <h2 className="text-sm font-medium flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Data Lineage Pipeline
            </h2>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-6">
              {/* Horizontal Step Indicator */}
              <div className="relative mb-8">
                <div className="absolute top-6 left-0 right-0 h-0.5 bg-border" />
                <div className="relative flex justify-between">
                  {mockLineageSteps.map((step, index) => (
                    <div key={step.id} className="flex flex-col items-center relative z-10">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setSelectedStep(selectedStep === step.id ? null : step.id)}
                              className={cn(
                                "h-12 w-12 rounded-full flex items-center justify-center transition-all",
                                step.status === 'complete' 
                                  ? "bg-success text-success-foreground" 
                                  : "bg-muted text-muted-foreground",
                                selectedStep === step.id && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                              )}
                            >
                              {index === 0 && <Server className="h-5 w-5" />}
                              {index === 1 && <Database className="h-5 w-5" />}
                              {index === 2 && <Brain className="h-5 w-5" />}
                              {index === 3 && <AlertTriangle className="h-5 w-5" />}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{step.name}</p>
                            <p className="text-xs text-muted-foreground">{new Date(step.timestamp).toLocaleTimeString()}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <span className="text-xs font-medium mt-2 text-center max-w-[80px]">{step.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Selected Step Details */}
              {selectedStep && (
                <Card className="bg-muted/30 mb-6">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Step Details: {mockLineageSteps.find(s => s.id === selectedStep)?.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {(() => {
                      const step = mockLineageSteps.find(s => s.id === selectedStep)
                      if (!step) return null
                      return (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant="outline">{step.system}</Badge>
                            <span className="text-muted-foreground">|</span>
                            <span className="text-muted-foreground">{new Date(step.timestamp).toLocaleString()}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {Object.entries(step.details).map(([key, value]) => (
                              <div key={key} className="bg-background/50 rounded p-2">
                                <span className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                                <p className="text-sm font-mono font-medium">{String(value)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                  </CardContent>
                </Card>
              )}

              {/* All Steps List */}
              <div className="space-y-3">
                {mockLineageSteps.map((step, index) => (
                  <Card 
                    key={step.id}
                    className={cn(
                      "bg-card transition-colors cursor-pointer",
                      selectedStep === step.id && "border-primary"
                    )}
                    onClick={() => setSelectedStep(selectedStep === step.id ? null : step.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0",
                          step.status === 'complete' ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
                        )}>
                          {index === 0 && <Server className="h-5 w-5" />}
                          {index === 1 && <Database className="h-5 w-5" />}
                          {index === 2 && <Brain className="h-5 w-5" />}
                          {index === 3 && <AlertTriangle className="h-5 w-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{step.name}</p>
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          </div>
                          <p className="text-xs text-muted-foreground">{step.system}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-mono">{new Date(step.timestamp).toLocaleTimeString()}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(step.timestamp).toLocaleDateString()}</p>
                        </div>
                        <ChevronRight className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform",
                          selectedStep === step.id && "rotate-90"
                        )} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Right: Time-Travel Viewer */}
        <div className="lg:w-1/2 flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-muted/30">
            <h2 className="text-sm font-medium flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
              Time-Travel: Vendor Master Data
            </h2>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {/* Time-Travel Slider */}
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium">View data at:</span>
                    <Badge variant={isTransactionTime ? "default" : "secondary"}>
                      {isTransactionTime ? 'Transaction Time' : 'Current State'}
                    </Badge>
                  </div>
                  <div className="space-y-4">
                    <Slider
                      value={timeTravelValue}
                      onValueChange={setTimeTravelValue}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <div className="flex flex-col items-start">
                        <span className="font-medium text-foreground">Transaction Time</span>
                        <span>{new Date(mockVendorMasterSnapshots.transaction.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="font-medium text-foreground">Current State</span>
                        <span>{new Date(mockVendorMasterSnapshots.current.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Changes Summary */}
              {changedFields.length > 0 && (
                <Card className="bg-warning/10 border-warning/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      <span className="text-sm font-medium text-warning">{changedFields.length} field(s) changed since transaction</span>
                    </div>
                    <div className="space-y-2">
                      {changedFields.map((change, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="font-medium capitalize">{change.field.replace(/([A-Z])/g, ' $1')}:</span>
                          <span className="text-muted-foreground line-through">{change.oldValue}</span>
                          <ArrowRight className="h-3 w-3" />
                          <span className="text-warning font-medium">{change.newValue}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Vendor Master Data */}
              <Card className="bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      Vendor Master Record
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">
                      As of: {new Date(activeSnapshot.timestamp).toLocaleString()}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(activeSnapshot.data).map(([key, value]) => {
                      const isChanged = changedFields.some(c => c.field === key)
                      return (
                        <div 
                          key={key} 
                          className={cn(
                            "p-3 rounded-lg",
                            isChanged && !isTransactionTime 
                              ? "bg-warning/10 border border-warning/30" 
                              : "bg-muted/50"
                          )}
                        >
                          <span className="text-xs text-muted-foreground capitalize">
                            {key.replace(/([A-Z])/g, ' $1')}
                          </span>
                          <p className={cn(
                            "text-sm font-medium truncate mt-0.5",
                            isChanged && !isTransactionTime && "text-warning"
                          )}>
                            {typeof value === 'number' ? value.toLocaleString() : value}
                          </p>
                          {isChanged && (
                            <span className="text-[10px] text-warning">Changed</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Modification Log */}
              <Card className="bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    Recent Modifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="h-8 w-8 rounded-full bg-warning/20 text-warning flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Bank Account Changed</p>
                        <p className="text-xs text-muted-foreground">Modified by USER_AP001</p>
                        <p className="text-xs text-muted-foreground mt-1">2026-01-29 08:15:00</p>
                      </div>
                      <SeverityBadge severity="high" size="sm" />
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center flex-shrink-0">
                        <Database className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Risk Category Updated</p>
                        <p className="text-xs text-muted-foreground">Auto-updated by Risk Engine</p>
                        <p className="text-xs text-muted-foreground mt-1">2026-01-29 08:16:00</p>
                      </div>
                      <SeverityBadge severity="medium" size="sm" />
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
