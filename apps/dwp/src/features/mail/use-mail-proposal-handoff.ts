import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getMailProposalHandoff, useToast } from '@dwp-frontend/shared-utils';

import { mailProposalOwnerHandoffRoute } from './mail-proposal-handoff';

import type { MailActionProposal } from '@dwp-frontend/shared-utils';

export function useMailProposalHandoff() {
  const { t } = useTranslation('mail');
  const navigate = useNavigate();
  const toast = useToast();
  return useMutation({
    mutationFn: async (proposal: MailActionProposal) => ({
      proposal,
      handoff: await getMailProposalHandoff(proposal.proposalId),
    }),
    onSuccess: ({ proposal, handoff }) => {
      const route = mailProposalOwnerHandoffRoute(proposal, handoff);
      if (!route) {
        toast.error(t('proposal.handoff.invalid'));
        return;
      }
      navigate(route);
    },
    onError: () => toast.error(t('proposal.handoff.openError')),
  });
}
