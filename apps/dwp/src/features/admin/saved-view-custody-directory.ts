import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  listSavedViewCustodyUsers,
  type SavedViewCustodyUser,
  type SavedViewOwnershipDisposition,
} from '@dwp-frontend/shared-utils';

import { sortCustodySourceUsers } from './saved-view-custody-model';

type DirectoryOptions = {
  actorUserId?: number | null;
  disposition: SavedViewOwnershipDisposition;
  sourceOwner: SavedViewCustodyUser | null;
  sourceSearch: string;
  targetOwner: SavedViewCustodyUser | null;
  targetSearch: string;
};

export function useSavedViewCustodyDirectory({
  actorUserId,
  disposition,
  sourceOwner,
  sourceSearch,
  targetOwner,
  targetSearch,
}: DirectoryOptions) {
  const [debouncedSourceSearch, setDebouncedSourceSearch] = useState('');
  const [debouncedTargetSearch, setDebouncedTargetSearch] = useState('');

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSourceSearch(sourceSearch.trim()), 220);
    return () => window.clearTimeout(timeout);
  }, [sourceSearch]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedTargetSearch(targetSearch.trim()), 220);
    return () => window.clearTimeout(timeout);
  }, [targetSearch]);

  const sourceUsers = useQuery({
    queryKey: ['admin', 'identity-users', 'saved-view-custody', 'source', debouncedSourceSearch],
    queryFn: () => listSavedViewCustodyUsers(debouncedSourceSearch, false, 30),
    staleTime: 20_000,
    retry: 1,
  });
  const targetUsers = useQuery({
    queryKey: [
      'admin',
      'identity-users',
      'saved-view-custody',
      'target',
      sourceOwner?.userId,
      debouncedTargetSearch,
    ],
    queryFn: () => listSavedViewCustodyUsers(debouncedTargetSearch, true, 30, sourceOwner?.userId),
    enabled: disposition === 'TRANSFER' && Boolean(sourceOwner),
    staleTime: 20_000,
    retry: 1,
  });

  const sourceOptions = useMemo(
    () => sortCustodySourceUsers(sourceUsers.data ?? []),
    [sourceUsers.data]
  );
  const targetOptions = useMemo(
    () =>
      (targetUsers.data ?? [])
        .filter(
          (user) =>
            user.status === 'ACTIVE' &&
            user.identityPlane !== 'PROVIDER' &&
            ![actorUserId, sourceOwner?.userId].some(
              (userId) => userId != null && user.userId === userId
            )
        )
        .sort((left, right) => left.displayName.localeCompare(right.displayName)),
    [actorUserId, sourceOwner?.userId, targetUsers.data]
  );
  const knownUsers = useMemo(() => {
    const values = [
      ...(sourceUsers.data ?? []),
      ...(targetUsers.data ?? []),
      ...(sourceOwner ? [sourceOwner] : []),
      ...(targetOwner ? [targetOwner] : []),
    ];
    return new Map(values.map((user) => [user.userId, user]));
  }, [sourceOwner, sourceUsers.data, targetOwner, targetUsers.data]);

  return { knownUsers, sourceOptions, sourceUsers, targetOptions, targetUsers };
}
