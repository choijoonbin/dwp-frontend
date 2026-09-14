import { useCallback } from 'react';
import { createQuestionLaunch } from '@dwp-frontend/shared-utils/api/agent-question-launch-api';
import { createDwaionQuestionLaunchState } from '@dwp-frontend/shared-utils/dwaion-contract';

import { useDwaionGovernedMutation } from '../../components/use-dwaion-governed-mutation';
import { GlobalSearchDialog, type GlobalSearchDialogProps } from './global-search-dialog';

export function DwaionGlobalSearchDialog(props: GlobalSearchDialogProps) {
  const governQuestionLaunch = useDwaionGovernedMutation(
    'route.dwaion.work.question-launch-create.action'
  );
  const launchAsk = useCallback(
    async (query: string) => {
      const receipt = await governQuestionLaunch((authority) =>
        createQuestionLaunch(query, authority)
      );
      const state = createDwaionQuestionLaunchState(receipt.launchId);
      if (!state) throw new Error('Question launch receipt is invalid.');
      return state;
    },
    [governQuestionLaunch]
  );

  return <GlobalSearchDialog {...props} launchAsk={launchAsk} />;
}
