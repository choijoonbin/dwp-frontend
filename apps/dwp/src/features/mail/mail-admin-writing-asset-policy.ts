export type MailWritingAssetAdminAction = 'edit' | 'submit' | 'approve' | 'publish' | 'retire';

export const MAIL_WRITING_ASSET_PERMISSION_BY_ACTION: Record<MailWritingAssetAdminAction, string> =
  {
    edit: 'WRITING_ASSET_EDIT',
    submit: 'WRITING_ASSET_SUBMIT',
    approve: 'WRITING_ASSET_APPROVE',
    publish: 'WRITING_ASSET_PUBLISH',
    retire: 'WRITING_ASSET_RETIRE',
  };

export function canUseMailWritingAssetAdminAction(input: {
  action: MailWritingAssetAdminAction;
  elevated: boolean;
  hasPermission: (resourceKey: string, permissionCode: string) => boolean;
  isCreator?: boolean;
}) {
  return (
    input.elevated &&
    !(input.action === 'approve' && input.isCreator) &&
    input.hasPermission('ADMIN.MAIL', MAIL_WRITING_ASSET_PERMISSION_BY_ACTION[input.action])
  );
}
