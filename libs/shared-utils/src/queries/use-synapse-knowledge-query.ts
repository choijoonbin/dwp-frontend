/**
 * Synapse Phase 3 — Knowledge/Policy TanStack Query hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import { showToast } from '../toast/toast-store';
import {
  searchRag,
  getFeedback,
  getDictionary,
  getGuardrails,
  createFeedback,
  createGuardrail,
  deleteGuardrail,
  getRagDocuments,
  updateGuardrail,
  evaluateGuardrail,
  getPolicyProfiles,
  getEffectivePolicy,
  registerRagDocument,
  createDictionaryTerm,
  deleteDictionaryTerm,
  getRagDocumentDetail,
  updateDictionaryTerm,
  type RagSearchParams,
  getPolicyProfileDetail,
  type FeedbackCreateRequest,
  type GuardrailUpsertRequest,
  type RagDocumentsListParams,
  type GuardrailEvaluateRequest,
  type RegisterRagDocumentRequest,
  type DictionaryTermUpsertRequest,
} from '../api/synapse-knowledge-api';

// ----------------------------------------------------------------------
// Query Keys
// ----------------------------------------------------------------------

export const ragDocumentsQueryKey = (tenantId: string, params?: RagDocumentsListParams) =>
  ['synapse', 'rag', 'documents', tenantId, params] as const;

export const ragDocumentDetailQueryKey = (tenantId: string, docId: string) =>
  ['synapse', 'rag', 'document', tenantId, docId] as const;

export const ragSearchQueryKey = (tenantId: string, params: RagSearchParams) =>
  ['synapse', 'rag', 'search', tenantId, params] as const;

export const policyProfilesQueryKey = (tenantId: string) =>
  ['synapse', 'policies', 'profiles', tenantId] as const;

export const policyProfileDetailQueryKey = (tenantId: string, profileId: string) =>
  ['synapse', 'policies', 'profile', tenantId, profileId] as const;

export const effectivePolicyQueryKey = (tenantId: string, profileId?: string, bukrs?: string) =>
  ['synapse', 'policies', 'effective', tenantId, profileId, bukrs] as const;

export const guardrailsQueryKey = (tenantId: string, enabledOnly?: boolean) =>
  ['synapse', 'guardrails', tenantId, enabledOnly] as const;

export const dictionaryQueryKey = (tenantId: string, category?: string) =>
  ['synapse', 'dictionary', tenantId, category] as const;

export const feedbackQueryKey = (tenantId: string, targetType?: string, targetId?: string) =>
  ['synapse', 'feedback', tenantId, targetType, targetId] as const;

// ----------------------------------------------------------------------
// RAG
// ----------------------------------------------------------------------

export const useRagDocumentsQuery = (params?: RagDocumentsListParams) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = isAuthenticated && Boolean(tenantId);

  return useQuery({
    queryKey: ragDocumentsQueryKey(tenantId, params),
    queryFn: async () => {
      const res = await getRagDocuments(params);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') throw new Error(res.message ?? 'Failed to fetch RAG documents');
      return res.data;
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
};

export const useRagDocumentDetailQuery = (docId: string | undefined) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = isAuthenticated && Boolean(tenantId) && Boolean(docId);

  return useQuery({
    queryKey: ragDocumentDetailQueryKey(tenantId, docId ?? ''),
    queryFn: async () => {
      if (!docId) throw new Error('Missing docId');
      const res = await getRagDocumentDetail(docId);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') throw new Error(res.message ?? 'Failed to fetch document');
      return res.data;
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
};

export const useRagSearchQuery = (params: RagSearchParams, enabledSearch: boolean) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = isAuthenticated && Boolean(tenantId) && enabledSearch && Boolean(params.q?.trim());

  return useQuery({
    queryKey: ragSearchQueryKey(tenantId, params),
    queryFn: async () => {
      const res = await searchRag(params);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') throw new Error(res.message ?? 'Search failed');
      return res.data;
    },
    enabled,
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
    retry: false,
  });
};

export const useRegisterRagDocumentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: RegisterRagDocumentRequest) => {
      const res = await registerRagDocument(body);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') throw new Error(res.message ?? 'Failed to register');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['synapse', 'rag'] });
      showToast('Document registered');
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : 'Failed to register', 'error');
    },
  });
};

// ----------------------------------------------------------------------
// Policies
// ----------------------------------------------------------------------

export const usePolicyProfilesQuery = () => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = isAuthenticated && Boolean(tenantId);

  return useQuery({
    queryKey: policyProfilesQueryKey(tenantId),
    queryFn: async () => {
      const res = await getPolicyProfiles();
      if (res.status !== 'SUCCESS' && res.status !== 'OK') throw new Error(res.message ?? 'Failed to fetch profiles');
      return res.data;
    },
    enabled,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });
};

export const usePolicyProfileDetailQuery = (profileId: string | undefined) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = isAuthenticated && Boolean(tenantId) && Boolean(profileId);

  return useQuery({
    queryKey: policyProfileDetailQueryKey(tenantId, profileId ?? ''),
    queryFn: async () => {
      if (!profileId) throw new Error('Missing profileId');
      const res = await getPolicyProfileDetail(profileId);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') throw new Error(res.message ?? 'Failed to fetch profile');
      return res.data;
    },
    enabled,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });
};

export const useEffectivePolicyQuery = (profileId?: string, bukrs?: string) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = isAuthenticated && Boolean(tenantId);

  return useQuery({
    queryKey: effectivePolicyQueryKey(tenantId, profileId, bukrs),
    queryFn: async () => {
      const res = await getEffectivePolicy({ profileId, bukrs });
      if (res.status !== 'SUCCESS' && res.status !== 'OK') throw new Error(res.message ?? 'Failed to fetch effective policy');
      return res.data;
    },
    enabled,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });
};

// ----------------------------------------------------------------------
// Guardrails
// ----------------------------------------------------------------------

export const useGuardrailsQuery = (enabledOnly?: boolean) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = isAuthenticated && Boolean(tenantId);

  return useQuery({
    queryKey: guardrailsQueryKey(tenantId, enabledOnly),
    queryFn: async () => {
      const res = await getGuardrails(enabledOnly);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') throw new Error(res.message ?? 'Failed to fetch guardrails');
      return res.data ?? [];
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
};

export const useCreateGuardrailMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: GuardrailUpsertRequest) => {
      const res = await createGuardrail(body);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') throw new Error(res.message ?? 'Failed to create');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['synapse', 'guardrails'] });
      showToast('Guardrail created');
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : 'Failed to create', 'error');
    },
  });
};

export const useUpdateGuardrailMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ guardrailId, body }: { guardrailId: string; body: GuardrailUpsertRequest }) => {
      const res = await updateGuardrail(guardrailId, body);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') throw new Error(res.message ?? 'Failed to update');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['synapse', 'guardrails'] });
      showToast('Guardrail updated');
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : 'Failed to update', 'error');
    },
  });
};

export const useDeleteGuardrailMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (guardrailId: string) => {
      const res = await deleteGuardrail(guardrailId);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') throw new Error(res.message ?? 'Failed to delete');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['synapse', 'guardrails'] });
      showToast('Guardrail deleted');
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : 'Failed to delete', 'error');
    },
  });
};

export const useEvaluateGuardrailMutation = () => useMutation({
    mutationFn: async (body: GuardrailEvaluateRequest) => {
      const res = await evaluateGuardrail(body);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') throw new Error(res.message ?? 'Evaluate failed');
      return res.data;
    },
  });

// ----------------------------------------------------------------------
// Dictionary
// ----------------------------------------------------------------------

export const useDictionaryQuery = (category?: string) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = isAuthenticated && Boolean(tenantId);

  return useQuery({
    queryKey: dictionaryQueryKey(tenantId, category),
    queryFn: async () => {
      const res = await getDictionary({ category });
      if (res.status !== 'SUCCESS' && res.status !== 'OK') throw new Error(res.message ?? 'Failed to fetch dictionary');
      return res.data ?? [];
    },
    enabled,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });
};

export const useCreateDictionaryTermMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: DictionaryTermUpsertRequest) => {
      const res = await createDictionaryTerm(body);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') throw new Error(res.message ?? 'Failed to create');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['synapse', 'dictionary'] });
      showToast('Term added');
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : 'Failed to add', 'error');
    },
  });
};

export const useUpdateDictionaryTermMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ termId, body }: { termId: string; body: DictionaryTermUpsertRequest }) => {
      const res = await updateDictionaryTerm(termId, body);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') throw new Error(res.message ?? 'Failed to update');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['synapse', 'dictionary'] });
      showToast('Term updated');
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : 'Failed to update', 'error');
    },
  });
};

export const useDeleteDictionaryTermMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (termId: string) => {
      const res = await deleteDictionaryTerm(termId);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') throw new Error(res.message ?? 'Failed to delete');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['synapse', 'dictionary'] });
      showToast('Term deleted');
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : 'Failed to delete', 'error');
    },
  });
};

// ----------------------------------------------------------------------
// Feedback
// ----------------------------------------------------------------------

export const useFeedbackQuery = (targetType?: string, targetId?: string) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = isAuthenticated && Boolean(tenantId);

  return useQuery({
    queryKey: feedbackQueryKey(tenantId, targetType, targetId),
    queryFn: async () => {
      const res = await getFeedback({ targetType, targetId });
      if (res.status !== 'SUCCESS' && res.status !== 'OK') throw new Error(res.message ?? 'Failed to fetch feedback');
      return res.data ?? [];
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
};

export const useCreateFeedbackMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: FeedbackCreateRequest) => {
      const res = await createFeedback(body);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') throw new Error(res.message ?? 'Failed to submit');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['synapse', 'feedback'] });
      showToast('Feedback submitted');
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : 'Failed to submit', 'error');
    },
  });
};
