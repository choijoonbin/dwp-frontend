import { MyAuditExpensesPage } from './expenses';

/**
 * 중복 제거: 소명 요청 내역은 나의 전표현황의 '소명 대기함' 탭으로 통합
 */
export const MyAuditClarificationPage = () => <MyAuditExpensesPage initialTab="inbox" />;
