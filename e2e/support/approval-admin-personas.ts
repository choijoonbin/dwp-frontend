export const ADMIN_PERSONAS = [
  {
    name: '설계자',
    role: 'APPROVAL_DESIGNER',
    permissions: [
      ['ADMIN.APPROVAL_DESIGN', 'VIEW'],
      ['ADMIN.APPROVAL_DESIGN', 'CREATE'],
      ['ADMIN.APPROVAL_DESIGN', 'UPDATE'],
    ],
    visible: ['프로세스 설계', '양식 카탈로그'],
    hidden: ['운영 개요', '결재 정책', 'SLA 및 전달 운영', '전자서명 연계'],
    allowedPath: '/approvals/admin/workflows',
    forbiddenPath: '/approvals/admin/operations',
  },
  {
    name: '게시 책임자',
    role: 'APPROVAL_PUBLISHER',
    permissions: [
      ['ADMIN.APPROVAL_DESIGN', 'VIEW'],
      ['ADMIN.APPROVAL_DESIGN', 'APPROVE'],
      ['ADMIN.APPROVAL_POLICY', 'VIEW'],
      ['ADMIN.APPROVAL_POLICY', 'APPROVE'],
    ],
    visible: ['프로세스 설계', '양식 카탈로그', '결재 정책'],
    hidden: ['운영 개요', 'SLA 및 전달 운영', '전자서명 연계'],
    allowedPath: '/approvals/admin/workflows',
    forbiddenPath: '/approvals/admin/operations',
  },
  {
    name: '운영자',
    role: 'APPROVAL_OPERATOR',
    permissions: [
      ['ADMIN.APPROVAL_OPERATIONS', 'VIEW'],
      ['ADMIN.APPROVAL_OPERATIONS', 'UPDATE'],
    ],
    visible: ['운영 개요', 'SLA 및 전달 운영'],
    hidden: ['프로세스 설계', '양식 카탈로그', '결재 정책', '전자서명 연계'],
    allowedPath: '/approvals/admin/overview',
    forbiddenPath: '/approvals/admin/workflows',
  },
] as const;
