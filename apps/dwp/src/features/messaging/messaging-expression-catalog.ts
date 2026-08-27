export type MessagingExpressionCategory = 'people' | 'work' | 'objects' | 'symbols' | 'stamps';

export type MessagingExpression = {
  value: string;
  label: string;
  category: MessagingExpressionCategory;
  keywords: string;
  stamp?: boolean;
};

export const MESSAGING_EXPRESSIONS: readonly MessagingExpression[] = [
  { value: '😀', label: '웃는 얼굴', category: 'people', keywords: 'smile happy 웃음 기쁨' },
  { value: '😊', label: '미소', category: 'people', keywords: 'smile warm 미소 감사' },
  { value: '😂', label: '기쁨의 눈물', category: 'people', keywords: 'laugh joy 웃음 재미' },
  { value: '🙂', label: '가벼운 미소', category: 'people', keywords: 'smile okay 미소' },
  { value: '😉', label: '윙크', category: 'people', keywords: 'wink 윙크' },
  { value: '😍', label: '좋아해요', category: 'people', keywords: 'love 좋아요' },
  { value: '🤔', label: '생각 중', category: 'people', keywords: 'think thinking 고민 생각' },
  { value: '😅', label: '안도', category: 'people', keywords: 'relief sweat 안도' },
  { value: '😮', label: '놀람', category: 'people', keywords: 'wow surprise 놀람' },
  { value: '😢', label: '슬픔', category: 'people', keywords: 'sad cry 슬픔' },
  { value: '🙏', label: '감사', category: 'people', keywords: 'thanks please 감사 부탁' },
  { value: '👏', label: '박수', category: 'people', keywords: 'clap congrats 축하 박수' },
  { value: '🙌', label: '함께 축하', category: 'people', keywords: 'celebrate thanks 축하' },
  { value: '👍', label: '좋아요', category: 'people', keywords: 'like approve 동의 좋아요' },
  { value: '👎', label: '동의하지 않음', category: 'people', keywords: 'dislike disagree 반대' },
  { value: '👌', label: '좋습니다', category: 'people', keywords: 'okay good 확인' },
  { value: '🤝', label: '협력', category: 'work', keywords: 'handshake agree 협력 합의' },
  { value: '💪', label: '힘내요', category: 'work', keywords: 'strong 힘내요 응원' },
  { value: '✅', label: '완료', category: 'work', keywords: 'done check 완료 확인' },
  { value: '👀', label: '확인 중', category: 'work', keywords: 'looking review 확인 검토' },
  { value: '🚀', label: '시작', category: 'work', keywords: 'launch start 시작 배포' },
  { value: '🎯', label: '목표', category: 'work', keywords: 'target goal 목표' },
  { value: '💡', label: '아이디어', category: 'work', keywords: 'idea insight 아이디어' },
  { value: '📌', label: '중요', category: 'work', keywords: 'pin important 중요 고정' },
  { value: '📣', label: '공지', category: 'work', keywords: 'announce 공지' },
  { value: '⏰', label: '시간', category: 'work', keywords: 'time reminder 시간 알림' },
  { value: '📅', label: '일정', category: 'work', keywords: 'calendar schedule 일정' },
  { value: '🧭', label: '방향', category: 'work', keywords: 'direction plan 방향 계획' },
  { value: '🛠️', label: '작업 중', category: 'work', keywords: 'tools work 작업' },
  { value: '🧪', label: '실험', category: 'work', keywords: 'test experiment 테스트' },
  { value: '📎', label: '첨부', category: 'objects', keywords: 'attach clip 첨부' },
  { value: '📄', label: '문서', category: 'objects', keywords: 'document file 문서' },
  { value: '📊', label: '분석', category: 'objects', keywords: 'chart report 분석 보고' },
  { value: '🔒', label: '보안', category: 'objects', keywords: 'security lock 보안' },
  { value: '🔔', label: '알림', category: 'objects', keywords: 'notification bell 알림' },
  { value: '🎥', label: '화상 회의', category: 'objects', keywords: 'video meeting 회의' },
  { value: '💬', label: '대화', category: 'objects', keywords: 'chat message 대화' },
  { value: '❤️', label: '마음', category: 'symbols', keywords: 'heart love 마음' },
  { value: '✨', label: '빛남', category: 'symbols', keywords: 'sparkle great 멋짐' },
  { value: '⭐', label: '별', category: 'symbols', keywords: 'star favorite 별' },
  { value: '🔥', label: '중요하고 뜨거움', category: 'symbols', keywords: 'fire hot 중요' },
  { value: '⚠️', label: '주의', category: 'symbols', keywords: 'warning caution 주의' },
  { value: '❗', label: '중요', category: 'symbols', keywords: 'important 중요' },
  { value: '❓', label: '질문', category: 'symbols', keywords: 'question 질문' },
  { value: '➕', label: '추가', category: 'symbols', keywords: 'plus add 추가' },
  { value: '➡️', label: '다음', category: 'symbols', keywords: 'next arrow 다음' },
  {
    value: '✅ 확인했습니다',
    label: '확인했습니다',
    category: 'stamps',
    keywords: 'confirmed 확인 완료',
    stamp: true,
  },
  {
    value: '👀 검토 후 답변드리겠습니다',
    label: '검토 후 답변',
    category: 'stamps',
    keywords: 'review 검토 답변',
    stamp: true,
  },
  {
    value: '🙏 감사합니다',
    label: '감사합니다',
    category: 'stamps',
    keywords: 'thanks 감사',
    stamp: true,
  },
  {
    value: '🎉 좋은 결과입니다',
    label: '좋은 결과입니다',
    category: 'stamps',
    keywords: 'congratulations 축하 결과',
    stamp: true,
  },
] as const;

