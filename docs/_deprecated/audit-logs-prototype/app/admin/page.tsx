"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Menu, Code2, Link2, FileText, ArrowRight, Activity, Users, Database, Shield } from "lucide-react"

const stats = [
  {
    name: "전체 메뉴",
    value: "24",
    change: "+2",
    changeType: "positive",
    icon: Menu,
  },
  {
    name: "코드 그룹",
    value: "18",
    change: "+1",
    changeType: "positive",
    icon: Code2,
  },
  {
    name: "코드 매핑",
    value: "156",
    change: "+12",
    changeType: "positive",
    icon: Link2,
  },
  {
    name: "오늘 감사 로그",
    value: "342",
    change: "+48",
    changeType: "neutral",
    icon: FileText,
  },
]

const quickLinks = [
  {
    title: "메뉴 관리",
    description: "사이드바 메뉴 트리를 구성하고 메뉴 항목을 관리합니다.",
    href: "/admin/menus",
    icon: Menu,
    color: "bg-blue-500/10 text-blue-500",
  },
  {
    title: "코드 관리",
    description: "드롭다운과 검증에 사용되는 코드 그룹 및 코드를 관리합니다.",
    href: "/admin/codes",
    icon: Code2,
    color: "bg-emerald-500/10 text-emerald-500",
  },
  {
    title: "코드 사용 정의",
    description: "각 메뉴에서 사용할 코드 그룹을 매핑합니다.",
    href: "/admin/code-usage",
    icon: Link2,
    color: "bg-amber-500/10 text-amber-500",
  },
  {
    title: "감사 로그",
    description: "시스템 변경 이력을 조회하고 보안 감사를 수행합니다.",
    href: "/admin/audit-logs",
    icon: FileText,
    color: "bg-purple-500/10 text-purple-500",
  },
]

const recentActivities = [
  {
    action: "메뉴 생성",
    target: "menu.admin.monitoring",
    user: "admin@dwp.com",
    time: "5분 전",
  },
  {
    action: "코드 수정",
    target: "STATUS.ACTIVE",
    user: "system@dwp.com",
    time: "12분 전",
  },
  {
    action: "매핑 추가",
    target: "menu.admin.users → USER_TYPE",
    user: "admin@dwp.com",
    time: "1시간 전",
  },
  {
    action: "메뉴 비활성화",
    target: "menu.legacy.reports",
    user: "admin@dwp.com",
    time: "2시간 전",
  },
]

export default function AdminDashboard() {
  return (
    <div className="p-6 space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name} className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.name}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">{stat.value}</span>
                <Badge 
                  variant={stat.changeType === "positive" ? "default" : "secondary"}
                  className="text-xs"
                >
                  {stat.change}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">관리 메뉴 바로가기</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="group bg-card border-border hover:border-primary/50 transition-all duration-200 cursor-pointer h-full">
                <CardHeader className="flex flex-row items-start gap-4">
                  <div className={`p-2.5 rounded-lg ${link.color}`}>
                    <link.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                      {link.title}
                      <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                    </CardTitle>
                    <CardDescription className="mt-1 text-sm text-muted-foreground">
                      {link.description}
                    </CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* System Status & Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* System Status */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">시스템 상태</CardTitle>
            <CardDescription>현재 시스템 운영 현황</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Activity className="h-4 w-4 text-emerald-500" />
                </div>
                <span className="text-sm text-foreground">API 서버</span>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-500 border-0">정상</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Database className="h-4 w-4 text-emerald-500" />
                </div>
                <span className="text-sm text-foreground">데이터베이스</span>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-500 border-0">정상</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Users className="h-4 w-4 text-emerald-500" />
                </div>
                <span className="text-sm text-foreground">활성 세션</span>
              </div>
              <span className="text-sm font-medium text-foreground">127</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Shield className="h-4 w-4 text-emerald-500" />
                </div>
                <span className="text-sm text-foreground">보안 상태</span>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-500 border-0">양호</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-foreground">최근 활동</CardTitle>
              <CardDescription>최근 시스템 변경 이력</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/audit-logs">
                전체 보기
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.map((activity, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                    {activity.user.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{activity.action}</span>
                      <span className="text-muted-foreground"> · </span>
                      <span className="text-muted-foreground font-mono text-xs">{activity.target}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {activity.user} · {activity.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
