"use client";

import type { Role } from "@admin/pages/roles/roles-screen-redesign/lib/types";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@dwp-frontend/design-system/shadcn/components/ui/input";
import { Label } from "@dwp-frontend/design-system/shadcn/components/ui/label";
import { Button } from "@dwp-frontend/design-system/shadcn/components/ui/button";
import { Switch } from "@dwp-frontend/design-system/shadcn/components/ui/switch";
import { Textarea } from "@dwp-frontend/design-system/shadcn/components/ui/textarea";
import {
  Dialog,
  DialogTitle,
  DialogFooter,
  DialogHeader,
  DialogContent,
  DialogDescription,
} from "@dwp-frontend/design-system/shadcn/components/ui/dialog";

interface CreateRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (role: Omit<Role, "id" | "createdAt" | "updatedAt">) => void;
}

export function CreateRoleDialog({
  open,
  onOpenChange,
  onCreate,
}: CreateRoleDialogProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<{ name?: string; code?: string }>({});

  const handleCodeChange = (value: string) => {
    // Convert to uppercase and replace invalid characters
    const sanitized = value.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    setCode(sanitized);
  };

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (!name.trim()) {
      newErrors.name = "역할명을 입력해주세요";
    }

    if (!code.trim()) {
      newErrors.code = "역할 코드를 입력해주세요";
    } else if (!/^[A-Z][A-Z0-9_]*$/.test(code)) {
      newErrors.code = "코드는 영문 대문자로 시작하고, 영문 대문자/숫자/밑줄만 사용 가능합니다";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    onCreate({
      name: name.trim(),
      code: code.trim(),
      description: description.trim() || undefined,
      status: isActive ? "ACTIVE" : "INACTIVE",
      memberCount: 0,
      departmentCount: 0,
    });

    // Reset form
    setName("");
    setCode("");
    setDescription("");
    setIsActive(true);
    setErrors({});
    onOpenChange(false);
  };

  const handleClose = () => {
    setName("");
    setCode("");
    setDescription("");
    setIsActive(true);
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>새 역할 생성</DialogTitle>
          <DialogDescription>
            새로운 역할을 생성합니다. 생성 후 멤버와 권한을 할당할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-name">
              역할명 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="new-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 콘텐츠 관리자"
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-code">
              역할 코드 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="new-code"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="예: CONTENT_MANAGER"
              className={`font-mono ${errors.code ? "border-destructive" : ""}`}
            />
            {errors.code ? (
              <p className="text-xs text-destructive">{errors.code}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                영문 대문자, 숫자, 밑줄(_)만 사용 가능합니다
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-description">설명 (선택)</Label>
            <Textarea
              id="new-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="역할에 대한 설명을 입력하세요"
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="new-status">활성 상태</Label>
              <p className="text-sm text-muted-foreground">
                생성 즉시 활성화 여부
              </p>
            </div>
            <Switch
              id="new-status"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            취소
          </Button>
          <Button onClick={handleSubmit}>
            <Plus className="mr-1 h-4 w-4" />
            생성
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
