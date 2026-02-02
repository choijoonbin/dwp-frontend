"use client"

import { useMemo, useState } from "react"
import {
  Users,
  Shield,
  Building2,
  Globe,
  Lock,
  Key,
  Search,
  Filter,
  UserPlus,
  Settings2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Role = "Finance_Viewer" | "Finance_Operator" | "Finance_Admin" | "Security_Admin"

type UserRow = {
  id: string
  name: string
  email: string
  role: Role
  status: "active" | "invited" | "disabled"
  lastLoginAt: string
  mfa: boolean
}

const usersSeed: UserRow[] = [
  {
    id: "U-1001",
    name: "J. Park",
    email: "j.park@enterprise.com",
    role: "Finance_Admin",
    status: "active",
    lastLoginAt: "2026-02-01T09:12:00Z",
    mfa: true,
  },
  {
    id: "U-1002",
    name: "M. Kim",
    email: "m.kim@enterprise.com",
    role: "Finance_Operator",
    status: "active",
    lastLoginAt: "2026-02-01T03:41:00Z",
    mfa: true,
  },
  {
    id: "U-1003",
    name: "S. Lee",
    email: "s.lee@enterprise.com",
    role: "Finance_Viewer",
    status: "invited",
    lastLoginAt: "-",
    mfa: false,
  },
  {
    id: "U-1004",
    name: "Security Ops",
    email: "secops@enterprise.com",
    role: "Security_Admin",
    status: "active",
    lastLoginAt: "2026-01-31T22:55:00Z",
    mfa: true,
  },
]

const tenants = [
  { id: 200000, name: "Global Retail Group" },
  { id: 400000, name: "Manufacturing HQ" },
]

export default function AdminPage() {
  const [tab, setTab] = useState("users")
  const [q, setQ] = useState("")
  const [tenantId, setTenantId] = useState("200000")

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return usersSeed
    return usersSeed.filter((u) => (u.name + u.email + u.id).toLowerCase().includes(needle))
  }, [q])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
          <p className="text-sm text-muted-foreground">Tenant setup, access control, and data protection policies.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={tenantId} onValueChange={setTenantId}>
            <SelectTrigger className="w-[220px] bg-transparent">
              <SelectValue placeholder="Tenant" />
            </SelectTrigger>
            <SelectContent>
              {tenants.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.name} ({t.id})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="gap-2">
            <UserPlus className="h-4 w-4" />
            Invite User
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                Administration Console
              </CardTitle>
              <CardDescription>RBAC + SoD, tenant/company/currency scope, and PII masking.</CardDescription>
            </div>
            <div className="relative w-[280px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users..." className="pl-9 bg-transparent" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="users" className="gap-2">
                <Users className="h-4 w-4" />
                Users
              </TabsTrigger>
              <TabsTrigger value="scope" className="gap-2">
                <Globe className="h-4 w-4" />
                Tenant Scope
              </TabsTrigger>
              <TabsTrigger value="pii" className="gap-2">
                <Lock className="h-4 w-4" />
                PII & Encryption
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="mt-4">
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>MFA</TableHead>
                      <TableHead>Last login</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="font-medium">{u.name}</div>
                          <div className="text-xs text-muted-foreground">{u.email} • {u.id}</div>
                        </TableCell>
                        <TableCell>
                          <div className="inline-flex items-center gap-2">
                            <Shield className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{u.role}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("border", statusPill(u.status))}>
                            {u.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("border", u.mfa ? "bg-success/10 text-success border-success/20" : "bg-warning/10 text-warning border-warning/20")}>
                            {u.mfa ? "Enabled" : "Off"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDateMaybe(u.lastLoginAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Separator className="my-4" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <MiniStat icon={Shield} label="RBAC" value="Role-based" />
                <MiniStat icon={Key} label="SoD" value="Enforced" pill="critical" />
                <MiniStat icon={Filter} label="Saved Views" value="Org-scoped" />
              </div>
            </TabsContent>

            <TabsContent value="scope" className="mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Building2 className="h-4 w-4" />
                      Company Codes
                    </CardTitle>
                    <CardDescription>Multi-company support and access scope.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {["1000", "2000", "3000"].map((c) => (
                      <div key={c} className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <div className="font-medium">BUKRS {c}</div>
                          <div className="text-xs text-muted-foreground">Included in tenant scope</div>
                        </div>
                        <Switch defaultChecked />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Globe className="h-4 w-4" />
                      Currencies
                    </CardTitle>
                    <CardDescription>Multi-currency with FX controls.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {["USD", "EUR", "KRW", "JPY"].map((cur) => (
                      <div key={cur} className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <div className="font-medium">{cur}</div>
                          <div className="text-xs text-muted-foreground">Allowed postings and reports</div>
                        </div>
                        <Switch defaultChecked={cur !== "JPY"} />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Shield className="h-4 w-4" />
                      Segregation of Duties
                    </CardTitle>
                    <CardDescription>Prevent risky combinations for approvals and execution.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <SoDRule title="No self-approve" desc="Requester cannot approve own payment block." />
                    <SoDRule title="Dual control" desc="High value actions require two approvals." />
                    <SoDRule title="Finance vs Security" desc="Security admins cannot edit policies." />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="pii" className="mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Lock className="h-4 w-4" />
                      Masking Policy
                    </CardTitle>
                    <CardDescription>Field-level controls for IBAN, account, tax IDs.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <MaskRule field="Vendor IBAN" hint="Mask by default; reveal via access workflow" />
                    <MaskRule field="Bank Account" hint="Show last 4 digits; log all reveals" />
                    <MaskRule field="Tax ID" hint="Fully masked; export requires Security_Admin" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Key className="h-4 w-4" />
                      Encryption & Retention
                    </CardTitle>
                    <CardDescription>Enterprise-ready data lifecycle controls.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-md border p-3">
                      <div className="font-medium">At-rest encryption</div>
                      <div className="text-xs text-muted-foreground">KMS-managed keys (mock)</div>
                      <div className="mt-2 flex items-center justify-between">
                        <Badge variant="outline" className="border bg-success/10 text-success border-success/20">Enabled</Badge>
                        <Switch defaultChecked />
                      </div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="font-medium">Audit retention</div>
                      <div className="text-xs text-muted-foreground">Keep audit trails for 7 years</div>
                      <div className="mt-2 flex items-center justify-between">
                        <Badge variant="outline" className="border">7y</Badge>
                        <Switch defaultChecked />
                      </div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="font-medium">Export controls</div>
                      <div className="text-xs text-muted-foreground">ZIP export requires approvals</div>
                      <div className="mt-2 flex items-center justify-between">
                        <Badge variant="outline" className="border bg-warning/10 text-warning border-warning/20">Approval</Badge>
                        <Switch defaultChecked />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          <Separator className="my-4" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Tenant {tenantId} • Mock admin console</span>
            <Badge variant="outline" className="gap-1">
              <Lock className="h-3.5 w-3.5" />
              audit-ready
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function statusPill(status: UserRow["status"]) {
  if (status === "active") return "bg-success/10 text-success border-success/20"
  if (status === "invited") return "bg-info/10 text-info border-info/20"
  return "bg-muted text-muted-foreground"
}

function formatDateMaybe(v: string) {
  if (v === "-" || !v) return "-"
  try {
    return new Date(v).toLocaleString()
  } catch {
    return v
  }
}

function MiniStat({ icon: Icon, label, value, pill }: { icon: any; label: string; value: string; pill?: "critical" }) {
  return (
    <div className="rounded-lg border p-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="font-semibold">{value}</div>
        </div>
      </div>
      {pill && (
        <Badge variant="outline" className={cn("border", "bg-destructive/10 text-destructive border-destructive/20")}>
          SoD
        </Badge>
      )}
    </div>
  )
}

function SoDRule({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="font-medium">{title}</div>
      <div className="text-xs text-muted-foreground mt-1">{desc}</div>
    </div>
  )
}

function MaskRule({ field, hint }: { field: string; hint: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div>
        <div className="font-medium">{field}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <Switch defaultChecked />
    </div>
  )
}
