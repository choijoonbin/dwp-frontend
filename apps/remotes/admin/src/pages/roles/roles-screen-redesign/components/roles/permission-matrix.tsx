"use client";

import type { Resource, Permission, PermissionCode, PermissionValue } from "@admin/pages/roles/roles-screen-redesign/lib/types";

import { useMemo, useState } from "react";
import { cn } from "@dwp-frontend/design-system/shadcn/lib/utils";
import { Input } from "@dwp-frontend/design-system/shadcn/components/ui/input";
import { Badge } from "@dwp-frontend/design-system/shadcn/components/ui/badge";
import { Button } from "@dwp-frontend/design-system/shadcn/components/ui/button";
import { flattenResources } from "@admin/pages/roles/roles-screen-redesign/lib/mock-data";
import {
  X,
  Check,
  Minus,
  Search,
  Folder,
  Component,
  RotateCcw,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@dwp-frontend/design-system/shadcn/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@dwp-frontend/design-system/shadcn/components/ui/dropdown-menu";

interface PermissionMatrixProps {
  resources: Resource[];
  permissionCodes: PermissionCode[];
  permissions: Permission[];
  onChange: (
    resourceId: string,
    permissionCodeId: string,
    value: PermissionValue
  ) => void;
  onBulkChange: (
    resourceIds: string[],
    permissionCodeId: string | null,
    value: PermissionValue
  ) => void;
}

export function PermissionMatrix({
  resources,
  permissionCodes,
  permissions,
  onChange,
  onBulkChange,
}: PermissionMatrixProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "MENU" | "UI_COMPONENT">("ALL");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(resources.map((r) => r.id)));
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);

  const flatResources = useMemo(() => flattenResources(resources), [resources]);

  const filteredResources = useMemo(() => {
    if (!searchQuery && typeFilter === "ALL") return resources;

    const matchingIds = new Set<string>();
    const searchLower = searchQuery.toLowerCase();

    flatResources.forEach((resource) => {
      const matchesSearch =
        searchQuery === "" ||
        resource.name.toLowerCase().includes(searchLower) ||
        resource.code.toLowerCase().includes(searchLower);
      const matchesType = typeFilter === "ALL" || resource.type === typeFilter;

      if (matchesSearch && matchesType) {
        matchingIds.add(resource.id);
        // Add parent IDs
        if (resource.parentId) {
          matchingIds.add(resource.parentId);
        }
      }
    });

    const filterTree = (items: Resource[]): Resource[] => items
        .filter((item) => {
          const hasMatch = matchingIds.has(item.id);
          const hasChildMatch = item.children?.some((child) =>
            matchingIds.has(child.id)
          );
          return hasMatch || hasChildMatch;
        })
        .map((item) => ({
          ...item,
          children: item.children ? filterTree(item.children) : undefined,
        }));

    return filterTree(resources);
  }, [resources, flatResources, searchQuery, typeFilter]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getPermission = (resourceId: string, permissionCodeId: string): Permission | undefined => permissions.find(
      (p) => p.resourceId === resourceId && p.permissionCodeId === permissionCodeId
    );

  const handleCellClick = (resourceId: string, permissionCodeId: string) => {
    const current = getPermission(resourceId, permissionCodeId);
    let nextValue: PermissionValue;

    if (current?.value === null || current?.value === undefined) {
      nextValue = "ALLOW";
    } else if (current.value === "ALLOW") {
      nextValue = "DENY";
    } else {
      nextValue = null;
    }

    onChange(resourceId, permissionCodeId, nextValue);
  };

  const handleRowBulkAction = (resourceId: string, value: PermissionValue) => {
    const resource = flatResources.find((r) => r.id === resourceId);
    if (!resource) return;

    const resourceIds = [resourceId];
    if (resource.children) {
      const getChildIds = (items: Resource[]): string[] =>
        items.flatMap((item) => [item.id, ...(item.children ? getChildIds(item.children) : [])]);
      resourceIds.push(...getChildIds(resource.children));
    }

    onBulkChange(resourceIds, null, value);
  };

  const handleColumnBulkAction = (permissionCodeId: string, value: PermissionValue) => {
    const allIds = flatResources.map((r) => r.id);
    onBulkChange(allIds, permissionCodeId, value);
  };

  const handleResetAll = () => {
    const allIds = flatResources.map((r) => r.id);
    onBulkChange(allIds, null, null);
  };

  const dirtyCount = permissions.filter((p) => p.isDirty).length;

  const renderResourceRow = (resource: Resource, depth: number = 0) => {
    const hasChildren = resource.children && resource.children.length > 0;
    const isExpanded = expandedIds.has(resource.id);
    const isSelected = selectedResourceId === resource.id;

    return (
      <div key={resource.id}>
        <div
          className={cn(
            "group flex items-center border-b border-border transition-colors",
            isSelected && "bg-accent/10"
          )}
        >
          {/* Resource Name Cell */}
          <div
            className="sticky left-0 z-10 flex min-w-[280px] items-center gap-2 border-r border-border bg-card px-2 py-2"
            style={{ paddingLeft: `${depth * 20 + 8}px` }}
          >
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleExpand(resource.id)}
                className="flex h-5 w-5 items-center justify-center rounded hover:bg-secondary"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            ) : (
              <span className="w-5" />
            )}

            {resource.type === "MENU" ? (
              <Folder className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Component className="h-4 w-4 text-accent" />
            )}

            <button
              type="button"
              onClick={() => setSelectedResourceId(isSelected ? null : resource.id)}
              className="flex-1 text-left"
            >
              <span className="text-sm font-medium text-foreground">
                {resource.name}
              </span>
              <span className="ml-2 font-mono text-xs text-muted-foreground">
                {resource.code}
              </span>
            </button>

            {/* Row bulk action */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1 opacity-0 group-hover:opacity-100"
                >
                  <Minus className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => handleRowBulkAction(resource.id, "ALLOW")}>
                  <Check className="mr-2 h-4 w-4 text-success" />
                  전체 허용
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleRowBulkAction(resource.id, "DENY")}>
                  <X className="mr-2 h-4 w-4 text-destructive" />
                  전체 거부
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleRowBulkAction(resource.id, null)}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  초기화
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Permission Cells */}
          {permissionCodes.map((permCode) => {
            const permission = getPermission(resource.id, permCode.id);
            const value = permission?.value;
            const isDirty = permission?.isDirty;

            return (
              <TooltipProvider key={permCode.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleCellClick(resource.id, permCode.id)}
                      className={cn(
                        "flex h-10 w-20 items-center justify-center border-r border-border transition-all",
                        "hover:bg-secondary/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent",
                        isDirty && "relative"
                      )}
                    >
                      {value === "ALLOW" && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success/20">
                          <Check className="h-4 w-4 text-success" />
                        </div>
                      )}
                      {value === "DENY" && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/20">
                          <X className="h-4 w-4 text-destructive" />
                        </div>
                      )}
                      {!value && (
                        <div className="h-6 w-6 rounded-full border-2 border-dashed border-muted" />
                      )}
                      {isDirty && (
                        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-warning" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {resource.name} - {permCode.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {value === "ALLOW" ? "허용됨" : value === "DENY" ? "거부됨" : "미설정"}
                    </p>
                    <p className="mt-1 text-xs">클릭하여 변경</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>

        {/* Children */}
        {hasChildren &&
          isExpanded &&
          resource.children!.map((child) => renderResourceRow(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="permission-matrix-search"
              name="permission-matrix-search"
              placeholder="리소스 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex gap-2">
            {(["ALL", "MENU", "UI_COMPONENT"] as const).map((type) => (
              <Button
                key={type}
                variant={typeFilter === type ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter(type)}
              >
                {type === "ALL" ? "전체" : type === "MENU" ? "메뉴" : "컴포넌트"}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {dirtyCount > 0 && (
            <Badge variant="secondary" className="border-warning bg-warning/10 text-warning">
              {dirtyCount}개 변경됨
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={handleResetAll}>
            <RotateCcw className="mr-1 h-4 w-4" />
            전체 초기화
          </Button>
        </div>
      </div>

      {/* Matrix */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-max">
          {/* Header */}
          <div className="sticky top-0 z-20 flex border-b border-border bg-card">
            <div className="sticky left-0 z-30 min-w-[280px] border-r border-border bg-card px-4 py-3">
              <span className="text-sm font-semibold text-foreground">리소스</span>
            </div>
            {permissionCodes.map((permCode) => (
              <DropdownMenu key={permCode.id}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex w-20 flex-col items-center justify-center border-r border-border px-2 py-3 hover:bg-secondary/50"
                  >
                    <span className="text-sm font-semibold text-foreground">
                      {permCode.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {permCode.code}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    onClick={() => handleColumnBulkAction(permCode.id, "ALLOW")}
                  >
                    <Check className="mr-2 h-4 w-4 text-success" />
                    모두 허용
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleColumnBulkAction(permCode.id, "DENY")}
                  >
                    <X className="mr-2 h-4 w-4 text-destructive" />
                    모두 거부
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleColumnBulkAction(permCode.id, null)}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    모두 초기화
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ))}
          </div>

          {/* Body */}
          <div>
            {filteredResources.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="mb-2 font-medium text-foreground">
                  검색 결과가 없습니다
                </p>
                <p className="text-sm text-muted-foreground">
                  다른 검색어나 필터를 시도해보세요
                </p>
              </div>
            ) : (
              filteredResources.map((resource) => renderResourceRow(resource))
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 border-t border-border px-4 py-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-success/20">
            <Check className="h-3 w-3 text-success" />
          </div>
          <span>허용</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive/20">
            <X className="h-3 w-3 text-destructive" />
          </div>
          <span>거부</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-full border-2 border-dashed border-muted" />
          <span>미설정</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-warning" />
          <span>변경됨</span>
        </div>
      </div>
    </div>
  );
}
