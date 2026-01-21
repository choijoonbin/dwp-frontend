"use client";

import type { Role } from "@admin/pages/roles/roles-screen-redesign/lib/types";

import { Input } from "@dwp-frontend/design-system/shadcn/components/ui/input";
import { Label } from "@dwp-frontend/design-system/shadcn/components/ui/label";
import { Switch } from "@dwp-frontend/design-system/shadcn/components/ui/switch";
import { Textarea } from "@dwp-frontend/design-system/shadcn/components/ui/textarea";
import { Card, CardTitle, CardHeader, CardContent, CardDescription } from "@dwp-frontend/design-system/shadcn/components/ui/card";

interface RoleOverviewProps {
  role: Role;
  onChange: (updates: Partial<Role>) => void;
}

export function RoleOverview({ role, onChange }: RoleOverviewProps) {
  const formatDate = (dateString: string) => new Date(dateString).toLocaleString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-6 overflow-y-auto p-2">
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">기본 정보</CardTitle>
          <CardDescription>역할의 기본 정보를 수정합니다</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">역할명</Label>
              <Input
                id="name"
                value={role.name}
                onChange={(e) => onChange({ name: e.target.value })}
                placeholder="역할 이름을 입력하세요"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">역할 코드</Label>
              <Input
                id="code"
                value={role.code}
                disabled
                className="bg-muted font-mono"
              />
              <p className="text-xs text-muted-foreground">
                역할 코드는 생성 후 변경할 수 없습니다
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">설명 (선택)</Label>
            <Textarea
              id="description"
              value={role.description || ""}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="역할에 대한 설명을 입력하세요"
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="status">활성 상태</Label>
              <p className="text-sm text-muted-foreground">
                비활성화 시 이 역할을 가진 사용자의 권한이 적용되지 않습니다
              </p>
            </div>
            <Switch
              id="status"
              checked={role.status === "ACTIVE"}
              onCheckedChange={(checked) =>
                onChange({ status: checked ? "ACTIVE" : "INACTIVE" })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">이력 정보</CardTitle>
          <CardDescription>역할의 생성 및 수정 이력입니다</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">생성일</dt>
              <dd className="mt-1 text-sm text-foreground">
                {formatDate(role.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">최근 수정일</dt>
              <dd className="mt-1 text-sm text-foreground">
                {formatDate(role.updatedAt)}
              </dd>
            </div>
            {role.updatedBy && (
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-muted-foreground">
                  최근 수정자
                </dt>
                <dd className="mt-1 text-sm text-foreground">{role.updatedBy}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">통계</CardTitle>
          <CardDescription>이 역할에 할당된 멤버 현황입니다</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-secondary p-4">
              <p className="text-2xl font-bold text-foreground">
                {role.memberCount}
                <span className="text-sm font-normal text-muted-foreground">명</span>
              </p>
              <p className="text-sm text-muted-foreground">할당된 사용자</p>
            </div>
            <div className="rounded-lg bg-secondary p-4">
              <p className="text-2xl font-bold text-foreground">
                {role.departmentCount}
                <span className="text-sm font-normal text-muted-foreground">개</span>
              </p>
              <p className="text-sm text-muted-foreground">할당된 부서</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
