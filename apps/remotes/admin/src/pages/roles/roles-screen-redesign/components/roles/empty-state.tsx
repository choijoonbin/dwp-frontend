"use client";

import { Plus, Shield } from "lucide-react";
import { Button } from "@dwp-frontend/design-system/shadcn/components/ui/button";

interface EmptyStateProps {
  onCreateRole: () => void;
}

export function EmptyState({ onCreateRole }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="mb-6 rounded-full bg-secondary p-6">
        <Shield className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-xl font-semibold text-foreground">
        역할을 선택해주세요
      </h3>
      <p className="mb-6 max-w-sm text-muted-foreground">
        좌측 패널에서 역할을 선택하여 상세 정보를 확인하고 수정할 수 있습니다.
        새 역할을 생성하려면 아래 버튼을 클릭하세요.
      </p>
      <Button onClick={onCreateRole}>
        <Plus className="mr-2 h-4 w-4" />
        새 역할 생성
      </Button>
    </div>
  );
}
