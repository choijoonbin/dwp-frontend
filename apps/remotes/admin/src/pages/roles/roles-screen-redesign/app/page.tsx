"use client";

import type { Role } from "@admin/pages/roles/roles-screen-redesign/lib/types";

import { useState, useCallback } from "react";
import { X, Menu, Shield, HelpCircle } from "lucide-react";
import { cn } from "@dwp-frontend/design-system/shadcn/lib/utils";
import { useToast } from "@dwp-frontend/design-system/shadcn/hooks/use-toast";
import { Badge } from "@dwp-frontend/design-system/shadcn/components/ui/badge";
import { Button } from "@dwp-frontend/design-system/shadcn/components/ui/button";
import { mockRoles } from "@admin/pages/roles/roles-screen-redesign/lib/mock-data";
import { Toaster } from "@dwp-frontend/design-system/shadcn/components/ui/toaster";
import { RoleList } from "@admin/pages/roles/roles-screen-redesign/components/roles/role-list";
import { ThemeToggle } from "@admin/pages/roles/roles-screen-redesign/components/theme-toggle";
import { RoleDetail } from "@admin/pages/roles/roles-screen-redesign/components/roles/role-detail";
import { EmptyState } from "@admin/pages/roles/roles-screen-redesign/components/roles/empty-state";
import { CreateRoleDialog } from "@admin/pages/roles/roles-screen-redesign/components/roles/create-role-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@dwp-frontend/design-system/shadcn/components/ui/tooltip";

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>(mockRoles);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isMobileListOpen, setIsMobileListOpen] = useState(false);
  const { toast } = useToast();

  const handleSelectRole = useCallback((role: Role) => {
    setSelectedRole(role);
    setIsMobileListOpen(false);
  }, []);

  const handleCreateRole = useCallback(
    (newRoleData: Omit<Role, "id" | "createdAt" | "updatedAt">) => {
      const newRole: Role = {
        ...newRoleData,
        id: `new-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setRoles((prev) => [newRole, ...prev]);
      setSelectedRole(newRole);

      toast({
        title: "역할이 생성되었습니다",
        description: `${newRole.name} 역할이 성공적으로 생성되었습니다.`,
      });
    },
    [toast]
  );

  const handleSaveRole = useCallback(
    (updatedRole: Role) => {
      setRoles((prev) =>
        prev.map((r) => (r.id === updatedRole.id ? updatedRole : r))
      );
      setSelectedRole(updatedRole);

      toast({
        title: "저장되었습니다",
        description: "변경사항이 성공적으로 저장되었습니다.",
      });
    },
    [toast]
  );

  const handleDeleteRole = useCallback(
    (roleId: string) => {
      setRoles((prev) => prev.filter((r) => r.id !== roleId));
      setSelectedRole(null);

      toast({
        title: "역할이 삭제되었습니다",
        description: "역할이 성공적으로 삭제되었습니다.",
        variant: "destructive",
      });
    },
    [toast]
  );

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setIsMobileListOpen(!isMobileListOpen)}
            aria-label={isMobileListOpen ? "메뉴 닫기" : "메뉴 열기"}
          >
            {isMobileListOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>

          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-accent" />
            <div>
              <h1 className="text-lg font-semibold text-foreground sm:text-xl">
                Roles
              </h1>
              <p className="hidden text-xs text-muted-foreground sm:block">
                권한 그룹 관리
              </p>
            </div>
          </div>

          <Badge variant="secondary" className="hidden sm:inline-flex">
            DWP Admin
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon">
                  <HelpCircle className="h-5 w-5" />
                  <span className="sr-only">도움말</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="font-semibold">권한 편집 가이드</p>
                <ul className="mt-2 list-inside list-disc text-sm">
                  <li>좌측에서 역할을 선택하세요</li>
                  <li>개요 탭에서 기본 정보를 수정하세요</li>
                  <li>멤버 탭에서 사용자/부서를 할당하세요</li>
                  <li>권한 매트릭스에서 세부 권한을 설정하세요</li>
                </ul>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <ThemeToggle />

          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="hidden sm:flex"
          >
            새 역할
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative flex flex-1 overflow-hidden">
        {/* Mobile Overlay */}
        {isMobileListOpen && (
          <div
            className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
            onClick={() => setIsMobileListOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setIsMobileListOpen(false);
            }}
            role="button"
            tabIndex={0}
            aria-label="메뉴 닫기"
          />
        )}

        {/* Left Panel - Role List */}
        <aside
          className={cn(
            "absolute inset-y-0 left-0 z-40 w-80 border-r border-border bg-card transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0",
            isMobileListOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <RoleList
            roles={roles}
            selectedRoleId={selectedRole?.id ?? null}
            onSelectRole={handleSelectRole}
            onCreateRole={() => setIsCreateDialogOpen(true)}
          />
        </aside>

        {/* Right Panel - Role Detail */}
        <section className="flex-1 overflow-hidden bg-background">
          {selectedRole ? (
            <RoleDetail
              role={selectedRole}
              onSave={handleSaveRole}
              onDelete={handleDeleteRole}
            />
          ) : (
            <EmptyState onCreateRole={() => setIsCreateDialogOpen(true)} />
          )}
        </section>
      </main>

      {/* Create Role Dialog */}
      <CreateRoleDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreate={handleCreateRole}
      />

      {/* Toast */}
      <Toaster />
    </div>
  );
}
