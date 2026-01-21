"use client";

import type { Role, RoleFilter } from "@/lib/types";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Users, Clock, Search, Building2, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface RoleListProps {
  roles: Role[];
  selectedRoleId: string | null;
  onSelectRole: (role: Role) => void;
  onCreateRole: () => void;
  isLoading?: boolean;
}

export function RoleList({
  roles,
  selectedRoleId,
  onSelectRole,
  onCreateRole,
  isLoading,
}: RoleListProps) {
  const [filter, setFilter] = useState<RoleFilter>({
    search: "",
    status: "ALL",
    sortBy: "updatedAt",
    sortOrder: "desc",
  });

  const filteredRoles = roles
    .filter((role) => {
      // Search filter
      const searchLower = filter.search.toLowerCase();
      const matchesSearch =
        filter.search === "" ||
        role.name.toLowerCase().includes(searchLower) ||
        role.code.toLowerCase().includes(searchLower);

      // Status filter
      const matchesStatus =
        filter.status === "ALL" || role.status === filter.status;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (filter.sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name, "ko");
          break;
        case "code":
          comparison = a.code.localeCompare(b.code);
          break;
        case "updatedAt":
        default:
          comparison =
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          break;
      }
      return filter.sortOrder === "asc" ? comparison : -comparison;
    });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "오늘";
    if (diffDays === 1) return "어제";
    if (diffDays < 7) return `${diffDays}일 전`;
    return date.toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
    });
  };

  const statusLabels = {
    ALL: "전체 상태",
    ACTIVE: "활성",
    INACTIVE: "비활성",
  };

  const sortLabels = {
    updatedAt: "최근 수정",
    name: "이름",
    code: "코드",
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">역할 목록</h2>
          <Button size="sm" onClick={onCreateRole}>
            <Plus className="mr-1 h-4 w-4" />
            새 역할
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="역할명 또는 코드 검색..."
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            className="pl-9"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                {statusLabels[filter.status]}
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {(Object.keys(statusLabels) as Array<keyof typeof statusLabels>).map(
                (status) => (
                  <DropdownMenuItem
                    key={status}
                    onClick={() => setFilter({ ...filter, status })}
                  >
                    {statusLabels[status]}
                  </DropdownMenuItem>
                )
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                {sortLabels[filter.sortBy]}
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(sortLabels) as Array<keyof typeof sortLabels>).map(
                (sortBy) => (
                  <DropdownMenuItem
                    key={sortBy}
                    onClick={() => setFilter({ ...filter, sortBy })}
                  >
                    {sortLabels[sortBy]}
                  </DropdownMenuItem>
                )
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Role List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          // Skeleton loading
          <div className="space-y-2 p-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-lg bg-secondary"
              />
            ))}
          </div>
        ) : filteredRoles.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="mb-4 rounded-full bg-secondary p-4">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mb-2 font-medium text-foreground">
              검색 결과가 없습니다
            </p>
            <p className="text-sm text-muted-foreground">
              다른 검색어나 필터를 시도해보세요
            </p>
          </div>
        ) : (
          <div className="space-y-2 p-4">
            {filteredRoles.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => onSelectRole(role)}
                className={cn(
                  "w-full rounded-lg border border-border p-4 text-left transition-all hover:border-accent hover:bg-secondary/50",
                  selectedRoleId === role.id &&
                    "border-accent bg-accent/10 ring-1 ring-accent"
                )}
              >
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-foreground">{role.name}</h3>
                    <p className="font-mono text-xs text-muted-foreground">
                      {role.code}
                    </p>
                  </div>
                  <Badge
                    variant={role.status === "ACTIVE" ? "default" : "secondary"}
                    className={cn(
                      role.status === "ACTIVE"
                        ? "bg-success/20 text-success hover:bg-success/30"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {role.status === "ACTIVE" ? "활성" : "비활성"}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {role.memberCount}명
                  </span>
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {role.departmentCount}팀
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(role.updatedAt)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">
          총 {filteredRoles.length}개 역할
        </p>
      </div>
    </div>
  );
}
