"use client"

import { useState } from "react"
import {
  Search,
  Plus,
  MoreHorizontal,
  Pencil,
  Key,
  Shield,
  Trash2,
  UserCircle,
  Mail,
  Building2,
  Calendar,
  Clock,
  ChevronDown,
  X,
  Eye,
  EyeOff,
  Loader2,
  Users,
  AlertCircle,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"

// Types
interface User {
  id: string
  userName: string
  email: string
  department: string
  status: "ACTIVE" | "INACTIVE" | "LOCKED" | "PENDING"
  loginType: "LOCAL" | "OIDC" | "SAML"
  roles: string[]
  lastLoginAt: string | null
  createdAt: string
}

interface Role {
  id: string
  name: string
  description: string
}

// Mock Data
const mockUsers: User[] = [
  {
    id: "1",
    userName: "김철수",
    email: "kim.cs@company.com",
    department: "개발팀",
    status: "ACTIVE",
    loginType: "LOCAL",
    roles: ["Admin", "Developer"],
    lastLoginAt: "2026-01-20T09:30:00Z",
    createdAt: "2025-06-15T00:00:00Z",
  },
  {
    id: "2",
    userName: "이영희",
    email: "lee.yh@company.com",
    department: "기획팀",
    status: "ACTIVE",
    loginType: "OIDC",
    roles: ["Viewer"],
    lastLoginAt: "2026-01-19T14:20:00Z",
    createdAt: "2025-08-20T00:00:00Z",
  },
  {
    id: "3",
    userName: "박민준",
    email: "park.mj@company.com",
    department: "운영팀",
    status: "INACTIVE",
    loginType: "LOCAL",
    roles: ["Operator"],
    lastLoginAt: "2025-12-01T10:00:00Z",
    createdAt: "2025-03-10T00:00:00Z",
  },
  {
    id: "4",
    userName: "정수현",
    email: "jung.sh@company.com",
    department: "개발팀",
    status: "LOCKED",
    loginType: "SAML",
    roles: ["Developer"],
    lastLoginAt: null,
    createdAt: "2025-11-01T00:00:00Z",
  },
  {
    id: "5",
    userName: "최지은",
    email: "choi.je@company.com",
    department: "인사팀",
    status: "PENDING",
    loginType: "LOCAL",
    roles: [],
    lastLoginAt: null,
    createdAt: "2026-01-18T00:00:00Z",
  },
]

const mockRoles: Role[] = [
  { id: "1", name: "Admin", description: "시스템 전체 관리 권한" },
  { id: "2", name: "Developer", description: "개발 관련 기능 접근 권한" },
  { id: "3", name: "Operator", description: "운영 관련 기능 접근 권한" },
  { id: "4", name: "Viewer", description: "읽기 전용 권한" },
]

const statusMap = {
  ACTIVE: { label: "활성", variant: "default" as const },
  INACTIVE: { label: "비활성", variant: "secondary" as const },
  LOCKED: { label: "잠금", variant: "destructive" as const },
  PENDING: { label: "대기", variant: "outline" as const },
}

const loginTypeMap = {
  LOCAL: { label: "로컬", icon: Key },
  OIDC: { label: "OIDC", icon: Shield },
  SAML: { label: "SAML", icon: Shield },
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>(mockUsers)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [loginTypeFilter, setLoginTypeFilter] = useState<string>("all")
  const [departmentFilter, setDepartmentFilter] = useState<string>("all")
  
  // Dialog states
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  
  // Form states
  const [editForm, setEditForm] = useState({
    userName: "",
    email: "",
    status: "ACTIVE" as User["status"],
  })
  const [createForm, setCreateForm] = useState({
    userName: "",
    email: "",
    createLocalAccount: false,
    principal: "",
    password: "",
  })
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [newPassword, setNewPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  // Get unique departments
  const departments = [...new Set(users.map((u) => u.department))]

  // Filter users
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || user.status === statusFilter
    const matchesLoginType = loginTypeFilter === "all" || user.loginType === loginTypeFilter
    const matchesDepartment = departmentFilter === "all" || user.department === departmentFilter
    return matchesSearch && matchesStatus && matchesLoginType && matchesDepartment
  })

  const hasActiveFilters = statusFilter !== "all" || loginTypeFilter !== "all" || departmentFilter !== "all" || searchQuery !== ""

  // Handlers
  const handleRowClick = (user: User) => {
    setSelectedUser(user)
    setDetailDrawerOpen(true)
  }

  const openEditDialog = (user: User) => {
    setSelectedUser(user)
    setEditForm({
      userName: user.userName,
      email: user.email,
      status: user.status,
    })
    setEditDialogOpen(true)
  }

  const openRoleDialog = (user: User) => {
    setSelectedUser(user)
    setSelectedRoles(user.roles)
    setRoleDialogOpen(true)
  }

  const openResetPasswordDialog = (user: User) => {
    setSelectedUser(user)
    setNewPassword("")
    setResetPasswordDialogOpen(true)
  }

  const openDeleteDialog = (user: User) => {
    setSelectedUser(user)
    setDeleteDialogOpen(true)
  }

  const handleCreateUser = () => {
    // Mock create
    const newUser: User = {
      id: String(Date.now()),
      userName: createForm.userName,
      email: createForm.email,
      department: "미지정",
      status: "PENDING",
      loginType: createForm.createLocalAccount ? "LOCAL" : "OIDC",
      roles: [],
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
    }
    setUsers([newUser, ...users])
    setCreateDialogOpen(false)
    setCreateForm({ userName: "", email: "", createLocalAccount: false, principal: "", password: "" })
  }

  const handleUpdateUser = () => {
    if (!selectedUser) return
    setUsers(users.map((u) =>
      u.id === selectedUser.id ? { ...u, ...editForm } : u
    ))
    setEditDialogOpen(false)
  }

  const handleUpdateRoles = () => {
    if (!selectedUser) return
    setUsers(users.map((u) =>
      u.id === selectedUser.id ? { ...u, roles: selectedRoles } : u
    ))
    setRoleDialogOpen(false)
  }

  const handleResetPassword = () => {
    // Mock reset password
    setResetPasswordDialogOpen(false)
    setNewPassword("")
  }

  const handleDeleteUser = () => {
    if (!selectedUser) return
    setUsers(users.filter((u) => u.id !== selectedUser.id))
    setDeleteDialogOpen(false)
  }

  const resetFilters = () => {
    setSearchQuery("")
    setStatusFilter("all")
    setLoginTypeFilter("all")
    setDepartmentFilter("all")
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-"
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatDateShort = (dateString: string | null) => {
    if (!dateString) return "-"
    return new Date(dateString).toLocaleDateString("ko-KR")
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 md:p-6 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div>
              <h1 className="text-xl md:text-2xl font-semibold text-foreground">사용자 관리</h1>
              <p className="text-sm text-muted-foreground mt-1">
                사용자 계정 및 권한을 관리합니다
              </p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2 shrink-0">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">사용자 추가</span>
              <span className="sm:hidden">추가</span>
            </Button>
          </div>

          {/* Filter Bar */}
          <div className="p-4 md:px-6 border-b border-border bg-muted/30">
            <div className="flex flex-col lg:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="이름, 이메일로 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="상태" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">모든 상태</SelectItem>
                    <SelectItem value="ACTIVE">활성</SelectItem>
                    <SelectItem value="INACTIVE">비활성</SelectItem>
                    <SelectItem value="LOCKED">잠금</SelectItem>
                    <SelectItem value="PENDING">대기</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={loginTypeFilter} onValueChange={setLoginTypeFilter}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="로그인 유형" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">모든 유형</SelectItem>
                    <SelectItem value="LOCAL">로컬</SelectItem>
                    <SelectItem value="OIDC">OIDC</SelectItem>
                    <SelectItem value="SAML">SAML</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="부서" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">모든 부서</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1 h-10">
                    <X className="h-4 w-4" />
                    초기화
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Table - Desktop */}
          <div className="flex-1 overflow-auto p-4 md:px-6 hidden md:block">
            <div className="border border-border rounded-lg overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-[200px]">사용자</TableHead>
                      <TableHead className="w-[200px]">이메일</TableHead>
                      <TableHead className="w-[120px]">부서</TableHead>
                      <TableHead className="w-[100px]">상태</TableHead>
                      <TableHead className="w-[100px]">로그인</TableHead>
                      <TableHead className="w-[150px]">마지막 로그인</TableHead>
                      <TableHead className="w-[120px]">생성일</TableHead>
                      <TableHead className="w-[60px] text-right">작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={8}>
                            <div className="h-12 bg-muted animate-pulse rounded" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-32 text-center">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Users className="h-8 w-8 opacity-50" />
                            <p>사용자가 없습니다</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => {
                        const LoginIcon = loginTypeMap[user.loginType].icon
                        return (
                          <TableRow
                            key={user.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleRowClick(user)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium shrink-0">
                                  {user.userName.charAt(0)}
                                </div>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="font-medium truncate max-w-[150px]">{user.userName}</span>
                                  </TooltipTrigger>
                                  <TooltipContent>{user.userName}</TooltipContent>
                                </Tooltip>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-muted-foreground truncate block max-w-[180px]">{user.email}</span>
                                </TooltipTrigger>
                                <TooltipContent>{user.email}</TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <span className="text-muted-foreground">{user.department}</span>
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusMap[user.status].variant}>
                                {statusMap[user.status].label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <LoginIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm">{loginTypeMap[user.loginType].label}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {formatDate(user.lastLoginAt)}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {formatDateShort(user.createdAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(user) }}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    편집
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openRoleDialog(user) }}>
                                    <Shield className="mr-2 h-4 w-4" />
                                    역할 관리
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openResetPasswordDialog(user) }}>
                                    <Key className="mr-2 h-4 w-4" />
                                    비밀번호 초기화
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={(e) => { e.stopPropagation(); openDeleteDialog(user) }}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    삭제
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Summary */}
            <div className="flex items-center justify-between text-sm text-muted-foreground px-1 mt-4">
              <span>총 {filteredUsers.length}명의 사용자</span>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="flex-1 overflow-auto p-4 md:hidden">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                <p>로딩 중...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Users className="h-8 w-8 mb-2 opacity-50" />
                <p>사용자가 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUsers.map((user) => {
                  const LoginIcon = loginTypeMap[user.loginType].icon
                  return (
                    <Card
                      key={user.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleRowClick(user)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium shrink-0">
                              {user.userName.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium">{user.userName}</p>
                              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(user) }}>
                                <Pencil className="mr-2 h-4 w-4" />
                                편집
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openRoleDialog(user) }}>
                                <Shield className="mr-2 h-4 w-4" />
                                역할 관리
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openResetPasswordDialog(user) }}>
                                <Key className="mr-2 h-4 w-4" />
                                비밀번호 초기화
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); openDeleteDialog(user) }}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                삭제
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={statusMap[user.status].variant}>
                            {statusMap[user.status].label}
                          </Badge>
                          <Badge variant="outline" className="gap-1">
                            <LoginIcon className="h-3 w-3" />
                            {loginTypeMap[user.loginType].label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{user.department}</span>
                        </div>
                        {user.roles.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {user.roles.map((role) => (
                              <Badge key={role} variant="secondary" className="text-[10px] px-1.5 py-0">
                                {role}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}

            {/* Mobile Summary */}
            <div className="text-sm text-muted-foreground text-center mt-4">
              총 {filteredUsers.length}명의 사용자
            </div>
          </div>

          {/* Detail Drawer */}
          <Sheet open={detailDrawerOpen} onOpenChange={setDetailDrawerOpen}>
            <SheetContent className="w-full sm:max-w-md overflow-y-auto">
              <SheetHeader>
                <SheetTitle>사용자 상세</SheetTitle>
              </SheetHeader>
              {selectedUser && (
                <div className="mt-6 space-y-6">
                  {/* Identity Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary text-2xl font-semibold">
                        {selectedUser.userName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">{selectedUser.userName}</h3>
                        <p className="text-sm text-muted-foreground">{selectedUser.department}</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Contact Section */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">연락처</h4>
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{selectedUser.email}</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Account Section */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">계정 정보</h4>
                    <div className="grid gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">상태</span>
                        <Badge variant={statusMap[selectedUser.status].variant}>
                          {statusMap[selectedUser.status].label}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">로그인 유형</span>
                        <span className="text-sm">{loginTypeMap[selectedUser.loginType].label}</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Roles Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">역할</h4>
                      <Button variant="ghost" size="sm" onClick={() => { setDetailDrawerOpen(false); openRoleDialog(selectedUser) }}>
                        <Pencil className="mr-2 h-3 w-3" />
                        관리
                      </Button>
                    </div>
                    {selectedUser.roles.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedUser.roles.map((role) => (
                          <Badge key={role} variant="secondary">{role}</Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">할당된 역할이 없습니다</p>
                    )}
                  </div>

                  <Separator />

                  {/* Audit Section */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">감사 정보</h4>
                    <div className="grid gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">마지막 로그인</span>
                        </div>
                        <span className="text-sm">{formatDate(selectedUser.lastLoginAt)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">생성일</span>
                        </div>
                        <span className="text-sm">{formatDateShort(selectedUser.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 flex flex-col gap-2">
                    <Button variant="outline" className="w-full bg-transparent" onClick={() => { setDetailDrawerOpen(false); openEditDialog(selectedUser) }}>
                      <Pencil className="mr-2 h-4 w-4" />
                      편집
                    </Button>
                    <Button variant="outline" className="w-full bg-transparent" onClick={() => { setDetailDrawerOpen(false); openResetPasswordDialog(selectedUser) }}>
                      <Key className="mr-2 h-4 w-4" />
                      비밀번호 초기화
                    </Button>
                  </div>
                </div>
              )}
            </SheetContent>
          </Sheet>

          {/* Create User Dialog */}
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>사용자 추가</DialogTitle>
                <DialogDescription>
                  새로운 사용자 계정을 생성합니다
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="create-name">이름 *</Label>
                  <Input
                    id="create-name"
                    value={createForm.userName}
                    onChange={(e) => setCreateForm({ ...createForm, userName: e.target.value })}
                    placeholder="홍길동"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="create-email">이메일</Label>
                  <Input
                    id="create-email"
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder="user@example.com"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="create-local"
                    checked={createForm.createLocalAccount}
                    onCheckedChange={(checked) => setCreateForm({ ...createForm, createLocalAccount: checked })}
                  />
                  <Label htmlFor="create-local">로컬 계정 생성</Label>
                </div>
                {createForm.createLocalAccount && (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="create-principal">사용자 ID *</Label>
                      <Input
                        id="create-principal"
                        value={createForm.principal}
                        onChange={(e) => setCreateForm({ ...createForm, principal: e.target.value })}
                        placeholder="user123"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="create-password">비밀번호 *</Label>
                      <div className="relative">
                        <Input
                          id="create-password"
                          type={showPassword ? "text" : "password"}
                          value={createForm.password}
                          onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                          placeholder="8자 이상, 문자와 숫자 포함"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">8자 이상, 문자와 숫자를 포함해야 합니다</p>
                    </div>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  취소
                </Button>
                <Button onClick={handleCreateUser} disabled={!createForm.userName}>
                  생성
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit User Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>사용자 편집</DialogTitle>
                <DialogDescription>
                  사용자 정보를 수정합니다
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">이름 *</Label>
                  <Input
                    id="edit-name"
                    value={editForm.userName}
                    onChange={(e) => setEditForm({ ...editForm, userName: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-email">이메일</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-status">상태</Label>
                  <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v as User["status"] })}>
                    <SelectTrigger id="edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">활성</SelectItem>
                      <SelectItem value="INACTIVE">비활성</SelectItem>
                      <SelectItem value="LOCKED">잠금</SelectItem>
                      <SelectItem value="PENDING">대기</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  취소
                </Button>
                <Button onClick={handleUpdateUser} disabled={!editForm.userName}>
                  저장
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Role Assignment Dialog */}
          <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>역할 관리</DialogTitle>
                <DialogDescription>
                  {selectedUser?.userName}님의 역할을 설정합니다
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="space-y-3">
                  {mockRoles.map((role) => (
                    <div key={role.id} className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50">
                      <Checkbox
                        id={`role-${role.id}`}
                        checked={selectedRoles.includes(role.name)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedRoles([...selectedRoles, role.name])
                          } else {
                            setSelectedRoles(selectedRoles.filter((r) => r !== role.name))
                          }
                        }}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label
                          htmlFor={`role-${role.id}`}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {role.name}
                        </label>
                        <p className="text-xs text-muted-foreground">
                          {role.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
                  취소
                </Button>
                <Button onClick={handleUpdateRoles}>
                  저장
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Reset Password Dialog */}
          <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>비밀번호 초기화</DialogTitle>
                <DialogDescription>
                  {selectedUser?.userName}님의 비밀번호를 초기화합니다
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="grid gap-2">
                  <Label htmlFor="new-password">새 비밀번호 (선택)</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="비워두면 임시 비밀번호 생성"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    비워두면 시스템이 임시 비밀번호를 생성합니다
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setResetPasswordDialogOpen(false)}>
                  취소
                </Button>
                <Button onClick={handleResetPassword}>
                  초기화
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  사용자 삭제
                </DialogTitle>
                <DialogDescription>
                  정말로 <span className="font-semibold text-foreground">{selectedUser?.userName}</span>님을 삭제하시겠습니까?
                  이 작업은 되돌릴 수 없습니다.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                  취소
                </Button>
                <Button variant="destructive" onClick={handleDeleteUser}>
                  삭제
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
    </TooltipProvider>
  )
}
