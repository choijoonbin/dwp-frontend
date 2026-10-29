import type { QueryClient } from '@tanstack/react-query';

export async function invalidateApprovalCommandWork(queryClient: QueryClient, taskId?: string) {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: ['approvals', 'command-tasks'] }),
    queryClient.invalidateQueries({ queryKey: ['approvals', 'command-queue-counts'] }),
    queryClient.invalidateQueries({ queryKey: ['approvals', 'tasks'] }),
    queryClient.invalidateQueries({ queryKey: ['approvals', 'home'] }),
  ];
  if (taskId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: ['approvals', 'command-task', taskId] }),
      queryClient.invalidateQueries({ queryKey: ['approvals', 'task', taskId] })
    );
  }
  await Promise.all(invalidations);
}
