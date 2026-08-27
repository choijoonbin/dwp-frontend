/** Generated from openapi/agent-public.json. Do not edit manually. */
export interface paths {
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health */
        get: operations["health_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/livez": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Livez */
        get: operations["livez_livez_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/readyz": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Readyz */
        get: operations["readyz_readyz_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/actions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Actions */
        get: operations["list_actions_v1_actions_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/actions/{action_key}/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Preview Action */
        post: operations["preview_action_v1_actions__action_key__preview_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/actions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Action Policies */
        get: operations["list_action_policies_v1_admin_actions_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/actions/bootstrap": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Bootstrap Action Policies */
        post: operations["bootstrap_action_policies_v1_admin_actions_bootstrap_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/actions/{action_key}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Update Action Policy */
        patch: operations["update_action_policy_v1_admin_actions__action_key__patch"];
        trace?: never;
    };
    "/v1/admin/audit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Audit Events */
        get: operations["list_audit_events_v1_admin_audit_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/audit/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Export Audit Events */
        get: operations["export_audit_events_v1_admin_audit_export_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/evaluations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Evaluation Sets */
        get: operations["list_evaluation_sets_v1_admin_evaluations_get"];
        put?: never;
        /** Create Evaluation Set */
        post: operations["create_evaluation_set_v1_admin_evaluations_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/evaluations/{evaluation_set_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Evaluation Set */
        get: operations["get_evaluation_set_v1_admin_evaluations__evaluation_set_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/evaluations/{evaluation_set_id}/cases": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Add Evaluation Case */
        post: operations["add_evaluation_case_v1_admin_evaluations__evaluation_set_id__cases_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/evaluations/{evaluation_set_id}/lifecycle": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Transition Evaluation Set */
        patch: operations["transition_evaluation_set_v1_admin_evaluations__evaluation_set_id__lifecycle_patch"];
        trace?: never;
    };
    "/v1/admin/evaluations/{evaluation_set_id}/runs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Evaluation Runs */
        get: operations["list_evaluation_runs_v1_admin_evaluations__evaluation_set_id__runs_get"];
        put?: never;
        /** Execute Evaluation */
        post: operations["execute_evaluation_v1_admin_evaluations__evaluation_set_id__runs_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/evaluations/{evaluation_set_id}/runs/{evaluation_run_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Evaluation Run */
        get: operations["get_evaluation_run_v1_admin_evaluations__evaluation_set_id__runs__evaluation_run_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/evaluations/{evaluation_set_id}/runs/{evaluation_run_id}/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Export Evaluation Run */
        get: operations["export_evaluation_run_v1_admin_evaluations__evaluation_set_id__runs__evaluation_run_id__export_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/gates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Operational Gates */
        get: operations["list_operational_gates_v1_admin_gates_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/gates/bootstrap": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Bootstrap Operational Gates */
        post: operations["bootstrap_operational_gates_v1_admin_gates_bootstrap_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/gates/{gate_key}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Operational Gate */
        get: operations["get_operational_gate_v1_admin_gates__gate_key__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Configure Operational Gate */
        patch: operations["configure_operational_gate_v1_admin_gates__gate_key__patch"];
        trace?: never;
    };
    "/v1/admin/gates/{gate_key}/decision": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Decide Operational Gate */
        post: operations["decide_operational_gate_v1_admin_gates__gate_key__decision_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/gates/{gate_key}/evidence": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Add Operational Gate Evidence */
        post: operations["add_operational_gate_evidence_v1_admin_gates__gate_key__evidence_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/gates/{gate_key}/validation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Validate Operational Gate */
        post: operations["validate_operational_gate_v1_admin_gates__gate_key__validation_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/overview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Operations Overview */
        get: operations["operations_overview_v1_admin_overview_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/proposals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create Proposal */
        post: operations["create_proposal_v1_admin_proposals_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/retention": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Retention Policy */
        get: operations["get_retention_policy_v1_admin_retention_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Update Retention Policy */
        patch: operations["update_retention_policy_v1_admin_retention_patch"];
        trace?: never;
    };
    "/v1/admin/retention/bootstrap": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Bootstrap Retention Policy */
        post: operations["bootstrap_retention_policy_v1_admin_retention_bootstrap_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/safety": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Safety Policy */
        get: operations["get_safety_policy_v1_admin_safety_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Update Safety Policy */
        patch: operations["update_safety_policy_v1_admin_safety_patch"];
        trace?: never;
    };
    "/v1/admin/safety/bootstrap": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Bootstrap Safety Policy */
        post: operations["bootstrap_safety_policy_v1_admin_safety_bootstrap_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/sources": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Source Policies */
        get: operations["list_source_policies_v1_admin_sources_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/sources/bootstrap": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Bootstrap Source Policies */
        post: operations["bootstrap_source_policies_v1_admin_sources_bootstrap_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/sources/{source_key}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Update Source Policy */
        patch: operations["update_source_policy_v1_admin_sources__source_key__patch"];
        trace?: never;
    };
    "/v1/ask": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Ask */
        post: operations["ask_v1_ask_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/ask/stream": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Ask Stream */
        post: operations["ask_stream_v1_ask_stream_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/conversations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Conversations */
        get: operations["list_conversations_v1_conversations_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/conversations/{conversation_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Conversation */
        get: operations["get_conversation_v1_conversations__conversation_id__get"];
        put?: never;
        post?: never;
        /** Delete Conversation */
        delete: operations["delete_conversation_v1_conversations__conversation_id__delete"];
        options?: never;
        head?: never;
        /** Rename Conversation */
        patch: operations["rename_conversation_v1_conversations__conversation_id__patch"];
        trace?: never;
    };
    "/v1/plans/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Preview Plan */
        post: operations["preview_plan_v1_plans_preview_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/proposals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Proposals */
        get: operations["list_proposals_v1_proposals_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/proposals/{proposal_id}/decisions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Decide Proposal */
        post: operations["decide_proposal_v1_proposals__proposal_id__decisions_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/question-launches": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create Question Launch */
        post: operations["create_question_launch_v1_question_launches_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/question-launches/consume": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Consume Question Launch */
        post: operations["consume_question_launch_v1_question_launches_consume_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/runs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List User Runs */
        get: operations["list_user_runs_v1_runs_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/runs/{run_id}/feedback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Record Feedback */
        put: operations["record_feedback_v1_runs__run_id__feedback_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/voice/speech": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Synthesize Voice */
        post: operations["synthesize_voice_v1_voice_speech_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/voice/transcriptions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Transcribe Voice */
        post: operations["transcribe_voice_v1_voice_transcriptions_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /**
         * ActionExecutionPolicy
         * @enum {string}
         */
        ActionExecutionPolicy: "USER_HANDOFF" | "APPROVAL_HANDOFF" | "BLOCKED";
        /** ActionHandoffOrigin */
        ActionHandoffOrigin: {
            /**
             * Appkey
             * @constant
             */
            appKey: "APP.ASK";
            /** Conversationid */
            conversationId?: string | null;
            /** Route */
            route: string;
            /** Sourcecorrelationid */
            sourceCorrelationId: string;
            /** Sourcerequestid */
            sourceRequestId: string;
            /** Sourcerunid */
            sourceRunId: string;
            /**
             * Surface
             * @constant
             */
            surface: "action-shelf";
        };
        /** ActionPolicy */
        ActionPolicy: {
            /** Actionkey */
            actionKey: string;
            /** Confirmationrequired */
            confirmationRequired: boolean;
            /** Description */
            description: string;
            /** Enabled */
            enabled: boolean;
            executionPolicy: components["schemas"]["ActionExecutionPolicy"];
            /** Policyversion */
            policyVersion: number;
            /** Requiredpermission */
            requiredPermission: string;
            riskTier: components["schemas"]["RiskTier"];
            /** Title */
            title: string;
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
        };
        /** ActionPolicyEnvelope */
        ActionPolicyEnvelope: {
            data: components["schemas"]["ActionPolicy"];
            /**
             * Message
             * @default DWAI-ON action policy loaded.
             */
            message: string;
            /**
             * Status
             * @default SUCCESS
             */
            status: string;
            /**
             * Success
             * @default true
             */
            success: boolean;
        };
        /** ActionPolicyListEnvelope */
        ActionPolicyListEnvelope: {
            /** Data */
            data: components["schemas"]["ActionPolicy"][];
            /**
             * Message
             * @default DWAI-ON action policies loaded.
             */
            message: string;
            /**
             * Status
             * @default SUCCESS
             */
            status: string;
            /**
             * Success
             * @default true
             */
            success: boolean;
        };
        /** AdminChangeIntent */
        AdminChangeIntent: {
            /** Commandkey */
            commandKey: string;
            /** Expectedversion */
            expectedVersion: number;
            /** Justification */
            justification: string;
            /** Parameters */
            parameters?: {
                [key: string]: components["schemas"]["JsonValue"];
            };
            /** Targetid */
            targetId: string;
            /** Targettype */
            targetType: string;
        };
        /** AdminCommandResolution */
        AdminCommandResolution: {
            /**
             * Authoritykind
             * @enum {string}
             */
            authorityKind: "TENANT_PERMISSION" | "PROVIDER_ROLE" | "APP_GOVERNANCE_CAPABILITY";
            /** Bodyparameters */
            bodyParameters?: string[];
            /** Catalogrevision */
            catalogRevision: number;
            /** Commandkey */
            commandKey: string;
            /** Contextparameters */
            contextParameters?: string[];
            /** Endpointtemplate */
            endpointTemplate: string;
            /** Finalauthorityservice */
            finalAuthorityService: string;
            /** Headerparameters */
            headerParameters?: {
                [key: string]: string;
            };
            /** Httpmethod */
            httpMethod: string;
            /**
             * Identityplane
             * @enum {string}
             */
            identityPlane: "TENANT" | "PROVIDER";
            /** Queryparameters */
            queryParameters?: string[];
            /** Requiredauthorities */
            requiredAuthorities?: string[];
            /** Requiredpermission */
            requiredPermission?: string | null;
            /** Requiredroles */
            requiredRoles?: string[];
            /** Targetservice */
            targetService: string;
        };
        /** AgentProposal */
        AgentProposal: {
            /** Actionkey */
            actionKey?: string | null;
            /** Agentkey */
            agentKey: string;
            /**
             * Availableat
             * Format: date-time
             */
            availableAt: string;
            content: components["schemas"]["ProposalContent"];
            /** Decidedat */
            decidedAt?: string | null;
            /**
             * Expiresat
             * Format: date-time
             */
            expiresAt: string;
            kind: components["schemas"]["ProposalKind"];
            priority: components["schemas"]["ProposalPriority"];
            /**
             * Proposalid
             * Format: uuid
             */
            proposalId: string;
            /**
             * Proposedat
             * Format: date-time
             */
            proposedAt: string;
            /** Revision */
            revision: number;
            /** Snoozeduntil */
            snoozedUntil?: string | null;
            state: components["schemas"]["ProposalState"];
        };
        /** AgentProposalEnvelope */
        AgentProposalEnvelope: {
            data: components["schemas"]["AgentProposal"];
            /**
             * Message
             * @default Agent proposal loaded.
             */
            message: string;
            /**
             * Status
             * @default SUCCESS
             */
            status: string;
            /**
             * Success
             * @default true
             */
            success: boolean;
        };
        /** AgentRegistryResolution */
        AgentRegistryResolution: {
            /** Artifactversion */
            artifactVersion: string;
            /** Entrykey */
            entryKey: string;
            resolution: components["schemas"]["RegistryResolutionStatus"];
            /** Revision */
            revision: number;
            riskTier: components["schemas"]["RegistryRiskTier"];
        };
        /**
         * AgentRunState
         * @enum {string}
         */
        AgentRunState: "RUNNING" | "COMPLETED" | "FAILED";
        /**
         * AnswerConfidence
         * @enum {string}
         */
        AnswerConfidence: "LOW" | "MEDIUM" | "HIGH";
        /**
         * AnswerFeedbackRating
         * @enum {string}
         */
        AnswerFeedbackRating: "UP" | "DOWN";
        /** AnswerFeedbackRequest */
        AnswerFeedbackRequest: {
            /** Comment */
            comment?: string | null;
            rating: components["schemas"]["AnswerFeedbackRating"];
            /** Reasoncodes */
            reasonCodes?: string[];
        };
        /** AskCitation */
        AskCitation: {
            /** Excerpt */
            excerpt?: string | null;
            /** Occurredat */
            occurredAt?: string | null;
            /** Route */
            route?: string | null;
            /** Sourceid */
            sourceId: string;
            /** Sourcesystem */
            sourceSystem: string;
            sourceType: components["schemas"]["CitationSourceType"];
            /** Title */
            title: string;
        };
        /** AskEnvelope */
        AskEnvelope: {
            data: components["schemas"]["AskResponse"];
            /**
             * Message
             * @default Ask request evaluated.
             */
            message: string;
            /**
             * Status
             * @default SUCCESS
             */
            status: string;
            /**
             * Success
             * @default true
             */
            success: boolean;
        };
        /** AskModelRoute */
        AskModelRoute: {
            /**
             * Inputtokens
             * @default 0
             */
            inputTokens: number;
            /**
             * Latencyms
             * @default 0
             */
            latencyMs: number;
            /** Model */
            model?: string | null;
            /**
             * Outputtokens
             * @default 0
             */
            outputTokens: number;
            /** Provider */
            provider?: string | null;
            state: components["schemas"]["ModelRouteState"];
            /**
             * Totaltokens
             * @default 0
             */
            totalTokens: number;
        };
        /** AskPageContext */
        AskPageContext: {
            /** Appkey */
            appKey: string;
            /** Entityref */
            entityRef?: string | null;
            /** Entitytype */
            entityType?: string | null;
            /** Route */
            route: string;
            /** Surface */
            surface?: string | null;
        };
        /** AskPolicyDecision */
        AskPolicyDecision: {
            /** Code */
            code: string;
            /** Explanation */
            explanation: string;
            /** Modelallowed */
            modelAllowed: boolean;
            /**
             * Mutationallowed
             * @default false
             */
            mutationAllowed: boolean;
            outcome: components["schemas"]["PolicyOutcome"];
            riskTier: components["schemas"]["RiskTier"];
        };
        /** AskRequest */
        AskRequest: {
            /**
             * Agentkey
             * @default DWP_ASSISTANT
             */
            agentKey: string;
            /** Conversationid */
            conversationId?: string | null;
            /**
             * Locale
             * @default en
             */
            locale: string;
            pageContext?: components["schemas"]["AskPageContext"] | null;
            /** Query */
            query: string;
            /** Requestid */
            requestId: string;
            /** Sourcescopes */
            sourceScopes?: components["schemas"]["CitationSourceType"][];
        };
        /** AskResponse */
        AskResponse: {
            agentRegistry: components["schemas"]["AgentRegistryResolution"];
            /** Answer */
            answer?: string | null;
            /** Assistantmessageid */
            assistantMessageId?: string | null;
            /** Auditid */
            auditId: string;
            /** Citations */
            citations?: components["schemas"]["AskCitation"][];
            /**
             * Completedat
             * Format: date-time
             */
            completedAt: string;
            confidence?: components["schemas"]["AnswerConfidence"] | null;
            /** Conversationid */
            conversationId?: string | null;
            /** Correlationid */
            correlationId: string;
            modelRoute: components["schemas"]["AskModelRoute"];
            policy: components["schemas"]["AskPolicyDecision"];
            /** Requestid */
            requestId: string;
            /** Runid */
            runId: string;
            /** Sourcecount */
            sourceCount: number;
            state: components["schemas"]["AskState"];
            /** Statuscode */
            statusCode: string;
            /** Usermessageid */
            userMessageId?: string | null;
        };
        /**
         * AskState
         * @enum {string}
         */
        AskState: "COMPLETED" | "ABSTAINED" | "CONFIGURATION_REQUIRED";
        /** BootstrapGovernancePoliciesRequest */
        BootstrapGovernancePoliciesRequest: {
            /** Changereason */
            changeReason: string;
            /** Expectedexistingcount */
            expectedExistingCount: number;
            /**
             * Idempotencykey
             * Format: uuid
             */
            idempotencyKey: string;
        };
        /** BootstrapOperationalGatesRequest */
        BootstrapOperationalGatesRequest: {
            /** Changereason */
            changeReason: string;
            /** Expectedexistingcount */
            expectedExistingCount: number;
            /**
             * Idempotencykey
             * Format: uuid
             */
            idempotencyKey: string;
        };
        /** BootstrapRetentionPolicyRequest */
        BootstrapRetentionPolicyRequest: {
            /** Changereason */
            changeReason: string;
            /** Expectedexistingcount */
            expectedExistingCount: number;
            /**
             * Idempotencykey
             * Format: uuid
             */
            idempotencyKey: string;
            /**
             * Legalhold
             * @default false
             */
            legalHold: boolean;
            /**
             * Retentiondays
             * @default 90
             */
            retentionDays: number;
        };
        /**
         * CitationSourceType
         * @enum {string}
         */
        CitationSourceType: "WORK_ITEM" | "MAIL" | "CALENDAR" | "APPROVAL_TASK" | "APPROVAL_REQUEST" | "APPROVAL_FORM" | "APPROVAL_OPERATION";
        /** ConfigureOperationalGateRequest */
        ConfigureOperationalGateRequest: {
            /** Changereason */
            changeReason: string;
            /** Configurationref */
            configurationRef?: string | null;
            /** Expectedversion */
            expectedVersion: number;
            /** Notes */
            notes?: string | null;
            /** Owneruserid */
            ownerUserId: string;
            /** Selectedoption */
            selectedOption: string;
        };
        /**
         * ConnectionState
         * @enum {string}
         */
        ConnectionState: "CONNECTED" | "DEGRADED" | "NOT_CONFIGURED" | "BLOCKED";
        /** ConsumeQuestionLaunchRequest */
        ConsumeQuestionLaunchRequest: {
            /**
             * Launchid
             * Format: uuid
             */
            launchId: string;
        };
        /** ConversationDetail */
        ConversationDetail: {
            /** Messages */
            messages?: components["schemas"]["ConversationMessage"][];
            summary: components["schemas"]["ConversationSummary"];
        };
        /** ConversationEnvelope */
        ConversationEnvelope: {
            data: components["schemas"]["ConversationDetail"];
            /**
             * Message
             * @default Conversation loaded.
             */
            message: string;
            /**
             * Status
             * @default SUCCESS
             */
            status: string;
            /**
             * Success
             * @default true
             */
            success: boolean;
        };
        /** ConversationListEnvelope */
        ConversationListEnvelope: {
            /** Data */
            data: components["schemas"]["ConversationSummary"][];
            /**
             * Message
             * @default Conversations loaded.
             */
            message: string;
            /**
             * Status
             * @default SUCCESS
             */
            status: string;
            /**
             * Success
             * @default true
             */
            success: boolean;
        };
        /** ConversationMessage */
        ConversationMessage: {
            /** Citations */
            citations?: components["schemas"]["AskCitation"][];
            /** Content */
            content: string;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /**
             * Messageid
             * Format: uuid
             */
            messageId: string;
            role: components["schemas"]["ConversationRole"];
            /** Runid */
            runId?: string | null;
            /** Statuscode */
            statusCode?: string | null;
        };
        /**
         * ConversationRole
         * @enum {string}
         */
        ConversationRole: "USER" | "ASSISTANT";
        /** ConversationSummary */
        ConversationSummary: {
            /**
             * Conversationid
             * Format: uuid
             */
            conversationId: string;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /**
             * Lastmessageat
             * Format: date-time
             */
            lastMessageAt: string;
            /** Locale */
            locale: string;
            /** Messagecount */
            messageCount: number;
            /** Title */
            title: string;
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
        };
        /** CreateAgentProposalRequest */
        CreateAgentProposalRequest: {
            /** Actionkey */
            actionKey?: string | null;
            /** Agentkey */
            agentKey: string;
            /** Availableat */
            availableAt?: string | null;
            /** Changereason */
            changeReason: string;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            content: components["schemas"]["ProposalContent"];
            /**
             * Expiresat
             * Format: date-time
             */
            expiresAt: string;
            kind: components["schemas"]["ProposalKind"];
            priority: components["schemas"]["ProposalPriority"];
            /** Sourceeventid */
            sourceEventId: string;
            /** Targetuserid */
            targetUserId: string;
        };
        /** CreateEvaluationCaseRequest */
        CreateEvaluationCaseRequest: {
            /** Expectedterms */
            expectedTerms?: string[];
            /** Name */
            name: string;
            /** Prompt */
            prompt: string;
            /** Sourcescopes */
            sourceScopes?: components["schemas"]["CitationSourceType"][];
        };
        /** CreateEvaluationSetRequest */
        CreateEvaluationSetRequest: {
            /** Description */
            description?: string | null;
            /**
             * Locale
             * @default ko-KR
             */
            locale: string;
            /** Name */
            name: string;
        };
        /** CreateOperationalGateEvidenceRequest */
        CreateOperationalGateEvidenceRequest: {
            /** Changereason */
            changeReason: string;
            /** Checksumsha256 */
            checksumSha256?: string | null;
            evidenceType: components["schemas"]["GateEvidenceType"];
            /** Expectedversion */
            expectedVersion: number;
            /** Notes */
            notes?: string | null;
            /** Reference */
            reference: string;
            /** Title */
            title: string;
        };
        /** CreateQuestionLaunchRequest */
        CreateQuestionLaunchRequest: {
            /** Question */
            question: string;
        };
        /**
         * DataClassification
         * @enum {string}
         */
        DataClassification: "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
        /** DataSourcePolicy */
        DataSourcePolicy: {
            accessMode: components["schemas"]["SourceAccessMode"];
            classification: components["schemas"]["DataClassification"];
            connectionState: components["schemas"]["ConnectionState"];
            /** Connectorref */
            connectorRef?: string | null;
            /** Description */
            description: string;
            /** Displayname */
            displayName: string;
            /** Enabled */
            enabled: boolean;
            /** Policyversion */
            policyVersion: number;
            /** Providertype */
            providerType: string;
            sourceKey: components["schemas"]["CitationSourceType"];
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
        };
        /** DataSourcePolicyEnvelope */
        DataSourcePolicyEnvelope: {
            data: components["schemas"]["DataSourcePolicy"];
            /**
             * Message
             * @default DWAI-ON source policy loaded.
             */
            message: string;
            /**
             * Status
             * @default SUCCESS
             */
            status: string;
            /**
             * Success
             * @default true
             */
            success: boolean;
        };
        /** DataSourcePolicyListEnvelope */
        DataSourcePolicyListEnvelope: {
            /** Data */
            data: components["schemas"]["DataSourcePolicy"][];
            /**
             * Message
             * @default DWAI-ON source policies loaded.
             */
            message: string;
            /**
             * Status
             * @default SUCCESS
             */
            status: string;
            /**
             * Success
             * @default true
             */
            success: boolean;
        };
        /** DecideAgentProposalRequest */
        DecideAgentProposalRequest: {
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            decision: components["schemas"]["ProposalDecision"];
            /** Expectedrevision */
            expectedRevision: number;
            /** Note */
            note?: string | null;
            /** Snoozeuntil */
            snoozeUntil?: string | null;
        };
        /** DecideOperationalGateRequest */
        DecideOperationalGateRequest: {
            /** Changereason */
            changeReason: string;
            decision: components["schemas"]["GateDecision"];
            /** Expectedversion */
            expectedVersion: number;
            /**
             * Validdays
             * @default 365
             */
            validDays: number;
        };
        /** DwaionOperationsOverview */
        DwaionOperationsOverview: {
            /** Abstainedanswercount */
            abstainedAnswerCount: number;
            /** Activeusercount */
            activeUserCount: number;
            /** Allowedruncount */
            allowedRunCount: number;
            /** Averagelatencyms */
            averageLatencyMs: number;
            /** Completedruncount */
            completedRunCount: number;
            /** Configurationrequiredcount */
            configurationRequiredCount: number;
            /** Conversationcount */
            conversationCount: number;
            /** Deniedruncount */
            deniedRunCount: number;
            /** Failedruncount */
            failedRunCount: number;
            /** Feedbackdowncount */
            feedbackDownCount: number;
            /** Feedbackupcount */
            feedbackUpCount: number;
            /**
             * Generatedat
             * Format: date-time
             */
            generatedAt: string;
            /** Groundedanswercount */
            groundedAnswerCount: number;
            /** Handedoffruncount */
            handedOffRunCount: number;
            /** Perioddays */
            periodDays: number;
            retention: components["schemas"]["RetentionPolicy"];
            /** Runcount */
            runCount: number;
            /** Totaltokens */
            totalTokens: number;
        };
        /** DwaionOperationsOverviewEnvelope */
        DwaionOperationsOverviewEnvelope: {
            data: components["schemas"]["DwaionOperationsOverview"];
            /**
             * Message
             * @default DWAI-ON operations overview loaded.
             */
            message: string;
            /**
             * Status
             * @default SUCCESS
             */
            status: string;
            /**
             * Success
             * @default true
             */
            success: boolean;
        };
        /** EvaluationCase */
        EvaluationCase: {
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /**
             * Evaluationcaseid
             * Format: uuid
             */
            evaluationCaseId: string;
            /**
             * Evaluationsetid
             * Format: uuid
             */
            evaluationSetId: string;
            /** Expectedterms */
            expectedTerms: string[];
            /** Name */
            name: string;
            /** Prompt */
            prompt: string;
            /** Sourcescopes */
            sourceScopes: components["schemas"]["CitationSourceType"][];
            /** Version */
            version: number;
        };
        /**
         * EvaluationLifecycle
         * @enum {string}
         */
        EvaluationLifecycle: "DRAFT" | "ACTIVE" | "RETIRED";
        /**
         * EvaluationOutcome
         * @enum {string}
         */
        EvaluationOutcome: "PASS" | "FAIL" | "CONFIGURATION_REQUIRED";
        /** EvaluationResult */
        EvaluationResult: {
            /** Casename */
            caseName: string;
            /**
             * Evaluationcaseid
             * Format: uuid
             */
            evaluationCaseId: string;
            /** Expectedtermsmatched */
            expectedTermsMatched: number;
            /** Expectedtermstotal */
            expectedTermsTotal: number;
            /** Grounded */
            grounded: boolean;
            /** Latencyms */
            latencyMs: number;
            outcome: components["schemas"]["EvaluationOutcome"];
            /** Statuscode */
            statusCode: string;
        };
        /** EvaluationRun */
        EvaluationRun: {
            /** Casecount */
            caseCount: number;
            /** Completedat */
            completedAt?: string | null;
            /** Configurationrequiredcount */
            configurationRequiredCount: number;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /**
             * Evaluationrunid
             * Format: uuid
             */
            evaluationRunId: string;
            /**
             * Evaluationsetid
             * Format: uuid
             */
            evaluationSetId: string;
            /** Failedcount */
            failedCount: number;
            /** Modelref */
            modelRef?: string | null;
            /** Passedcount */
            passedCount: number;
            /** Results */
            results?: components["schemas"]["EvaluationResult"][];
            runState: components["schemas"]["EvaluationRunState"];
        };
        /** EvaluationRunEnvelope */
        EvaluationRunEnvelope: {
            data: components["schemas"]["EvaluationRun"];
            /**
             * Message
             * @default DWAI-ON evaluation completed.
             */
            message: string;
            /**
             * Status
             * @default SUCCESS
             */
            status: string;
            /**
             * Success
             * @default true
             */
            success: boolean;
        };
        /** EvaluationRunListEnvelope */
        EvaluationRunListEnvelope: {
            /** Data */
            data: components["schemas"]["EvaluationRunSummary"][];
            /**
             * Message
             * @default DWAI-ON evaluation runs loaded.
             */
            message: string;
            /**
             * Status
             * @default SUCCESS
             */
            status: string;
            /**
             * Success
             * @default true
             */
            success: boolean;
        };
        /**
         * EvaluationRunState
         * @enum {string}
         */
        EvaluationRunState: "RUNNING" | "COMPLETED" | "CONFIGURATION_REQUIRED" | "FAILED";
        /** EvaluationRunSummary */
        EvaluationRunSummary: {
            /** Casecount */
            caseCount: number;
            /** Completedat */
            completedAt?: string | null;
            /** Configurationrequiredcount */
            configurationRequiredCount: number;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /**
             * Evaluationrunid
             * Format: uuid
             */
            evaluationRunId: string;
            /**
             * Evaluationsetid
             * Format: uuid
             */
            evaluationSetId: string;
            /** Failedcount */
            failedCount: number;
            /** Modelref */
            modelRef?: string | null;
            /** Passrate */
            passRate?: number | null;
            /** Passedcount */
            passedCount: number;
            runState: components["schemas"]["EvaluationRunState"];
        };
        /** EvaluationSetDetail */
        EvaluationSetDetail: {
            /** Cases */
            cases: components["schemas"]["EvaluationCase"][];
            summary: components["schemas"]["EvaluationSetSummary"];
        };
        /** EvaluationSetEnvelope */
        EvaluationSetEnvelope: {
            data: components["schemas"]["EvaluationSetDetail"];
            /**
             * Message
             * @default DWAI-ON evaluation set loaded.
             */
            message: string;
            /**
             * Status
             * @default SUCCESS
             */
            status: string;
            /**
             * Success
             * @default true
             */
            success: boolean;
        };
        /** EvaluationSetListEnvelope */
        EvaluationSetListEnvelope: {
            /** Data */
            data: components["schemas"]["EvaluationSetSummary"][];
            /**
             * Message
             * @default DWAI-ON evaluation sets loaded.
             */
            message: string;
            /**
             * Status
             * @default SUCCESS
             */
            status: string;
            /**
             * Success
             * @default true
             */
            success: boolean;
        };
        /** EvaluationSetSummary */
        EvaluationSetSummary: {
            /** Casecount */
            caseCount: number;
            /** Description */
            description?: string | null;
            /**
             * Evaluationsetid
             * Format: uuid
             */
            evaluationSetId: string;
            /** Latestpassrate */
            latestPassRate?: number | null;
            latestRunState?: components["schemas"]["EvaluationRunState"] | null;
            lifecycleState: components["schemas"]["EvaluationLifecycle"];
            /** Locale */
            locale: string;
            /** Name */
            name: string;
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
            /** Version */
            version: number;
        };
        /** FeedbackEnvelope */
        FeedbackEnvelope: {
            data: components["schemas"]["FeedbackReceipt"];
            /**
             * Message
             * @default Feedback recorded.
             */
            message: string;
            /**
             * Status
             * @default SUCCESS
             */
            status: string;
            /**
             * Success
             * @default true
             */
            success: boolean;
        };
        /** FeedbackReceipt */
        FeedbackReceipt: {
            rating: components["schemas"]["AnswerFeedbackRating"];
            /**
             * Recordedat
             * Format: date-time
             */
            recordedAt: string;
            /**
             * Runid
             * Format: uuid
             */
            runId: string;
        };
        /**
         * GateActorRole
         * @enum {string}
         */
        GateActorRole: "OWNER" | "CONFIGURATOR" | "VALIDATOR";
        /**
         * GateApprovalEligibilityReason
         * @enum {string}
         */
        GateApprovalEligibilityReason: "ELIGIBLE" | "NOT_READY_FOR_APPROVAL" | "SEPARATION_OF_DUTY";
        /**
         * GateAuditOutcome
         * @enum {string}
         */
        GateAuditOutcome: "SUCCESS";
        /**
         * GateCategory
         * @enum {string}
         */
        GateCategory: "AI_RUNTIME" | "CONNECTIVITY" | "ACCESS_CONTROL" | "ASSURANCE" | "DATA_PROTECTION" | "OPERATIONS";
        /**
         * GateDecision
         * @enum {string}
         */
        GateDecision: "APPROVE" | "REJECT";
        /**
         * GateEnvironment
         * @enum {string}
         */
        GateEnvironment: "DEVELOPMENT" | "STAGING" | "PRODUCTION";
        /**
         * GateEvidenceType
         * @enum {string}
         */
        GateEvidenceType: "CONFIGURATION_REFERENCE" | "TEST_RESULT" | "SECURITY_REVIEW" | "LEGAL_APPROVAL" | "BUSINESS_APPROVAL" | "RUNBOOK" | "OTHER";
        /**
         * GateStatus
         * @enum {string}
         */
        GateStatus: "NOT_CONFIGURED" | "CONFIGURING" | "READY_FOR_APPROVAL" | "APPROVED" | "BLOCKED" | "EXPIRED";
        /**
         * GateValidationOutcome
         * @enum {string}
         */
        GateValidationOutcome: "PASS" | "FAIL";
        /** GovernanceAuditEnvelope */
        GovernanceAuditEnvelope: {
            data: components["schemas"]["GovernanceAuditPage"];
            /**
             * Message
             * @default DWAI-ON audit evidence loaded.
             */
            message: string;
            /**
             * Status
             * @default SUCCESS
             */
            status: string;
            /**
             * Success
             * @default true
             */
            success: boolean;
        };
        /** GovernanceAuditEvent */
        GovernanceAuditEvent: {
            /** Actoruserid */
            actorUserId: string;
            /** Category */
            category: string;
            /** Changereason */
            changeReason?: string | null;
            /** Correlationid */
            correlationId: string;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /**
             * Eventid
             * Format: uuid
             */
            eventId: string;
            /** Eventtype */
            eventType: string;
            /** Targetkey */
            targetKey: string;
            /** Targettype */
            targetType: string;
        };
        /** GovernanceAuditPage */
        GovernanceAuditPage: {
            /** Content */
            content: components["schemas"]["GovernanceAuditEvent"][];
            /** Page */
            page: number;
            /** Size */
            size: number;
            /** Totalelements */
            totalElements: number;
            /** Totalpages */
            totalPages: number;
        };
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail?: components["schemas"]["ValidationError"][];
        };
        JsonValue: unknown;
        /**
         * ModelRouteState
         * @enum {string}
         */
        ModelRouteState: "COMPLETED" | "NOT_INVOKED" | "CONFIGURATION_REQUIRED" | "REFUSED";
        /** OperationalGateApprovalEligibility */
        OperationalGateApprovalEligibility: {
            conflictingRole?: components["schemas"]["GateActorRole"] | null;
            /** Eligible */
            eligible: boolean;
            reason: components["schemas"]["GateApprovalEligibilityReason"];
        };
        /** OperationalGateAuditEvent */
        OperationalGateAuditEvent: {
            /** Actoruserid */
            actorUserId: string;
            /** Changereason */
            changeReason?: string | null;
            /** Correlationid */
            correlationId: string;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            currentStatus?: components["schemas"]["GateStatus"] | null;
            /**
             * Eventid
             * Format: uuid
             */
            eventId: string;
            /** Eventtype */
            eventType: string;
            /** @default SUCCESS */
            outcome: components["schemas"]["GateAuditOutcome"];
            previousStatus?: components["schemas"]["GateStatus"] | null;
        };
        /** OperationalGateDetail */
        OperationalGateDetail: {
            approvalEligibility: components["schemas"]["OperationalGateApprovalEligibility"];
            /** Events */
            events: components["schemas"]["OperationalGateAuditEvent"][];
            /** Evidence */
            evidence: components["schemas"]["OperationalGateEvidence"][];
            gate: components["schemas"]["OperationalGateSummary"];
            /** Missingevidencetypes */
            missingEvidenceTypes: components["schemas"]["GateEvidenceType"][];
        };
        /** OperationalGateDetailEnvelope */
        OperationalGateDetailEnvelope: {
            data: components["schemas"]["OperationalGateDetail"];
            /**
             * Message
             * @default DWAI-ON operational gate loaded.
             */
            message: string;
            /**
             * Status
             * @default SUCCESS
             */
            status: string;
            /**
             * Success
             * @default true
             */
            success: boolean;
        };
        /** OperationalGateEvidence */
        OperationalGateEvidence: {
            /** Checksumsha256 */
            checksumSha256?: string | null;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /** Createdby */
            createdBy: string;
            /**
             * Evidenceid
             * Format: uuid
             */
            evidenceId: string;
            evidenceType: components["schemas"]["GateEvidenceType"];
            /** Notes */
            notes?: string | null;
            /** Reference */
            reference: string;
            /** Title */
            title: string;
        };
        /**
         * OperationalGateKey
         * @enum {string}
         */
        OperationalGateKey: "MODEL_CREDENTIALS" | "MODEL_LIFECYCLE_CAPACITY" | "NETWORK_ISOLATION" | "DATA_PROCESSING_LOCATION" | "SOURCE_CONNECTORS" | "SOURCE_ACL" | "DATA_CLASSIFICATION_DLP" | "EVALUATION_DATASET" | "RELEASE_APPROVAL" | "ACTION_APPROVAL" | "TENANT_KMS" | "RETENTION_LEGAL_HOLD" | "AUDIT_RESILIENCE";
        /** OperationalGateOption */
        OperationalGateOption: {
            /** Code */
            code: string;
            /**
             * Recommended
             * @default false
             */
            recommended: boolean;
        };
        /** OperationalGatePortfolio */
        OperationalGatePortfolio: {
            /** Approvedcount */
            approvedCount: number;
            /** Blockedcount */
            blockedCount: number;
            /** Completionpercent */
            completionPercent: number;
            /** Deliveryready */
            deliveryReady: boolean;
            environment: components["schemas"]["GateEnvironment"];
            /** Expiredcount */
            expiredCount: number;
            /** Gates */
            gates: components["schemas"]["OperationalGateSummary"][];
            /** Readyforapprovalcount */
            readyForApprovalCount: number;
            /** Requiredcount */
            requiredCount: number;
            /** Totalcount */
            totalCount: number;
        };
        /** OperationalGatePortfolioEnvelope */
        OperationalGatePortfolioEnvelope: {
            data: components["schemas"]["OperationalGatePortfolio"];
            /**
             * Message
             * @default DWAI-ON operational gates loaded.
             */
            message: string;
            /**
             * Status
             * @default SUCCESS
             */
            status: string;
            /**
             * Success
             * @default true
             */
            success: boolean;
        };
        /** OperationalGateProblem */
        OperationalGateProblem: {
            code: components["schemas"]["OperationalGateProblemCode"];
            /** Context */
            context?: {
                [key: string]: string | string[];
            };
            /** Correlationid */
            correlationId: string;
            /** Detail */
            detail: string;
            /** Instance */
            instance: string;
            /** Status */
            status: number;
            /** Title */
            title: string;
            /** Type */
            type: string;
        };
        /**
         * OperationalGateProblemCode
         * @enum {string}
         */
        OperationalGateProblemCode: "GATE_PERMISSION_DENIED" | "GATE_NOT_FOUND" | "GATE_VERSION_CONFLICT" | "GATE_INVALID_TRANSITION" | "GATE_REQUIRED_EVIDENCE_MISSING" | "GATE_SEPARATION_OF_DUTY" | "GATE_STORE_UNAVAILABLE";
        /** OperationalGateSummary */
        OperationalGateSummary: {
            /** Approvedby */
            approvedBy?: string | null;
            category: components["schemas"]["GateCategory"];
            /** Configurationref */
            configurationRef?: string | null;
            /** Configurationrevision */
            configurationRevision: number;
            /** Deliverycritical */
            deliveryCritical: boolean;
            /** Effectiveat */
            effectiveAt?: string | null;
            /** Evidencecount */
            evidenceCount: number;
            /** Expiresat */
            expiresAt?: string | null;
            /** Externalowner */
            externalOwner: string;
            gateKey: components["schemas"]["OperationalGateKey"];
            /** Lastconfiguredby */
            lastConfiguredBy?: string | null;
            /** Lastvalidatedby */
            lastValidatedBy?: string | null;
            /** Notes */
            notes?: string | null;
            /** Options */
            options: components["schemas"]["OperationalGateOption"][];
            /** Owneruserid */
            ownerUserId?: string | null;
            /** Policyversion */
            policyVersion: number;
            /** Requiredevidencetypes */
            requiredEvidenceTypes: components["schemas"]["GateEvidenceType"][];
            /** Selectedoption */
            selectedOption?: string | null;
            status: components["schemas"]["GateStatus"];
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
            /** Validationsummary */
            validationSummary?: string | null;
        };
        /** PlanPreviewEnvelope */
        PlanPreviewEnvelope: {
            data: components["schemas"]["PlanPreviewResponse"];
            /**
             * Message
             * @default Plan preview prepared.
             */
            message: string;
            /**
             * Status
             * @default SUCCESS
             */
            status: string;
            /**
             * Success
             * @default true
             */
            success: boolean;
        };
        /** PlanPreviewRequest */
        PlanPreviewRequest: {
            /** Action */
            action: string;
            adminChange?: components["schemas"]["AdminChangeIntent"] | null;
            /**
             * Agentkey
             * @default REFERENCE_PLANNER
             */
            agentKey: string;
            handoffOrigin?: components["schemas"]["ActionHandoffOrigin"] | null;
            /** Inputs */
            inputs?: {
                [key: string]: components["schemas"]["JsonValue"];
            };
            /** Intent */
            intent: string;
            /** Requestid */
            requestId: string;
            /** Sourcereferences */
            sourceReferences?: string[];
            /** Target */
            target: string;
        };
        /** PlanPreviewResponse */
        PlanPreviewResponse: {
            adminCommand?: components["schemas"]["AdminCommandResolution"] | null;
            agentRegistry: components["schemas"]["AgentRegistryResolution"];
            /** Approvalrequired */
            approvalRequired: boolean;
            /** Auditid */
            auditId: string;
            /** Correlationid */
            correlationId: string;
            handoffOrigin?: components["schemas"]["ActionHandoffOrigin"] | null;
            /** Mutationallowed */
            mutationAllowed: boolean;
            /** Planhash */
            planHash: string;
            /** Referencemode */
            referenceMode: boolean;
            riskTier: components["schemas"]["RiskTier"];
            /** Runid */
            runId: string;
            /** Sourcereferences */
            sourceReferences: string[];
            state: components["schemas"]["PlanState"];
            /** Steps */
            steps: components["schemas"]["PlanStep"][];
            /** Summary */
            summary: string;
        };
        /**
         * PlanState
         * @enum {string}
         */
        PlanState: "REVIEW";
        /** PlanStep */
        PlanStep: {
            /** Description */
            description: string;
            /** Id */
            id: string;
            /** Title */
            title: string;
            /** Tool */
            tool: string;
        };
        /**
         * PolicyOutcome
         * @enum {string}
         */
        PolicyOutcome: "ALLOW" | "HANDOFF" | "DENY";
        /** ProposalContent */
        ProposalContent: {
            /** Actioninputs */
            actionInputs?: {
                [key: string]: components["schemas"]["JsonValue"];
            };
            /** Evidence */
            evidence?: components["schemas"]["ProposalEvidence"][];
            /** Rationale */
            rationale: string;
            /** Summary */
            summary: string;
            /** Title */
            title: string;
        };
        /**
         * ProposalDecision
         * @enum {string}
         */
        ProposalDecision: "ACCEPT" | "SNOOZE" | "DISMISS";
        /** ProposalDecisionEnvelope */
        ProposalDecisionEnvelope: {
            data: components["schemas"]["ProposalDecisionReceipt"];
            /**
             * Message
             * @default Agent proposal decision recorded.
             */
            message: string;
            /**
             * Status
             * @default SUCCESS
             */
            status: string;
            /**
             * Success
             * @default true
             */
            success: boolean;
        };
        /** ProposalDecisionReceipt */
        ProposalDecisionReceipt: {
            /** Actionreviewrequired */
            actionReviewRequired: boolean;
            proposal: components["schemas"]["AgentProposal"];
        };
        /** ProposalEvidence */
        ProposalEvidence: {
            /** Label */
            label: string;
            /** Occurredat */
            occurredAt?: string | null;
            /** Referenceid */
            referenceId: string;
            /** Sourcetype */
            sourceType: string;
        };
        /** ProposalInboxEnvelope */
        ProposalInboxEnvelope: {
            data: components["schemas"]["ProposalInboxPage"];
            /**
             * Message
             * @default Agent proposals loaded.
             */
            message: string;
            /**
             * Status
             * @default SUCCESS
             */
            status: string;
            /**
             * Success
             * @default true
             */
            success: boolean;
        };
        /** ProposalInboxPage */
        ProposalInboxPage: {
            /** Items */
            items: components["schemas"]["AgentProposal"][];
            /** Nextcursor */
            nextCursor?: string | null;
            summary: components["schemas"]["ProposalInboxSummary"];
        };
        /** ProposalInboxSummary */
        ProposalInboxSummary: {
            /** Active */
            active: number;
            /** Handled */
            handled: number;
            /** Highpriority */
            highPriority: number;
            /** Snoozed */
            snoozed: number;
        };
        /**
         * ProposalInboxView
         * @enum {string}
         */
        ProposalInboxView: "ACTIVE" | "SNOOZED" | "HANDLED" | "ALL";
        /**
         * ProposalKind
         * @enum {string}
         */
        ProposalKind: "WORK_SIGNAL" | "RISK" | "SCHEDULE" | "APPROVAL" | "INSIGHT";
        /**
         * ProposalPriority
         * @enum {string}
         */
        ProposalPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
        /**
         * ProposalState
         * @enum {string}
         */
        ProposalState: "PENDING" | "SNOOZED" | "ACCEPTED" | "DISMISSED" | "EXPIRED";
        /** QuestionLaunchPayload */
        QuestionLaunchPayload: {
            /** Question */
            question: string;
        };
        /** QuestionLaunchPayloadEnvelope */
        QuestionLaunchPayloadEnvelope: {
            data: components["schemas"]["QuestionLaunchPayload"];
            /**
             * Message
             * @default Question launch consumed.
             */
            message: string;
            /**
             * Status
             * @default SUCCESS
             */
            status: string;
            /**
             * Success
             * @default true
             */
            success: boolean;
        };
        /** QuestionLaunchReceipt */
        QuestionLaunchReceipt: {
            /**
             * Expiresat
             * Format: date-time
             */
            expiresAt: string;
            /**
             * Launchid
             * Format: uuid
             */
            launchId: string;
        };
        /** QuestionLaunchReceiptEnvelope */
        QuestionLaunchReceiptEnvelope: {
            data: components["schemas"]["QuestionLaunchReceipt"];
            /**
             * Message
             * @default Question launch prepared.
             */
            message: string;
            /**
             * Status
             * @default SUCCESS
             */
            status: string;
            /**
             * Success
             * @default true
             */
            success: boolean;
        };
        /**
         * RegistryResolutionStatus
         * @enum {string}
         */
        RegistryResolutionStatus: "ACTIVE" | "REFERENCE_FALLBACK";
        /**
         * RegistryRiskTier
         * @enum {string}
         */
        RegistryRiskTier: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
        /** RenameConversationRequest */
        RenameConversationRequest: {
            /** Title */
            title: string;
        };
        /** RetentionPolicy */
        RetentionPolicy: {
            /** Legalhold */
            legalHold: boolean;
            /** Policyversion */
            policyVersion: number;
            /** Retentiondays */
            retentionDays: number;
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
        };
        /** RetentionPolicyEnvelope */
        RetentionPolicyEnvelope: {
            data: components["schemas"]["RetentionPolicy"];
            /**
             * Message
             * @default DWAI-ON retention policy loaded.
             */
            message: string;
            /**
             * Status
             * @default SUCCESS
             */
            status: string;
            /**
             * Success
             * @default true
             */
            success: boolean;
        };
        /**
         * RiskTier
         * @enum {string}
         */
        RiskTier: "L0" | "L1" | "L2" | "L3";
        /** SafetyPolicy */
        SafetyPolicy: {
            /** Maxsourcescopes */
            maxSourceScopes: number;
            /** Maxtoolcalls */
            maxToolCalls: number;
            mutationOutcome: components["schemas"]["PolicyOutcome"];
            /** Policyversion */
            policyVersion: number;
            privilegedDataOutcome: components["schemas"]["PolicyOutcome"];
            promptInjectionOutcome: components["schemas"]["PolicyOutcome"];
            /** Publicwebenabled */
            publicWebEnabled: boolean;
            /** Requirecitations */
            requireCitations: boolean;
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
        };
        /** SafetyPolicyEnvelope */
        SafetyPolicyEnvelope: {
            data: components["schemas"]["SafetyPolicy"];
            /**
             * Message
             * @default DWAI-ON safety policy loaded.
             */
            message: string;
            /**
             * Status
             * @default SUCCESS
             */
            status: string;
            /**
             * Success
             * @default true
             */
            success: boolean;
        };
        /**
         * SourceAccessMode
         * @enum {string}
         */
        SourceAccessMode: "SOURCE_PERMISSIONS" | "TENANT_ALLOWLIST" | "BLOCKED";
        /** UpdateActionPolicyRequest */
        UpdateActionPolicyRequest: {
            /** Changereason */
            changeReason: string;
            /**
             * Confirmationrequired
             * @default true
             */
            confirmationRequired: boolean;
            /** Enabled */
            enabled: boolean;
            executionPolicy: components["schemas"]["ActionExecutionPolicy"];
            /** Expectedversion */
            expectedVersion: number;
        };
        /** UpdateDataSourcePolicyRequest */
        UpdateDataSourcePolicyRequest: {
            accessMode: components["schemas"]["SourceAccessMode"];
            /** Changereason */
            changeReason: string;
            classification: components["schemas"]["DataClassification"];
            /** Connectorref */
            connectorRef?: string | null;
            /** Enabled */
            enabled: boolean;
            /** Expectedversion */
            expectedVersion: number;
        };
        /** UpdateEvaluationLifecycleRequest */
        UpdateEvaluationLifecycleRequest: {
            /** Changereason */
            changeReason: string;
            /** Expectedversion */
            expectedVersion: number;
            lifecycleState: components["schemas"]["EvaluationLifecycle"];
        };
        /** UpdateRetentionPolicyRequest */
        UpdateRetentionPolicyRequest: {
            /** Changereason */
            changeReason: string;
            /** Expectedversion */
            expectedVersion: number;
            /** Legalhold */
            legalHold?: boolean | null;
            /** Retentiondays */
            retentionDays?: number | null;
        };
        /** UpdateSafetyPolicyRequest */
        UpdateSafetyPolicyRequest: {
            /** Changereason */
            changeReason: string;
            /** Expectedversion */
            expectedVersion: number;
            /** Maxsourcescopes */
            maxSourceScopes: number;
            /** Maxtoolcalls */
            maxToolCalls: number;
            mutationOutcome: components["schemas"]["PolicyOutcome"];
            privilegedDataOutcome: components["schemas"]["PolicyOutcome"];
            /**
             * Requirecitations
             * @default true
             */
            requireCitations: boolean;
        };
        /** UserAgentRunListEnvelope */
        UserAgentRunListEnvelope: {
            /** Data */
            data: components["schemas"]["UserAgentRunSummary"][];
            /**
             * Message
             * @default Agent activity loaded.
             */
            message: string;
            /**
             * Status
             * @default SUCCESS
             */
            status: string;
            /**
             * Success
             * @default true
             */
            success: boolean;
        };
        /** UserAgentRunSummary */
        UserAgentRunSummary: {
            /** Agentkey */
            agentKey: string;
            /** Agentrevision */
            agentRevision: number;
            answerState?: components["schemas"]["AskState"] | null;
            /** Completedat */
            completedAt?: string | null;
            /** Conversationid */
            conversationId?: string | null;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /** Latencyms */
            latencyMs: number;
            policyOutcome: components["schemas"]["PolicyOutcome"];
            riskTier: components["schemas"]["RiskTier"];
            /**
             * Runid
             * Format: uuid
             */
            runId: string;
            runState: components["schemas"]["AgentRunState"];
            /** Sourcecount */
            sourceCount: number;
            /** Statuscode */
            statusCode?: string | null;
        };
        /** ValidateOperationalGateRequest */
        ValidateOperationalGateRequest: {
            /** Changereason */
            changeReason: string;
            /** Expectedversion */
            expectedVersion: number;
            outcome: components["schemas"]["GateValidationOutcome"];
            /** Validationsummary */
            validationSummary: string;
        };
        /** ValidationError */
        ValidationError: {
            /** Context */
            ctx?: Record<string, never>;
            /** Input */
            input?: unknown;
            /** Location */
            loc: (string | number)[];
            /** Message */
            msg: string;
            /** Error Type */
            type: string;
        };
        /** VoiceSpeechRequest */
        VoiceSpeechRequest: {
            /**
             * Locale
             * @default en
             */
            locale: string;
            /** Text */
            text: string;
        };
        /** VoiceTranscription */
        VoiceTranscription: {
            /** Language */
            language: string;
            /** Text */
            text: string;
        };
        /** VoiceTranscriptionEnvelope */
        VoiceTranscriptionEnvelope: {
            data: components["schemas"]["VoiceTranscription"];
            /**
             * Message
             * @default Voice transcription completed.
             */
            message: string;
            /**
             * Status
             * @default SUCCESS
             */
            status: string;
            /**
             * Success
             * @default true
             */
            success: boolean;
        };
        /** WorkplaceAction */
        WorkplaceAction: {
            /** Actionkey */
            actionKey: string;
            /**
             * Confirmationrequired
             * @default true
             */
            confirmationRequired: boolean;
            /** Description */
            description: string;
            /** Inputfields */
            inputFields?: string[];
            mode: components["schemas"]["WorkplaceActionMode"];
            /** Requiredpermission */
            requiredPermission: string;
            riskTier: components["schemas"]["RiskTier"];
            /** Targetroute */
            targetRoute: string;
            /** Title */
            title: string;
        };
        /** WorkplaceActionListEnvelope */
        WorkplaceActionListEnvelope: {
            /** Data */
            data: components["schemas"]["WorkplaceAction"][];
            /**
             * Message
             * @default Available actions loaded.
             */
            message: string;
            /**
             * Status
             * @default SUCCESS
             */
            status: string;
            /**
             * Success
             * @default true
             */
            success: boolean;
        };
        /**
         * WorkplaceActionMode
         * @enum {string}
         */
        WorkplaceActionMode: "REDIRECT" | "APPROVAL_HANDOFF";
        /** WorkplaceActionPreview */
        WorkplaceActionPreview: {
            action: components["schemas"]["WorkplaceAction"];
            plan: components["schemas"]["PlanPreviewResponse"];
            /** Reviewedinputs */
            reviewedInputs?: {
                [key: string]: components["schemas"]["JsonValue"];
            };
        };
        /** WorkplaceActionPreviewEnvelope */
        WorkplaceActionPreviewEnvelope: {
            data: components["schemas"]["WorkplaceActionPreview"];
            /**
             * Message
             * @default Action handoff preview prepared.
             */
            message: string;
            /**
             * Status
             * @default SUCCESS
             */
            status: string;
            /**
             * Success
             * @default true
             */
            success: boolean;
        };
        /** WorkplaceActionPreviewRequest */
        WorkplaceActionPreviewRequest: {
            /** Inputs */
            inputs?: {
                [key: string]: components["schemas"]["JsonValue"];
            };
            origin: components["schemas"]["ActionHandoffOrigin"];
            /** Requestid */
            requestId: string;
            /** Sourcereferences */
            sourceReferences?: string[];
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    health_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: string | {
                            [key: string]: string;
                        };
                    };
                };
            };
        };
    };
    livez_livez_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: string;
                    };
                };
            };
        };
    };
    readyz_readyz_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: string | {
                            [key: string]: string;
                        };
                    };
                };
            };
        };
    };
    list_actions_v1_actions_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WorkplaceActionListEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    preview_action_v1_actions__action_key__preview_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
            };
            path: {
                action_key: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WorkplaceActionPreviewRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WorkplaceActionPreviewEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_action_policies_v1_admin_actions_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActionPolicyListEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    bootstrap_action_policies_v1_admin_actions_bootstrap_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BootstrapGovernancePoliciesRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActionPolicyListEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_action_policy_v1_admin_actions__action_key__patch: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path: {
                action_key: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateActionPolicyRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActionPolicyEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_audit_events_v1_admin_audit_get: {
        parameters: {
            query?: {
                category?: string | null;
                query?: string | null;
                page?: number;
                size?: number;
            };
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GovernanceAuditEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    export_audit_events_v1_admin_audit_export_get: {
        parameters: {
            query?: {
                category?: string | null;
                query?: string | null;
            };
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_evaluation_sets_v1_admin_evaluations_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EvaluationSetListEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_evaluation_set_v1_admin_evaluations_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateEvaluationSetRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EvaluationSetEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_evaluation_set_v1_admin_evaluations__evaluation_set_id__get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path: {
                evaluation_set_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EvaluationSetEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    add_evaluation_case_v1_admin_evaluations__evaluation_set_id__cases_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path: {
                evaluation_set_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateEvaluationCaseRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EvaluationSetEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    transition_evaluation_set_v1_admin_evaluations__evaluation_set_id__lifecycle_patch: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path: {
                evaluation_set_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateEvaluationLifecycleRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EvaluationSetEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_evaluation_runs_v1_admin_evaluations__evaluation_set_id__runs_get: {
        parameters: {
            query?: {
                limit?: number;
            };
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path: {
                evaluation_set_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EvaluationRunListEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    execute_evaluation_v1_admin_evaluations__evaluation_set_id__runs_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path: {
                evaluation_set_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EvaluationRunEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_evaluation_run_v1_admin_evaluations__evaluation_set_id__runs__evaluation_run_id__get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path: {
                evaluation_set_id: string;
                evaluation_run_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EvaluationRunEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    export_evaluation_run_v1_admin_evaluations__evaluation_set_id__runs__evaluation_run_id__export_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path: {
                evaluation_set_id: string;
                evaluation_run_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_operational_gates_v1_admin_gates_get: {
        parameters: {
            query?: {
                environment?: components["schemas"]["GateEnvironment"];
            };
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGatePortfolioEnvelope"];
                };
            };
            /** @description Insufficient gate permission */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateProblem"];
                };
            };
            /** @description Gate not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateProblem"];
                };
            };
            /** @description Gate workflow conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateProblem"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Gate store unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateProblem"];
                };
            };
        };
    };
    bootstrap_operational_gates_v1_admin_gates_bootstrap_post: {
        parameters: {
            query?: {
                environment?: components["schemas"]["GateEnvironment"];
            };
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BootstrapOperationalGatesRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGatePortfolioEnvelope"];
                };
            };
            /** @description Insufficient gate permission */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateProblem"];
                };
            };
            /** @description Gate not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateProblem"];
                };
            };
            /** @description Gate workflow conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateProblem"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Gate store unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateProblem"];
                };
            };
        };
    };
    get_operational_gate_v1_admin_gates__gate_key__get: {
        parameters: {
            query?: {
                environment?: components["schemas"]["GateEnvironment"];
            };
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path: {
                gate_key: components["schemas"]["OperationalGateKey"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateDetailEnvelope"];
                };
            };
            /** @description Insufficient gate permission */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateProblem"];
                };
            };
            /** @description Gate not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateProblem"];
                };
            };
            /** @description Gate workflow conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateProblem"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Gate store unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateProblem"];
                };
            };
        };
    };
    configure_operational_gate_v1_admin_gates__gate_key__patch: {
        parameters: {
            query?: {
                environment?: components["schemas"]["GateEnvironment"];
            };
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path: {
                gate_key: components["schemas"]["OperationalGateKey"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ConfigureOperationalGateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateDetailEnvelope"];
                };
            };
            /** @description Insufficient gate permission */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateProblem"];
                };
            };
            /** @description Gate not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateProblem"];
                };
            };
            /** @description Gate workflow conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateProblem"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Gate store unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateProblem"];
                };
            };
        };
    };
    decide_operational_gate_v1_admin_gates__gate_key__decision_post: {
        parameters: {
            query?: {
                environment?: components["schemas"]["GateEnvironment"];
            };
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path: {
                gate_key: components["schemas"]["OperationalGateKey"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DecideOperationalGateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateDetailEnvelope"];
                };
            };
            /** @description Insufficient gate permission */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateProblem"];
                };
            };
            /** @description Gate not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateProblem"];
                };
            };
            /** @description Gate workflow conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateProblem"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Gate store unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateProblem"];
                };
            };
        };
    };
    add_operational_gate_evidence_v1_admin_gates__gate_key__evidence_post: {
        parameters: {
            query?: {
                environment?: components["schemas"]["GateEnvironment"];
            };
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path: {
                gate_key: components["schemas"]["OperationalGateKey"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateOperationalGateEvidenceRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateDetailEnvelope"];
                };
            };
            /** @description Insufficient gate permission */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateProblem"];
                };
            };
            /** @description Gate not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateProblem"];
                };
            };
            /** @description Gate workflow conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateProblem"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Gate store unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateProblem"];
                };
            };
        };
    };
    validate_operational_gate_v1_admin_gates__gate_key__validation_post: {
        parameters: {
            query?: {
                environment?: components["schemas"]["GateEnvironment"];
            };
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path: {
                gate_key: components["schemas"]["OperationalGateKey"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ValidateOperationalGateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateDetailEnvelope"];
                };
            };
            /** @description Insufficient gate permission */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateProblem"];
                };
            };
            /** @description Gate not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateProblem"];
                };
            };
            /** @description Gate workflow conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateProblem"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Gate store unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationalGateProblem"];
                };
            };
        };
    };
    operations_overview_v1_admin_overview_get: {
        parameters: {
            query?: {
                period_days?: number;
            };
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DwaionOperationsOverviewEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_proposal_v1_admin_proposals_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Identity-Plane"?: string | null;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateAgentProposalRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AgentProposalEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_retention_policy_v1_admin_retention_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RetentionPolicyEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_retention_policy_v1_admin_retention_patch: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateRetentionPolicyRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RetentionPolicyEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    bootstrap_retention_policy_v1_admin_retention_bootstrap_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BootstrapRetentionPolicyRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RetentionPolicyEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_safety_policy_v1_admin_safety_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SafetyPolicyEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_safety_policy_v1_admin_safety_patch: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateSafetyPolicyRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SafetyPolicyEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    bootstrap_safety_policy_v1_admin_safety_bootstrap_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BootstrapGovernancePoliciesRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SafetyPolicyEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_source_policies_v1_admin_sources_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DataSourcePolicyListEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    bootstrap_source_policies_v1_admin_sources_bootstrap_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BootstrapGovernancePoliciesRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DataSourcePolicyListEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_source_policy_v1_admin_sources__source_key__patch: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path: {
                source_key: components["schemas"]["CitationSourceType"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateDataSourcePolicyRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DataSourcePolicyEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    ask_v1_ask_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Permissions"?: string | null;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AskRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AskEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    ask_stream_v1_ask_stream_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Permissions"?: string | null;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AskRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_conversations_v1_conversations_get: {
        parameters: {
            query?: {
                limit?: number;
            };
            header: {
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConversationListEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_conversation_v1_conversations__conversation_id__get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path: {
                conversation_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConversationEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_conversation_v1_conversations__conversation_id__delete: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path: {
                conversation_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    rename_conversation_v1_conversations__conversation_id__patch: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path: {
                conversation_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RenameConversationRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConversationEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    preview_plan_v1_plans_preview_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Resource-Roles"?: string | null;
                "X-DWP-Identity-Plane"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PlanPreviewRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlanPreviewEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_proposals_v1_proposals_get: {
        parameters: {
            query?: {
                view?: components["schemas"]["ProposalInboxView"];
                limit?: number;
                cursor?: string | null;
            };
            header: {
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Identity-Plane"?: string | null;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProposalInboxEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    decide_proposal_v1_proposals__proposal_id__decisions_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Identity-Plane"?: string | null;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path: {
                proposal_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DecideAgentProposalRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProposalDecisionEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_question_launch_v1_question_launches_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Identity-Plane"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateQuestionLaunchRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["QuestionLaunchReceiptEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    consume_question_launch_v1_question_launches_consume_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Identity-Plane"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ConsumeQuestionLaunchRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["QuestionLaunchPayloadEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_user_runs_v1_runs_get: {
        parameters: {
            query?: {
                limit?: number;
                state?: components["schemas"]["AgentRunState"] | null;
            };
            header: {
                "X-DWP-Permissions"?: string | null;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserAgentRunListEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    record_feedback_v1_runs__run_id__feedback_put: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-DWP-Permissions"?: string | null;
            };
            path: {
                run_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AnswerFeedbackRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FeedbackEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    synthesize_voice_v1_voice_speech_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Permissions"?: string | null;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VoiceSpeechRequest"];
            };
        };
        responses: {
            /** @description Synthesized speech. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "audio/mpeg": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    transcribe_voice_v1_voice_transcriptions_post: {
        parameters: {
            query?: never;
            header: {
                "Content-Type": string;
                "X-DWP-Voice-Locale": string;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/octet-stream": string;
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VoiceTranscriptionEnvelope"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
}
