import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FilePlus2 } from 'lucide-react';
import { ActionIconButton } from '@dwp-frontend/design-system';
import {
  createDwaionArtifact,
  usePermissions,
  useToast,
  type AskDwpResponse,
} from '@dwp-frontend/shared-utils';
import { useDwaionGovernedMutation } from '../../components/use-dwaion-governed-mutation';

export function DwaionArtifactAnswerAction({
  question,
  response,
}: {
  question: string;
  response: AskDwpResponse;
}) {
  const { t } = useTranslation('work');
  const navigate = useNavigate();
  const toast = useToast();
  const governCreate = useDwaionGovernedMutation('route.dwaion.work.artifact-create.action');
  const { isLoaded, hasPermission } = usePermissions();
  const [saving, setSaving] = useState(false);
  const canCreate =
    isLoaded &&
    hasPermission('APP.DWAION_ARTIFACTS', 'VIEW') &&
    hasPermission('APP.DWAION_ARTIFACTS', 'CREATE') &&
    Boolean(response.answer);
  const conversationId = response.conversationId;
  const assistantMessageId = response.assistantMessageId;

  if (
    !canCreate ||
    response.state !== 'COMPLETED' ||
    response.citations.length === 0 ||
    !conversationId ||
    !assistantMessageId
  ) {
    return null;
  }

  const save = async () => {
    if (saving || !response.answer) return;
    setSaving(true);
    try {
      const artifact = await governCreate((authority) =>
        createDwaionArtifact(
          {
            artifactType: 'DOCUMENT',
            content: {
              title: deriveArtifactTitle(question, t('askPage.actions.artifactFallbackTitle')),
              body: response.answer!,
              format: 'MARKDOWN',
            },
            sourceConversation: { conversationId, assistantMessageId },
          },
          authority
        )
      );
      toast.success(t('askPage.actions.artifactCreated'));
      navigate({
        pathname: '/dwaion/artifacts',
        search: new URLSearchParams({ artifact: artifact.artifactId }).toString(),
      });
    } catch {
      toast.error(t('askPage.actions.artifactCreateFailed'));
      setSaving(false);
    }
  };

  return (
    <ActionIconButton
      label={t('askPage.actions.saveAsArtifact')}
      tooltip={t('askPage.actions.saveAsArtifact')}
      size="small"
      loading={saving}
      onClick={() => void save()}
      sx={{ width: 44, height: 44 }}
    >
      <FilePlus2 size={16} aria-hidden="true" />
    </ActionIconButton>
  );
}

export function deriveArtifactTitle(question: string, fallback: string): string {
  const normalized = question.trim().replace(/\s+/g, ' ') || fallback.trim();
  return Array.from(normalized).slice(0, 200).join('');
}
