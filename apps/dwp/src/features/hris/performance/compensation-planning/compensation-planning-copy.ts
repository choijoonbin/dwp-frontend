export const compensationPlanningCopy = Object.freeze({
  en: Object.freeze({
    title: 'Compensation planning studio',
    subtitle: 'Budgets, eligible proposals, independent approval, and immutable payroll evidence.',
    cycles: 'Cycles',
    proposals: 'Proposals',
    actions: 'Next actions',
    refresh: 'Refresh',
    newCycle: 'New cycle',
    revise: 'Revise setup',
    budget: 'Allocate / reverse budget',
    proposal: 'Create / revise proposal',
    submit: 'Submit proposal',
    approve: 'Approve plan',
    publish: 'Publish snapshot',
    cancelCycle: 'Cancel cycle',
    close: 'Close',
    confirm: 'Confirm',
    retry: 'Retry panel',
    search: 'Filter cycles or proposals',
    restricted: 'Restricted',
    notProjected: 'Not projected',
    immutable: 'I confirm this creates immutable governed evidence.',
  }),
  ko: Object.freeze({
    title: '보상 계획 스튜디오',
    subtitle: '예산, 대상 제안, 독립 승인 및 변경 불가능한 급여 증빙을 한곳에서 관리합니다.',
    cycles: '보상 주기',
    proposals: '제안',
    actions: '다음 작업',
    refresh: '새로고침',
    newCycle: '새 주기',
    revise: '설정 개정',
    budget: '예산 배정 / 취소',
    proposal: '제안 생성 / 개정',
    submit: '제안 제출',
    approve: '계획 승인',
    publish: '스냅샷 게시',
    cancelCycle: '주기 취소',
    close: '닫기',
    confirm: '확인',
    retry: '패널 다시 시도',
    search: '주기 또는 제안 필터',
    restricted: '권한 제한',
    notProjected: '서버 미제공',
    immutable: '변경 불가능한 거버넌스 증빙이 생성됨을 확인합니다.',
  }),
});

export type CompensationPlanningCopy = {
  readonly [K in keyof (typeof compensationPlanningCopy)['en']]: string;
};

export function getCompensationPlanningCopy(locale = 'en'): CompensationPlanningCopy {
  return locale.toLowerCase().startsWith('ko')
    ? compensationPlanningCopy.ko
    : compensationPlanningCopy.en;
}