const ENGLISH_EXPRESSION_LABELS: Readonly<Record<string, string>> = {
  '😀': 'Grinning face',
  '😊': 'Warm smile',
  '😂': 'Tears of joy',
  '🙂': 'Slight smile',
  '😉': 'Wink',
  '😍': 'Love it',
  '🤔': 'Thinking',
  '😅': 'Relieved',
  '😮': 'Surprised',
  '😢': 'Sad',
  '🙏': 'Thanks',
  '👏': 'Applause',
  '🙌': 'Celebrate together',
  '👍': 'Like',
  '👎': 'Disagree',
  '👌': 'Looks good',
  '🤝': 'Collaboration',
  '💪': 'You have this',
  '✅': 'Done',
  '👀': 'Reviewing',
  '🚀': 'Launch',
  '🎯': 'Goal',
  '💡': 'Idea',
  '📌': 'Important',
  '📣': 'Announcement',
  '⏰': 'Time',
  '📅': 'Schedule',
  '🧭': 'Direction',
  '🛠️': 'Work in progress',
  '🧪': 'Experiment',
  '📎': 'Attachment',
  '📄': 'Document',
  '📊': 'Analysis',
  '🔒': 'Security',
  '🔔': 'Notification',
  '🎥': 'Video meeting',
  '💬': 'Conversation',
  '❤️': 'Appreciation',
  '✨': 'Excellent',
  '⭐': 'Favorite',
  '🔥': 'High priority',
  '⚠️': 'Warning',
  '❗': 'Important',
  '❓': 'Question',
  '➕': 'Add',
  '➡️': 'Next',
  '✅ 확인했습니다': 'Confirmed',
  '👀 검토 후 답변드리겠습니다': 'Reviewing now',
  '🙏 감사합니다': 'Thank you',
  '🎉 좋은 결과입니다': 'Great result',
};

const ENGLISH_STAMP_VALUES: Readonly<Record<string, string>> = {
  '✅ 확인했습니다': '✅ Confirmed',
  '👀 검토 후 답변드리겠습니다': '👀 I will review and follow up',
  '🙏 감사합니다': '🙏 Thank you',
  '🎉 좋은 결과입니다': '🎉 Great result',
};

export function messagingExpressionLabel(expression: MessagingExpression, language: string) {
  return language.startsWith('ko')
    ? expression.label
    : (ENGLISH_EXPRESSION_LABELS[expression.value] ?? expression.label);
}

export function messagingExpressionValue(expression: MessagingExpression, language: string) {
  return language.startsWith('ko')
    ? expression.value
    : (ENGLISH_STAMP_VALUES[expression.value] ?? expression.value);
}
