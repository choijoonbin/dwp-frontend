"use client";

import type { Member } from "@admin/pages/roles/roles-screen-redesign/lib/types";

import { useMemo, useState } from "react";
import { cn } from "@dwp-frontend/design-system/shadcn/lib/utils";
import { X, User, Plus, Search, UserPlus, Building2 } from "lucide-react";
import { Input } from "@dwp-frontend/design-system/shadcn/components/ui/input";
import { Badge } from "@dwp-frontend/design-system/shadcn/components/ui/badge";
import { Button } from "@dwp-frontend/design-system/shadcn/components/ui/button";
import { searchableMembers } from "@admin/pages/roles/roles-screen-redesign/lib/mock-data";
import { Tabs, TabsList, TabsTrigger } from "@dwp-frontend/design-system/shadcn/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@dwp-frontend/design-system/shadcn/components/ui/popover";
import {
  Command,
  CommandItem,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandInput,
} from "@dwp-frontend/design-system/shadcn/components/ui/command";

interface RoleMembersProps {
  members: Member[];
  onAdd: (member: Member) => void;
  onRemove: (memberId: string) => void;
}

export function RoleMembers({ members, onAdd, onRemove }: RoleMembersProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [addPopoverOpen, setAddPopoverOpen] = useState(false);
  const [memberTypeFilter, setMemberTypeFilter] = useState<"ALL" | "USER" | "DEPARTMENT">("ALL");

  const filteredMembers = useMemo(() => members.filter((member) => {
      const matchesSearch =
        searchQuery === "" ||
        member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (member.email && member.email.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesType = memberTypeFilter === "ALL" || member.type === memberTypeFilter;

      return matchesSearch && matchesType;
    }), [members, searchQuery, memberTypeFilter]);

  const availableMembers = useMemo(() => searchableMembers.filter(
      (sm) => !members.find((m) => m.id === sm.id)
    ), [members]);

  const userCount = members.filter((m) => m.type === "USER").length;
  const deptCount = members.filter((m) => m.type === "DEPARTMENT").length;

  return (
    <div className="flex h-full flex-col p-4">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-foreground">멤버 관리</h3>
          <p className="text-sm text-muted-foreground">
            총 {userCount}명의 사용자와 {deptCount}개의 부서가 할당되어 있습니다
          </p>
        </div>

        <Popover open={addPopoverOpen} onOpenChange={setAddPopoverOpen}>
          <PopoverTrigger asChild>
            <Button>
              <Plus className="mr-1 h-4 w-4" />
              멤버 추가
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <Command>
              <CommandInput placeholder="사용자 또는 부서 검색..." />
              <CommandList>
                <CommandEmpty>검색 결과가 없습니다</CommandEmpty>
                <CommandGroup heading="사용자">
                  {availableMembers
                    .filter((m) => m.type === "USER")
                    .slice(0, 5)
                    .map((member) => (
                      <CommandItem
                        key={member.id}
                        onSelect={() => {
                          onAdd(member);
                          setAddPopoverOpen(false);
                        }}
                        className="cursor-pointer"
                      >
                        <User className="mr-2 h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="font-medium">{member.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {member.email}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {member.department}
                        </Badge>
                      </CommandItem>
                    ))}
                </CommandGroup>
                <CommandGroup heading="부서">
                  {availableMembers
                    .filter((m) => m.type === "DEPARTMENT")
                    .slice(0, 5)
                    .map((member) => (
                      <CommandItem
                        key={member.id}
                        onSelect={() => {
                          onAdd(member);
                          setAddPopoverOpen(false);
                        }}
                        className="cursor-pointer"
                      >
                        <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="font-medium">{member.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {member.code}
                          </p>
                        </div>
                      </CommandItem>
                    ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="이름, 코드, 이메일로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs
          value={memberTypeFilter}
          onValueChange={(v) => setMemberTypeFilter(v as typeof memberTypeFilter)}
          className="w-fit"
        >
          <TabsList>
            <TabsTrigger value="ALL">전체</TabsTrigger>
            <TabsTrigger value="USER">사용자</TabsTrigger>
            <TabsTrigger value="DEPARTMENT">부서</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Member List */}
      <div className="flex-1 overflow-y-auto">
        {filteredMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 rounded-full bg-secondary p-4">
              <UserPlus className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="mb-2 font-medium text-foreground">
              {members.length === 0 ? "할당된 멤버가 없습니다" : "검색 결과가 없습니다"}
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              {members.length === 0
                ? "상단의 '멤버 추가' 버튼을 클릭하여 사용자 또는 부서를 추가하세요"
                : "다른 검색어를 입력해보세요"}
            </p>
            {members.length === 0 && (
              <Button
                variant="outline"
                onClick={() => setAddPopoverOpen(true)}
              >
                <Plus className="mr-1 h-4 w-4" />
                멤버 추가
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-3 transition-colors hover:bg-secondary/50"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full",
                      member.type === "USER" ? "bg-accent/20" : "bg-warning/20"
                    )}
                  >
                    {member.type === "USER" ? (
                      <User className="h-5 w-5 text-accent" />
                    ) : (
                      <Building2 className="h-5 w-5 text-warning" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{member.name}</p>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs",
                          member.type === "USER"
                            ? "bg-accent/10 text-accent"
                            : "bg-warning/10 text-warning"
                        )}
                      >
                        {member.type === "USER" ? "사용자" : "부서"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {member.type === "USER" ? member.email : member.code}
                      {member.department && ` · ${member.department}`}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(member.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">멤버 제거</span>
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {members.length > 0 && (
        <div className="mt-4 flex gap-4 border-t border-border pt-4 text-sm text-muted-foreground">
          <span>표시: {filteredMembers.length}건</span>
          <span>전체: {members.length}건</span>
        </div>
      )}
    </div>
  );
}
