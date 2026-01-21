"use client";

import type { Role, Member, SaveState, Permission } from "@admin/pages/roles/roles-screen-redesign/lib/types";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@dwp-frontend/design-system/shadcn/lib/utils";
import { Badge } from "@dwp-frontend/design-system/shadcn/components/ui/badge";
import { Save, Clock, Trash2, AlertCircle, MoreHorizontal } from "lucide-react";
import { Button } from "@dwp-frontend/design-system/shadcn/components/ui/button";
import { Tabs, TabsList, TabsContent, TabsTrigger } from "@dwp-frontend/design-system/shadcn/components/ui/tabs";
import {
  mockMembers,
  mockResources,
  mockPermissionCodes,
  generateInitialPermissions,
} from "@admin/pages/roles/roles-screen-redesign/lib/mock-data";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@dwp-frontend/design-system/shadcn/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogTitle,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogDescription,
} from "@dwp-frontend/design-system/shadcn/components/ui/alert-dialog";

import { RoleMembers } from "./role-members";
import { RoleOverview } from "./role-overview";
import { PermissionMatrix } from "./permission-matrix";

interface RoleDetailProps {
  role: Role;
  onSave: (role: Role) => void;
  onDelete: (roleId: string) => void;
}

export function RoleDetail({ role, onSave, onDelete }: RoleDetailProps) {
  const [editedRole, setEditedRole] = useState<Role>(role);
  const [members, setMembers] = useState<Member[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [saveState, setSaveState] = useState<SaveState>({
    isSaving: false,
    hasUnsavedChanges: false,
  });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);

  // Initialize data when role changes
  useEffect(() => {
    setEditedRole(role);
    setMembers(mockMembers.slice(0, role.memberCount > 3 ? 3 : role.memberCount));
    setPermissions(generateInitialPermissions(role.id));
    setSaveState({ isSaving: false, hasUnsavedChanges: false });
    setActiveTab("overview");
  }, [role]); // Updated dependency array to use role instead of role.id and role.memberCount

  const checkUnsavedChanges = useCallback(() => {
    const hasRoleChanges =
      editedRole.name !== role.name ||
      editedRole.status !== role.status ||
      editedRole.description !== role.description;

    const hasPermissionChanges = permissions.some((p) => p.isDirty);

    return hasRoleChanges || hasPermissionChanges;
  }, [editedRole, permissions, role]);

  useEffect(() => {
    const hasChanges = checkUnsavedChanges();
    setSaveState((prev) => ({ ...prev, hasUnsavedChanges: hasChanges }));
  }, [checkUnsavedChanges]);

  const handleTabChange = (newTab: string) => {
    if (saveState.hasUnsavedChanges) {
      setPendingTab(newTab);
      setShowUnsavedDialog(true);
    } else {
      setActiveTab(newTab);
    }
  };

  const handleRoleChange = (updates: Partial<Role>) => {
    setEditedRole((prev) => ({ ...prev, ...updates }));
  };

  const handleMemberAdd = (member: Member) => {
    if (!members.find((m) => m.id === member.id)) {
      setMembers((prev) => [...prev, member]);
      setSaveState((prev) => ({ ...prev, hasUnsavedChanges: true }));
    }
  };

  const handleMemberRemove = (memberId: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    setSaveState((prev) => ({ ...prev, hasUnsavedChanges: true }));
  };

  const handlePermissionChange = (
    resourceId: string,
    permissionCodeId: string,
    value: Permission["value"]
  ) => {
    setPermissions((prev) =>
      prev.map((p) =>
        p.resourceId === resourceId && p.permissionCodeId === permissionCodeId
          ? { ...p, value, isDirty: true }
          : p
      )
    );
  };

  const handleBulkPermissionChange = (
    resourceIds: string[],
    permissionCodeId: string | null,
    value: Permission["value"]
  ) => {
    setPermissions((prev) =>
      prev.map((p) => {
        if (resourceIds.includes(p.resourceId)) {
          if (permissionCodeId === null || p.permissionCodeId === permissionCodeId) {
            return { ...p, value, isDirty: true };
          }
        }
        return p;
      })
    );
  };

  const handleSave = async () => {
    setSaveState((prev) => ({ ...prev, isSaving: true }));

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Clear dirty flags
    setPermissions((prev) => prev.map((p) => ({ ...p, isDirty: false })));

    setSaveState({
      isSaving: false,
      lastSaved: new Date(),
      hasUnsavedChanges: false,
    });

    onSave({
      ...editedRole,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleDelete = () => {
    if (members.length > 0 || permissions.some((p) => p.value === "ALLOW")) {
      // Show 409 error
      alert("멤버 또는 권한 매핑이 존재합니다. 먼저 해제 후 삭제해주세요.");
      return;
    }
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    onDelete(role.id);
    setShowDeleteDialog(false);
  };

  const formatLastSaved = () => {
    if (!saveState.lastSaved) return null;
    return saveState.lastSaved.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const userCount = members.filter((m) => m.type === "USER").length;
  const deptCount = members.filter((m) => m.type === "DEPARTMENT").length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-foreground">
                {editedRole.name}
              </h2>
              <Badge
                variant={editedRole.status === "ACTIVE" ? "default" : "secondary"}
                className={cn(
                  editedRole.status === "ACTIVE"
                    ? "bg-success/20 text-success"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {editedRole.status === "ACTIVE" ? "활성" : "비활성"}
              </Badge>
            </div>
            <p className="font-mono text-sm text-muted-foreground">
              {editedRole.code}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {saveState.lastSaved && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatLastSaved()} 저장됨
            </span>
          )}

          {saveState.hasUnsavedChanges && (
            <Badge variant="outline" className="border-warning text-warning">
              <AlertCircle className="mr-1 h-3 w-3" />
              변경사항 있음
            </Badge>
          )}

          <Button
            onClick={handleSave}
            disabled={!saveState.hasUnsavedChanges || saveState.isSaving}
          >
            <Save className="mr-1 h-4 w-4" />
            {saveState.isSaving ? "저장 중..." : "저장"}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>변경 이력 보기</DropdownMenuItem>
              <DropdownMenuItem>역할 복제</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                역할 삭제
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 overflow-hidden">
        <div className="border-b border-border px-4">
          <TabsList className="h-12 bg-transparent">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:bg-transparent"
            >
              개요
            </TabsTrigger>
            <TabsTrigger
              value="members"
              className="data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:bg-transparent"
            >
              멤버
              <Badge variant="secondary" className="ml-2">
                {userCount}명 / {deptCount}팀
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="permissions"
              className="data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:bg-transparent"
            >
              권한 매트릭스
              {permissions.some((p) => p.isDirty) && (
                <span className="ml-2 h-2 w-2 rounded-full bg-warning" />
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="overview" className="mt-0 h-full p-4">
            <RoleOverview role={editedRole} onChange={handleRoleChange} />
          </TabsContent>

          <TabsContent value="members" className="mt-0 h-full overflow-hidden">
            <RoleMembers
              members={members}
              onAdd={handleMemberAdd}
              onRemove={handleMemberRemove}
            />
          </TabsContent>

          <TabsContent value="permissions" className="mt-0 h-full overflow-hidden">
            <PermissionMatrix
              resources={mockResources}
              permissionCodes={mockPermissionCodes}
              permissions={permissions}
              onChange={handlePermissionChange}
              onBulkChange={handleBulkPermissionChange}
            />
          </TabsContent>
        </div>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>역할을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              {`"${role.name}" 역할을 삭제합니다. 이 작업은 되돌릴 수 없습니다.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved Changes Dialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>저장되지 않은 변경사항</AlertDialogTitle>
            <AlertDialogDescription>
              저장되지 않은 변경사항이 있습니다. 탭을 이동하면 변경사항이 유실됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingTab(null)}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingTab) {
                  setActiveTab(pendingTab);
                  setPendingTab(null);
                  setSaveState((prev) => ({ ...prev, hasUnsavedChanges: false }));
                }
                setShowUnsavedDialog(false);
              }}
            >
              이동
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
