import type { operations } from '@dwp-frontend/api-contracts';

type JsonRequestBody<TOperation> = TOperation extends {
  requestBody: { content: { 'application/json': infer TBody } };
}
  ? TBody
  : never;

type PathParameters<TOperation> = TOperation extends {
  parameters: { path: infer TPath };
}
  ? TPath
  : never;

type SuccessContent<TOperation> = TOperation extends {
  responses: { 200: { content: infer TContent } };
}
  ? TContent extends Record<string, infer TBody>
    ? TBody
    : never
  : never;

type SuccessData<TOperation> = SuccessContent<TOperation> extends infer TEnvelope
  ? TEnvelope extends { data?: infer TData }
    ? TData
    : never
  : never;

/** Contract-derived Mail types. Domain response models remain stricter after boundary parsing. */
export type MailCreateDraftContractRequest = JsonRequestBody<operations['platform_createDraft']>;
export type MailSaveDraftContractRequest = JsonRequestBody<operations['platform_saveDraft']>;
export type MailUpdateDraftContractRequest = JsonRequestBody<
  operations['platform_updateMailDraft']
>;
export type MailComposeContractRequest = JsonRequestBody<operations['platform_compose']>;
export type MailConnectionUpdateContractRequest = JsonRequestBody<
  operations['platform_updateConnection']
>;
export type MailPolicyUpdateContractRequest = JsonRequestBody<
  operations['platform_updateAdminMailPolicy']
>;
export type MailSaveDraftContractPath = PathParameters<operations['platform_saveDraft']>;
export type MailUpdateDraftContractPath = PathParameters<operations['platform_updateMailDraft']>;
export type MailComposeContractResponse = SuccessData<operations['platform_compose']>;
export type MailEventStreamContractEvent = SuccessContent<
  operations['platform_streamMailEvents']
>;
export type MailEventCatchUpContractResponse = SuccessData<
  operations['platform_catchUpMailEvents']
>;

/**
 * Bulk mutation identity is optional on each generated single-item command. Callers that opt into
 * replay-safe bulk execution receive both fields from one contract-derived option object.
 */
export type MailThreadActionContractRequest = JsonRequestBody<operations['platform_action']>;
export type MailLifecycleContractRequest = JsonRequestBody<operations['platform_lifecycle']>;
export type MailBulkMutationIdentity = Readonly<
  Required<
    Pick<MailThreadActionContractRequest, 'bulkIntentId' | 'itemIdempotencyKey'>
  >
>;
