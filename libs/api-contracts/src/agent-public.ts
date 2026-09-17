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
    "/v1/activity/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Activity Events */
        get: operations["list_activity_events_v1_activity_events_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/activity/events/{event_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Activity Event Detail */
        get: operations["activity_event_detail_v1_activity_events__event_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/activity/executions/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Activity Execution Summary */
        get: operations["activity_execution_summary_v1_activity_executions_summary_get"];
        put?: never;
        post?: never;
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
    "/v1/admin/ai-control": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Ai Control Overview */
        get: operations["get_ai_control_overview_v1_admin_ai_control_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/ai-control/bootstrap": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Bootstrap Ai Control */
        post: operations["bootstrap_ai_control_v1_admin_ai_control_bootstrap_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/ai-control/emergency": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Set Ai Emergency Control */
        post: operations["set_ai_emergency_control_v1_admin_ai_control_emergency_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/ai-control/policy": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update Ai Control Policy */
        put: operations["update_ai_control_policy_v1_admin_ai_control_policy_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
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
    "/v1/admin/control-plane/commands": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Commands */
        get: operations["list_commands_v1_admin_control_plane_commands_get"];
        put?: never;
        /** Create Command */
        post: operations["create_command_v1_admin_control_plane_commands_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/control-plane/commands/{command_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Command */
        get: operations["get_command_v1_admin_control_plane_commands__command_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/control-plane/commands/{command_id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cancel Command */
        post: operations["cancel_command_v1_admin_control_plane_commands__command_id__cancel_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/control-plane/commands/{command_id}/decision": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Decide Command */
        post: operations["decide_command_v1_admin_control_plane_commands__command_id__decision_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/control-plane/commands/{command_id}/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Retry Command */
        post: operations["retry_command_v1_admin_control_plane_commands__command_id__retry_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/control-plane/commands/{command_id}/rollback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Rollback Command */
        post: operations["rollback_command_v1_admin_control_plane_commands__command_id__rollback_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/control-plane/connectors": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Connectors */
        get: operations["connectors_v1_admin_control_plane_connectors_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/control-plane/evaluation-safety": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Evaluation Safety */
        get: operations["evaluation_safety_v1_admin_control_plane_evaluation_safety_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/control-plane/incidents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Incidents */
        get: operations["incidents_v1_admin_control_plane_incidents_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/control-plane/models-routing": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Models Routing */
        get: operations["models_routing_v1_admin_control_plane_models_routing_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/control-plane/outcomes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Outcomes */
        get: operations["outcomes_v1_admin_control_plane_outcomes_get"];
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
    "/v1/admin/personal-data/retention/{domain}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Upsert Retention Policy */
        put: operations["upsert_retention_policy_v1_admin_personal_data_retention__domain__put"];
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
    "/v1/ai-controls": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Personal Ai Controls */
        get: operations["get_personal_ai_controls_v1_ai_controls_get"];
        /** Update Personal Ai Controls */
        put: operations["update_personal_ai_controls_v1_ai_controls_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/ai-controls/memories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Personal Memories */
        get: operations["list_personal_memories_v1_ai_controls_memories_get"];
        put?: never;
        /** Create Personal Memory */
        post: operations["create_personal_memory_v1_ai_controls_memories_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/ai-controls/memories/{memory_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update Personal Memory */
        put: operations["update_personal_memory_v1_ai_controls_memories__memory_id__put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/ai-controls/memories/{memory_id}/delete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Delete Personal Memory */
        post: operations["delete_personal_memory_v1_ai_controls_memories__memory_id__delete_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/ai-controls/memories/{memory_id}/state": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Change Personal Memory State */
        post: operations["change_personal_memory_state_v1_ai_controls_memories__memory_id__state_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/ai-controls/runtime": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update Personal Ai Runtime Controls */
        put: operations["update_personal_ai_runtime_controls_v1_ai_controls_runtime_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/ai-controls/sources/{source_key}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update Ai Source Preference */
        put: operations["update_ai_source_preference_v1_ai_controls_sources__source_key__put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/artifact-collaboration/capabilities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Artifact Collaboration Capabilities */
        get: operations["get_artifact_collaboration_capabilities_v1_artifact_collaboration_capabilities_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/artifact-collaboration/{artifact_id}/access-requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Request Team Artifact Access */
        post: operations["request_team_artifact_access_v1_artifact_collaboration__artifact_id__access_requests_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/artifact-collaboration/{artifact_id}/preflights": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Run Team Artifact Preflight */
        post: operations["run_team_artifact_preflight_v1_artifact_collaboration__artifact_id__preflights_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/artifact-collaboration/{artifact_id}/workspace": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Team Artifact Workspace */
        get: operations["get_team_artifact_workspace_v1_artifact_collaboration__artifact_id__workspace_get"];
        put?: never;
        /** Create Team Artifact Workspace */
        post: operations["create_team_artifact_workspace_v1_artifact_collaboration__artifact_id__workspace_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/artifact-collaboration/{artifact_id}/workspace/comments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Team Artifact Comments */
        get: operations["list_team_artifact_comments_v1_artifact_collaboration__artifact_id__workspace_comments_get"];
        put?: never;
        /** Create Team Artifact Comment */
        post: operations["create_team_artifact_comment_v1_artifact_collaboration__artifact_id__workspace_comments_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/artifact-collaboration/{artifact_id}/workspace/comments/{comment_id}/replies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Reply Team Artifact Comment */
        post: operations["reply_team_artifact_comment_v1_artifact_collaboration__artifact_id__workspace_comments__comment_id__replies_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/artifact-collaboration/{artifact_id}/workspace/comments/{comment_id}/resolve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Resolve Team Artifact Comment */
        post: operations["resolve_team_artifact_comment_v1_artifact_collaboration__artifact_id__workspace_comments__comment_id__resolve_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/artifact-collaboration/{artifact_id}/workspace/conflicts/{conflict_id}/resolve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Resolve Team Artifact Conflict */
        post: operations["resolve_team_artifact_conflict_v1_artifact_collaboration__artifact_id__workspace_conflicts__conflict_id__resolve_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/artifact-collaboration/{artifact_id}/workspace/edits": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Submit Team Artifact Edit */
        post: operations["submit_team_artifact_edit_v1_artifact_collaboration__artifact_id__workspace_edits_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/artifact-collaboration/{artifact_id}/workspace/members": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update Team Artifact Members */
        put: operations["update_team_artifact_members_v1_artifact_collaboration__artifact_id__workspace_members_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/artifact-collaboration/{artifact_id}/workspace/review-stages/{stage_id}/decision": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Decide Team Artifact Review Stage */
        post: operations["decide_team_artifact_review_stage_v1_artifact_collaboration__artifact_id__workspace_review_stages__stage_id__decision_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/artifact-collaboration/{artifact_id}/workspace/shares": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create Team Artifact Share */
        post: operations["create_team_artifact_share_v1_artifact_collaboration__artifact_id__workspace_shares_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/artifact-collaboration/{artifact_id}/workspace/shares/{share_id}/revoke": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Revoke Team Artifact Share */
        post: operations["revoke_team_artifact_share_v1_artifact_collaboration__artifact_id__workspace_shares__share_id__revoke_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/artifacts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Artifacts */
        get: operations["list_artifacts_v1_artifacts_get"];
        put?: never;
        /** Create Artifact */
        post: operations["create_artifact_v1_artifacts_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/artifacts/capabilities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Artifact Capabilities */
        get: operations["get_artifact_capabilities_v1_artifacts_capabilities_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/artifacts/{artifact_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Artifact */
        get: operations["get_artifact_v1_artifacts__artifact_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/artifacts/{artifact_id}/draft": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Autosave Artifact */
        put: operations["autosave_artifact_v1_artifacts__artifact_id__draft_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/artifacts/{artifact_id}/exports": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Export Artifact */
        post: operations["export_artifact_v1_artifacts__artifact_id__exports_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/artifacts/{artifact_id}/exports/{export_job_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Artifact Export */
        get: operations["get_artifact_export_v1_artifacts__artifact_id__exports__export_job_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/artifacts/{artifact_id}/exports/{export_job_id}/download": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Download Artifact Export */
        get: operations["download_artifact_export_v1_artifacts__artifact_id__exports__export_job_id__download_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/artifacts/{artifact_id}/preflights": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Run Artifact Preflight */
        post: operations["run_artifact_preflight_v1_artifacts__artifact_id__preflights_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/artifacts/{artifact_id}/preflights/current": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Current Artifact Preflight */
        get: operations["get_current_artifact_preflight_v1_artifacts__artifact_id__preflights_current_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/artifacts/{artifact_id}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Publish Artifact */
        post: operations["publish_artifact_v1_artifacts__artifact_id__publish_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/artifacts/{artifact_id}/versions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Artifact Versions */
        get: operations["list_artifact_versions_v1_artifacts__artifact_id__versions_get"];
        put?: never;
        /** Create Artifact Version */
        post: operations["create_artifact_version_v1_artifacts__artifact_id__versions_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/artifacts/{artifact_id}/versions/{version_number}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Artifact Version */
        get: operations["get_artifact_version_v1_artifacts__artifact_id__versions__version_number__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
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
    "/v1/attachments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Attachments */
        get: operations["list_attachments_v1_attachments_get"];
        put?: never;
        /** Create Attachment */
        post: operations["create_attachment_v1_attachments_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/attachments/capabilities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Attachment Capabilities */
        get: operations["attachment_capabilities_v1_attachments_capabilities_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/attachments/{attachment_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Attachment */
        get: operations["get_attachment_v1_attachments__attachment_id__get"];
        put?: never;
        post?: never;
        /** Delete Attachment */
        delete: operations["delete_attachment_v1_attachments__attachment_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/attachments/{attachment_id}/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Complete Attachment */
        post: operations["complete_attachment_v1_attachments__attachment_id__complete_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/attachments/{attachment_id}/evidence": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Attachment Evidence */
        get: operations["get_attachment_evidence_v1_attachments__attachment_id__evidence_get"];
        put?: never;
        post?: never;
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
    "/v1/navigation/activity": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Activity Page */
        get: operations["activity_page_v1_navigation_activity_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/navigation/agents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Agents Page */
        get: operations["agents_page_v1_navigation_agents_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/navigation/conversations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Conversations Page */
        get: operations["conversations_page_v1_navigation_conversations_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/navigation/conversations/{conversation_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Conversation Page */
        get: operations["conversation_page_v1_navigation_conversations__conversation_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/navigation/new": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** New Page */
        get: operations["new_page_v1_navigation_new_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/personal-data/capabilities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Personal Data Governance Capabilities */
        get: operations["get_personal_data_governance_capabilities_v1_personal_data_capabilities_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/personal-data/deletions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Personal Data Deletions */
        get: operations["list_personal_data_deletions_v1_personal_data_deletions_get"];
        put?: never;
        /** Request Personal Data Deletion */
        post: operations["request_personal_data_deletion_v1_personal_data_deletions_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/personal-data/deletions/{deletion_job_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Personal Data Deletion */
        get: operations["get_personal_data_deletion_v1_personal_data_deletions__deletion_job_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/personal-data/deletions/{deletion_job_id}/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Retry Personal Data Deletion */
        post: operations["retry_personal_data_deletion_v1_personal_data_deletions__deletion_job_id__retry_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/personal-data/retention": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Retention Policies */
        get: operations["list_retention_policies_v1_personal_data_retention_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
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
    "/v1/proposal-handoffs/{handoff_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Handoff */
        get: operations["get_handoff_v1_proposal_handoffs__handoff_id__get"];
        put?: never;
        post?: never;
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
    "/v1/proposals/analyze": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Analyze Proposals */
        post: operations["analyze_proposals_v1_proposals_analyze_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/proposals/clear": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Clear Proposal Inbox */
        post: operations["clear_proposal_inbox_v1_proposals_clear_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/proposals/preferences": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Proposal Preferences */
        get: operations["get_proposal_preferences_v1_proposals_preferences_get"];
        /** Update Proposal Preferences */
        put: operations["update_proposal_preferences_v1_proposals_preferences_put"];
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
    "/v1/proposals/{proposal_id}/handoff": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Proposal Handoff */
        get: operations["get_proposal_handoff_v1_proposals__proposal_id__handoff_get"];
        put?: never;
        /** Create Proposal Handoff */
        post: operations["create_proposal_handoff_v1_proposals__proposal_id__handoff_post"];
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
    "/v1/research/capabilities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Research Capabilities */
        get: operations["research_capabilities_v1_research_capabilities_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/research/plans": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create Research Plan */
        post: operations["create_research_plan_v1_research_plans_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/research/plans/{plan_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Research Plan */
        get: operations["get_research_plan_v1_research_plans__plan_id__get"];
        /** Update Research Plan */
        put: operations["update_research_plan_v1_research_plans__plan_id__put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/research/plans/{plan_id}/runs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Start Research Run */
        post: operations["start_research_run_v1_research_plans__plan_id__runs_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/research/runs/{run_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Research Run */
        get: operations["get_research_run_v1_research_runs__run_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/research/runs/{run_id}/artifact": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create Research Artifact */
        post: operations["create_research_artifact_v1_research_runs__run_id__artifact_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/research/runs/{run_id}/commands": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Command Research Run */
        post: operations["command_research_run_v1_research_runs__run_id__commands_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/research/runs/{run_id}/deliveries": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Research Deliveries */
        get: operations["list_research_deliveries_v1_research_runs__run_id__deliveries_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/research/runs/{run_id}/deliveries/{delivery_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Research Delivery */
        get: operations["get_research_delivery_v1_research_runs__run_id__deliveries__delivery_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/research/runs/{run_id}/downloads/audit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Download Research Audit */
        get: operations["download_research_audit_v1_research_runs__run_id__downloads_audit_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/research/runs/{run_id}/downloads/raw": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Download Research Raw */
        get: operations["download_research_raw_v1_research_runs__run_id__downloads_raw_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/research/runs/{run_id}/downloads/receipt": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Download Research Receipt */
        get: operations["download_research_receipt_v1_research_runs__run_id__downloads_receipt_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/research/runs/{run_id}/execute": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Execute Research Run */
        post: operations["execute_research_run_v1_research_runs__run_id__execute_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/research/runs/{run_id}/exports": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create Research Export */
        post: operations["create_research_export_v1_research_runs__run_id__exports_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/research/runs/{run_id}/handoffs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create Research Handoff */
        post: operations["create_research_handoff_v1_research_runs__run_id__handoffs_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/research/runs/{run_id}/proposal": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create Research Proposal */
        post: operations["create_research_proposal_v1_research_runs__run_id__proposal_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/research/runs/{run_id}/routines": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create Research Routine */
        post: operations["create_research_routine_v1_research_runs__run_id__routines_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/research/runs/{run_id}/shares": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create Research Share */
        post: operations["create_research_share_v1_research_runs__run_id__shares_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/routines": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Routines */
        get: operations["list_routines_v1_routines_get"];
        put?: never;
        /** Create Routine */
        post: operations["create_routine_v1_routines_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/routines/capabilities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Routine Capabilities */
        get: operations["get_routine_capabilities_v1_routines_capabilities_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/routines/{routine_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Routine */
        get: operations["get_routine_v1_routines__routine_id__get"];
        /** Update Routine */
        put: operations["update_routine_v1_routines__routine_id__put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/routines/{routine_id}/activation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Change Routine Activation */
        post: operations["change_routine_activation_v1_routines__routine_id__activation_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/routines/{routine_id}/archive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Archive Routine */
        post: operations["archive_routine_v1_routines__routine_id__archive_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/routines/{routine_id}/consent": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Change Routine Consent */
        post: operations["change_routine_consent_v1_routines__routine_id__consent_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/routines/{routine_id}/dry-runs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Dry Run Routine */
        post: operations["dry_run_routine_v1_routines__routine_id__dry_runs_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/routines/{routine_id}/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Routine Health */
        get: operations["get_routine_health_v1_routines__routine_id__health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/routines/{routine_id}/lifecycle": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Change Routine Lifecycle */
        post: operations["change_routine_lifecycle_v1_routines__routine_id__lifecycle_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/routines/{routine_id}/runs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Routine Runs */
        get: operations["list_routine_runs_v1_routines__routine_id__runs_get"];
        put?: never;
        /** Trigger Routine Run */
        post: operations["trigger_routine_run_v1_routines__routine_id__runs_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/routines/{routine_id}/runs/{routine_run_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Routine Run */
        get: operations["get_routine_run_v1_routines__routine_id__runs__routine_run_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/routines/{routine_id}/runs/{routine_run_id}/commands": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Command Routine Run */
        post: operations["command_routine_run_v1_routines__routine_id__runs__routine_run_id__commands_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/routines/{routine_id}/telemetry/download": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Download Routine Telemetry */
        get: operations["download_routine_telemetry_v1_routines__routine_id__telemetry_download_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/routines/{routine_id}/versions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Routine Versions */
        get: operations["list_routine_versions_v1_routines__routine_id__versions_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/routines/{routine_id}/versions/{revision}/rollback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Rollback Routine Version */
        post: operations["rollback_routine_version_v1_routines__routine_id__versions__revision__rollback_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/routines/{routine_id}/webhook-events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Trigger Routine Webhook */
        post: operations["trigger_routine_webhook_v1_routines__routine_id__webhook_events_post"];
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
    "/v1/runs/{run_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get User Run */
        get: operations["get_user_run_v1_runs__run_id__get"];
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
        /** AIControlOverview */
        AIControlOverview: {
            /**
             * Controlscope
             * @default ASK_RUNTIME
             * @constant
             */
            controlScope: "ASK_RUNTIME";
            enforcementActivationState: components["schemas"]["EnforcementActivationState"];
            policy?: components["schemas"]["TenantAIExecutionPolicy"] | null;
            runtimeControlState: components["schemas"]["RuntimeControlState"];
            /** @default NOT_CONNECTED */
            toolEnforcementState: components["schemas"]["ToolEnforcementState"];
            usage: components["schemas"]["AIUsageObservation"];
            /** Warnings */
            warnings?: string[];
        };
        /** AIControlOverviewEnvelope */
        AIControlOverviewEnvelope: {
            data: components["schemas"]["AIControlOverview"];
            /**
             * Message
             * @default DWAI-ON AI runtime control loaded.
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
        /** AIUsageObservation */
        AIUsageObservation: {
            /** Billedcostminor */
            billedCostMinor?: number | null;
            /** Currency */
            currency?: string | null;
            /** Estimatedcostminor */
            estimatedCostMinor?: number | null;
            /** Measuredinputtokens */
            measuredInputTokens: number;
            /** Measuredoutputtokens */
            measuredOutputTokens: number;
            /** Measuredtotaltokens */
            measuredTotalTokens: number;
            measurementFreshness: components["schemas"]["MeasurementFreshness"];
            /** Measurementobservedat */
            measurementObservedAt?: string | null;
            /**
             * Periodend
             * Format: date-time
             */
            periodEnd: string;
            /**
             * Periodstart
             * Format: date-time
             */
            periodStart: string;
            /** @default UNAVAILABLE */
            providerBillingState: components["schemas"]["ExternalDataState"];
            /** @default UNAVAILABLE */
            providerPricingState: components["schemas"]["ExternalDataState"];
            /** @default UNAVAILABLE */
            providerUsageState: components["schemas"]["ExternalDataState"];
            /** Reservedtokens */
            reservedTokens: number;
            /**
             * Unmeasuredreservedtokens
             * @default 0
             */
            unmeasuredReservedTokens: number;
        };
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
        /** ActivityCoverage */
        ActivityCoverage: {
            /** Excludedprovenance */
            excludedProvenance?: string[];
            /**
             * Includeslegacy
             * @default false
             */
            includesLegacy: boolean;
            /**
             * Includesusage
             * @default false
             */
            includesUsage: boolean;
            /**
             * Semantics
             * @default CURRENT_EXECUTION_SNAPSHOTS
             */
            semantics: string;
            /**
             * Sourcescope
             * @default DWAI_ON
             */
            sourceScope: string;
            /** Supportedobjecttypes */
            supportedObjectTypes?: string[];
        };
        /** ActivityEvent */
        ActivityEvent: {
            /**
             * Actor
             * @default AGENT
             */
            actor: string;
            /**
             * Actorname
             * @default DWAI·ON
             */
            actorName: string;
            /** Attempt */
            attempt: number;
            /**
             * Auditaccess
             * @default RESTRICTED
             */
            auditAccess: string;
            /** Auditid */
            auditId?: string | null;
            /** Auditrecordid */
            auditRecordId?: string | null;
            /**
             * Auditstatus
             * @default NOT_LINKED
             */
            auditStatus: string;
            /** Correlationid */
            correlationId?: string | null;
            /** @default LIVE */
            dataProvenance: components["schemas"]["RunDataProvenance"];
            /**
             * Eventkind
             * @default EXECUTION_SNAPSHOT
             */
            eventKind: string;
            /** Executionid */
            executionId: string;
            /** Executionversion */
            executionVersion: number;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Objectid */
            objectId: string;
            /** Objectlabel */
            objectLabel: string;
            /**
             * Objecttype
             * @default AGENT_RUN
             */
            objectType: string;
            /**
             * Occurredat
             * Format: date-time
             */
            occurredAt: string;
            /** Progress */
            progress?: number | null;
            /** Resumecursor */
            resumeCursor?: string | null;
            /**
             * Source
             * @default DWAI_ON
             */
            source: string;
            /**
             * Sourceaccess
             * @default AVAILABLE
             */
            sourceAccess: string;
            /** Sourceeventid */
            sourceEventId: string;
            /**
             * Sourceobservedat
             * Format: date-time
             */
            sourceObservedAt: string;
            /** Sourceroute */
            sourceRoute: string;
            /** State */
            state: string;
            /** Summary */
            summary: string;
            /** Title */
            title: string;
            /** Tool */
            tool?: string | null;
            /** Updatedat */
            updatedAt?: string | null;
            /** Workstatus */
            workStatus?: string | null;
        };
        /** ActivityEventEnvelope */
        ActivityEventEnvelope: {
            data: components["schemas"]["ActivityEvent"];
            /**
             * Message
             * @default Current Agent execution snapshot loaded.
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
        /** ActivityPage */
        ActivityPage: {
            coverage?: components["schemas"]["ActivityCoverage"];
            /** Events */
            events: components["schemas"]["ActivityEvent"][];
            /**
             * Generatedat
             * Format: date-time
             */
            generatedAt: string;
            /** Hasmore */
            hasMore: boolean;
            /** Nextcursor */
            nextCursor?: string | null;
            /**
             * Snapshotat
             * Format: date-time
             */
            snapshotAt: string;
            /** Startcursor */
            startCursor: string;
        };
        /** ActivityPageEnvelope */
        ActivityPageEnvelope: {
            data: components["schemas"]["ActivityPage"];
            /**
             * Message
             * @default Current Agent execution snapshots loaded.
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
         * AiSourceKey
         * @enum {string}
         */
        AiSourceKey: "WORK_ITEM" | "MAIL" | "CALENDAR";
        /** AiSourcePreference */
        AiSourcePreference: {
            /** Available */
            available: boolean;
            /**
             * Effectscope
             * @default PERSONAL_ROUTINE_DRY_RUN_ONLY
             */
            effectScope: string;
            /** Effective */
            effective: boolean;
            /** Enabled */
            enabled: boolean;
            /**
             * Proactiveanalysisintegrationavailable
             * @default false
             */
            proactiveAnalysisIntegrationAvailable: boolean;
            /**
             * Retention
             * @default REFERENCE_ONLY_NO_RAW_COPY
             */
            retention: string;
            /** Revision */
            revision: number;
            sourceKey: components["schemas"]["AiSourceKey"];
            /** Updatedat */
            updatedAt?: string | null;
        };
        /** AiSourcePreferenceEnvelope */
        AiSourcePreferenceEnvelope: {
            data: components["schemas"]["AiSourcePreference"];
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
        /** AnalyzeProposalsRequest */
        AnalyzeProposalsRequest: {
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
        };
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
        /** ArchiveRoutineRequest */
        ArchiveRoutineRequest: {
            /** Changereason */
            changeReason: string;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedrevision */
            expectedRevision: number;
            /** Reasoncode */
            reasonCode: string;
        };
        /** ArtifactCapabilities */
        ArtifactCapabilities: {
            /**
             * Collaborativeeditingavailable
             * @default false
             */
            collaborativeEditingAvailable: boolean;
            /**
             * Deterministicpreflightavailable
             * @default true
             */
            deterministicPreflightAvailable: boolean;
            /**
             * Enterprisedlpconnectoravailable
             * @default false
             */
            enterpriseDlpConnectorAvailable: boolean;
            /**
             * Exportexecutionavailable
             * @default false
             */
            exportExecutionAvailable: boolean;
            /**
             * Exportrequestavailable
             * @default true
             */
            exportRequestAvailable: boolean;
            /**
             * Exportstoragescope
             * @default POSTGRES_ENCRYPTED
             */
            exportStorageScope: string;
            /**
             * Externalsharingavailable
             * @default false
             */
            externalSharingAvailable: boolean;
            /**
             * Immutableversionsavailable
             * @default true
             */
            immutableVersionsAvailable: boolean;
            /**
             * Manualsourceverificationavailable
             * @default false
             */
            manualSourceVerificationAvailable: boolean;
            /**
             * Personalpublishstateavailable
             * @default true
             */
            personalPublishStateAvailable: boolean;
            /**
             * Recipientsharingavailable
             * @default false
             */
            recipientSharingAvailable: boolean;
            /**
             * Sourcefreshnessavailable
             * @default false
             */
            sourceFreshnessAvailable: boolean;
            /**
             * Sourceverificationavailable
             * @default false
             */
            sourceVerificationAvailable: boolean;
            /**
             * Sourceverificationscope
             * @default UNAVAILABLE
             */
            sourceVerificationScope: string;
            /** Supportedexportformats */
            supportedExportFormats?: components["schemas"]["ExportFormat"][];
            /**
             * Versionrestoreavailable
             * @default false
             */
            versionRestoreAvailable: boolean;
        };
        /** ArtifactCapabilitiesEnvelope */
        ArtifactCapabilitiesEnvelope: {
            data: components["schemas"]["ArtifactCapabilities"];
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
        /** ArtifactConversationSource */
        ArtifactConversationSource: {
            /**
             * Assistantmessageid
             * Format: uuid
             */
            assistantMessageId: string;
            /**
             * Conversationid
             * Format: uuid
             */
            conversationId: string;
        };
        /** ArtifactDraftContent */
        ArtifactDraftContent: {
            /** Body */
            body: string;
            /**
             * Format
             * @default MARKDOWN
             */
            format: string;
            /** Title */
            title: string;
        };
        /** ArtifactEnvelope */
        ArtifactEnvelope: {
            data: components["schemas"]["GovernedArtifact"];
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
        /** ArtifactExportEnvelope */
        ArtifactExportEnvelope: {
            data: components["schemas"]["ArtifactExportReceipt"];
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
        /** ArtifactExportReceipt */
        ArtifactExportReceipt: {
            /**
             * Artifactid
             * Format: uuid
             */
            artifactId: string;
            /** Artifactrevision */
            artifactRevision: number;
            /** Bytesize */
            byteSize?: number | null;
            /** Completedat */
            completedAt?: string | null;
            /** Contentfingerprint */
            contentFingerprint?: string | null;
            /**
             * Executionavailable
             * @default false
             */
            executionAvailable: boolean;
            exportFormat: components["schemas"]["ExportFormat"];
            /**
             * Exportjobid
             * Format: uuid
             */
            exportJobId: string;
            /**
             * Externalwriteperformed
             * @default false
             */
            externalWritePerformed: boolean;
            /**
             * Fileavailable
             * @default false
             */
            fileAvailable: boolean;
            /** Filename */
            fileName?: string | null;
            /** Mediatype */
            mediaType?: string | null;
            /** Requestedat */
            requestedAt?: string | null;
            /** Safeerrorcode */
            safeErrorCode?: string | null;
            /** @default PENDING */
            state: components["schemas"]["ArtifactExportState"];
            /** Versionnumber */
            versionNumber: number;
        };
        /**
         * ArtifactExportState
         * @enum {string}
         */
        ArtifactExportState: "PENDING" | "CLAIMED" | "SUCCEEDED" | "PARTIAL" | "FAILED" | "CANCELLED";
        /** ArtifactListEnvelope */
        ArtifactListEnvelope: {
            /** Data */
            data: components["schemas"]["GovernedArtifact"][];
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
        /** ArtifactMetadata */
        ArtifactMetadata: {
            /** Projectkey */
            projectKey?: string | null;
            /** Reviewsladueat */
            reviewSlaDueAt?: string | null;
            /** Tags */
            tags?: string[];
        };
        /** ArtifactPreflightEnvelope */
        ArtifactPreflightEnvelope: {
            data: components["schemas"]["ArtifactPreflightReceipt"];
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
        /** ArtifactPreflightReceipt */
        ArtifactPreflightReceipt: {
            /**
             * Artifactid
             * Format: uuid
             */
            artifactId: string;
            /** Artifactrevision */
            artifactRevision: number;
            /**
             * Current
             * @default true
             */
            current: boolean;
            /**
             * Evaluatedat
             * Format: date-time
             */
            evaluatedAt: string;
            /**
             * Expiresat
             * Format: date-time
             */
            expiresAt: string;
            /** Exportallowed */
            exportAllowed: boolean;
            /** Findings */
            findings: components["schemas"]["DlpFinding"][];
            outcome: components["schemas"]["DlpOutcome"];
            /**
             * Policykey
             * @default DWP_DETERMINISTIC_DLP_V1
             */
            policyKey: string;
            /**
             * Policyversion
             * @default 1
             */
            policyVersion: number;
            /**
             * Preflightid
             * Format: uuid
             */
            preflightId: string;
            /** Publishallowed */
            publishAllowed: boolean;
            /** Versionnumber */
            versionNumber: number;
        };
        /** ArtifactPublicationEnvelope */
        ArtifactPublicationEnvelope: {
            data: components["schemas"]["ArtifactPublicationReceipt"];
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
        /** ArtifactPublicationReceipt */
        ArtifactPublicationReceipt: {
            /**
             * Artifactid
             * Format: uuid
             */
            artifactId: string;
            /** Artifactrevision */
            artifactRevision: number;
            /**
             * Externalwriteperformed
             * @default false
             */
            externalWritePerformed: boolean;
            /**
             * Publicationscope
             * @default PERSONAL_WORKSPACE_STATE_ONLY
             */
            publicationScope: string;
            /** Publishedversionnumber */
            publishedVersionNumber: number;
            /**
             * Recipientsharingperformed
             * @default false
             */
            recipientSharingPerformed: boolean;
            /** @default PUBLISHED */
            state: components["schemas"]["ArtifactState"];
        };
        /** ArtifactSourceEvidence */
        ArtifactSourceEvidence: {
            /**
             * Freshness
             * @default UNKNOWN
             */
            freshness: string;
            source: components["schemas"]["ArtifactSourceReference"];
            /** Verificationevidencefingerprint */
            verificationEvidenceFingerprint?: string | null;
            /**
             * Verificationstate
             * @default UNVERIFIED
             */
            verificationState: string;
            /** Verifiedat */
            verifiedAt?: string | null;
        };
        /** ArtifactSourceReference */
        ArtifactSourceReference: {
            /** Reference */
            reference: string;
            sourceType: components["schemas"]["CitationSourceType"];
        };
        /**
         * ArtifactState
         * @enum {string}
         */
        ArtifactState: "DRAFT" | "REVIEW_REQUIRED" | "PUBLISHED" | "ARCHIVED";
        /**
         * ArtifactType
         * @enum {string}
         */
        ArtifactType: "DOCUMENT" | "WORK_PLAN" | "COMPARISON";
        /** ArtifactVersionDetail */
        ArtifactVersionDetail: {
            /**
             * Artifactid
             * Format: uuid
             */
            artifactId: string;
            content: components["schemas"]["ArtifactDraftContent"];
            /** Contentfingerprint */
            contentFingerprint: string;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /**
             * Immutable
             * @default true
             */
            immutable: boolean;
            /** Sourcecount */
            sourceCount: number;
            /** Sourceevidence */
            sourceEvidence: components["schemas"]["ArtifactSourceEvidence"][];
            /** Versionnumber */
            versionNumber: number;
        };
        /** ArtifactVersionDetailEnvelope */
        ArtifactVersionDetailEnvelope: {
            data: components["schemas"]["ArtifactVersionDetail"];
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
        /** ArtifactVersionEnvelope */
        ArtifactVersionEnvelope: {
            data: components["schemas"]["ArtifactVersionReceipt"];
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
        /** ArtifactVersionReceipt */
        ArtifactVersionReceipt: {
            /**
             * Artifactid
             * Format: uuid
             */
            artifactId: string;
            /** Artifactrevision */
            artifactRevision: number;
            /** Contentfingerprint */
            contentFingerprint: string;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /**
             * Immutable
             * @default true
             */
            immutable: boolean;
            /** Sourcecount */
            sourceCount: number;
            /** Versionnumber */
            versionNumber: number;
        };
        /** ArtifactVersionSummary */
        ArtifactVersionSummary: {
            /**
             * Artifactid
             * Format: uuid
             */
            artifactId: string;
            /** Contentfingerprint */
            contentFingerprint: string;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /**
             * Immutable
             * @default true
             */
            immutable: boolean;
            /** Sourcecount */
            sourceCount: number;
            /** Versionnumber */
            versionNumber: number;
        };
        /** ArtifactVersionSummaryListEnvelope */
        ArtifactVersionSummaryListEnvelope: {
            /** Data */
            data: components["schemas"]["ArtifactVersionSummary"][];
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
            selectedWork?: components["schemas"]["AskSelectedWork"] | null;
            /** Surface */
            surface?: string | null;
        };
        /** AskPersonalization */
        AskPersonalization: {
            /** Appliedkinds */
            appliedKinds?: ("RESPONSE_LENGTH" | "OUTPUT_FORMAT" | "TONE" | "WORKING_STYLE")[];
            /** @default NOT_EVALUATED */
            state: components["schemas"]["AskPersonalizationState"];
        };
        /**
         * AskPersonalizationState
         * @enum {string}
         */
        AskPersonalizationState: "NOT_EVALUATED" | "NOT_PERMITTED" | "DISABLED" | "EMPTY" | "APPLIED" | "BYPASSED" | "UNAVAILABLE";
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
            /** Attachmentids */
            attachmentIds?: string[];
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
            personalization?: components["schemas"]["AskPersonalization"];
            policy: components["schemas"]["AskPolicyDecision"];
            /** Requestid */
            requestId: string;
            /** Runid */
            runId: string;
            selectedWork?: components["schemas"]["AskSelectedWork"] | null;
            /** Sourcecount */
            sourceCount: number;
            state: components["schemas"]["AskState"];
            /** Statuscode */
            statusCode: string;
            /** Usermessageid */
            userMessageId?: string | null;
            /** Warnings */
            warnings?: components["schemas"]["AskRuntimeWarning"][];
        };
        /**
         * AskRuntimeWarning
         * @enum {string}
         */
        AskRuntimeWarning: "MODEL_USAGE_MEASUREMENT_MISSING" | "LOCAL_USAGE_MEASUREMENT_NOT_CURRENT" | "AI_TOKEN_BUDGET_ALERT_THRESHOLD_REACHED" | "AI_TOKEN_BUDGET_EXCEEDED_ALERT_ONLY";
        /** AskSelectedWork */
        AskSelectedWork: {
            /** Expectedversion */
            expectedVersion: number;
            /** Obligationkey */
            obligationKey?: string | null;
            /**
             * Sourcereference
             * Format: uuid
             */
            sourceReference: string;
            /**
             * Sourcesystem
             * @enum {string}
             */
            sourceSystem: "PERSONAL_TASK" | "SERVICE_REQUEST" | "APPROVAL_TASK" | "APPROVAL_REQUEST" | "WORKSPACE";
        };
        /**
         * AskState
         * @enum {string}
         */
        AskState: "COMPLETED" | "ABSTAINED" | "CONFIGURATION_REQUIRED";
        /** AttachmentCapabilities */
        AttachmentCapabilities: {
            /** Allowedmediatypes */
            allowedMediaTypes: string[];
            antivirus: components["schemas"]["WorkflowCapability"];
            deletion: components["schemas"]["WorkflowCapability"];
            detachAll: components["schemas"]["WorkflowCapability"];
            dlp: components["schemas"]["WorkflowCapability"];
            index: components["schemas"]["WorkflowCapability"];
            inspectionLog: components["schemas"]["WorkflowCapability"];
            maskingHistory: components["schemas"]["WorkflowCapability"];
            /** Maximumfilebytes */
            maximumFileBytes: number;
            ocr: components["schemas"]["WorkflowCapability"];
            ocrViewer: components["schemas"]["WorkflowCapability"];
            parser: components["schemas"]["WorkflowCapability"];
            signedAuditReport: components["schemas"]["WorkflowCapability"];
            upload: components["schemas"]["WorkflowCapability"];
        };
        /** AttachmentCapabilitiesEnvelope */
        AttachmentCapabilitiesEnvelope: {
            data: components["schemas"]["AttachmentCapabilities"];
            /**
             * Message
             * @default Secure attachment capabilities loaded.
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
        /** AttachmentCitation */
        AttachmentCitation: {
            /** Citationid */
            citationId: string;
            /** Contentsha256 */
            contentSha256: string;
            /** Evidence */
            evidence: string;
            /** Label */
            label: string;
            /** Locator */
            locator: string;
        };
        /** AttachmentEnvelope */
        AttachmentEnvelope: {
            data: components["schemas"]["SecureAttachment"];
            /**
             * Message
             * @default Secure attachment loaded.
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
        /** AttachmentEvidence */
        AttachmentEvidence: {
            /**
             * Attachmentid
             * Format: uuid
             */
            attachmentId: string;
            /** Citations */
            citations: components["schemas"]["AttachmentCitation"][];
            /** Inspectionlog */
            inspectionLog: components["schemas"]["AttachmentEvidenceEvent"][];
            /** Maskinghistory */
            maskingHistory: components["schemas"]["AttachmentEvidenceEvent"][];
            /** Ocrevidence */
            ocrEvidence: components["schemas"]["AttachmentCitation"][];
            /** Sourcesha256 */
            sourceSha256: string;
            /** Stages */
            stages: components["schemas"]["AttachmentStage"][];
        };
        /** AttachmentEvidenceEnvelope */
        AttachmentEvidenceEnvelope: {
            data: components["schemas"]["AttachmentEvidence"];
            /**
             * Message
             * @default Secure attachment evidence loaded.
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
        /** AttachmentEvidenceEvent */
        AttachmentEvidenceEvent: {
            currentState: components["schemas"]["AttachmentState"];
            /**
             * Eventid
             * Format: uuid
             */
            eventId: string;
            /** Eventtype */
            eventType: string;
            /**
             * Occurredat
             * Format: date-time
             */
            occurredAt: string;
            previousState?: components["schemas"]["AttachmentState"] | null;
            /** Revision */
            revision: number;
            /** Safeerrorcode */
            safeErrorCode?: string | null;
        };
        /** AttachmentListEnvelope */
        AttachmentListEnvelope: {
            /** Data */
            data: components["schemas"]["SecureAttachment"][];
            /**
             * Message
             * @default Secure attachments loaded.
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
        /** AttachmentStage */
        AttachmentStage: {
            key: components["schemas"]["AttachmentStageKey"];
            /** Observedat */
            observedAt?: string | null;
            /** Providercode */
            providerCode?: string | null;
            /** Recoveryhint */
            recoveryHint?: string | null;
            /** Safeerrorcode */
            safeErrorCode?: string | null;
            state: components["schemas"]["AttachmentStageState"];
        };
        /**
         * AttachmentStageKey
         * @enum {string}
         */
        AttachmentStageKey: "UPLOAD" | "AV" | "DLP" | "PARSER" | "OCR" | "INDEX";
        /**
         * AttachmentStageState
         * @enum {string}
         */
        AttachmentStageState: "PENDING" | "RUNNING" | "PASSED" | "BLOCKED" | "FAILED" | "NOT_REQUIRED" | "NOT_CONFIGURED";
        /**
         * AttachmentState
         * @enum {string}
         */
        AttachmentState: "UPLOADING" | "SCANNING" | "READY" | "PARTIAL" | "BLOCKED" | "FAILED" | "CANCELLED" | "DELETION_PENDING" | "DELETED";
        /** AttachmentUploadTicket */
        AttachmentUploadTicket: {
            /**
             * Expiresat
             * Format: date-time
             */
            expiresAt: string;
            /**
             * Method
             * @default PUT
             */
            method: string;
            /** Uploadreference */
            uploadReference: string;
            /** Uploadurl */
            uploadUrl: string;
        };
        /** AutosaveArtifactRequest */
        AutosaveArtifactRequest: {
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            content: components["schemas"]["ArtifactDraftContent"];
            /** Expectedrevision */
            expectedRevision: number;
            metadata?: components["schemas"]["ArtifactMetadata"];
            /** Reasoncode */
            reasonCode: string;
            /** Sources */
            sources?: components["schemas"]["ArtifactSourceReference"][];
        };
        /** BootstrapAIExecutionPolicyRequest */
        BootstrapAIExecutionPolicyRequest: {
            /**
             * Alertthresholdpercent
             * @default 80
             */
            alertThresholdPercent: number;
            /** Allowedknowledgesources */
            allowedKnowledgeSources?: string[];
            /** Allowedmodelroutes */
            allowedModelRoutes: components["schemas"]["ModelRoutePolicy"][];
            /** Allowedtoolkeys */
            allowedToolKeys?: string[];
            /** @default ALERT_ONLY */
            budgetEnforcementMode: components["schemas"]["BudgetEnforcementMode"];
            /** Changereason */
            changeReason: string;
            /** @default NOT_REQUIRED */
            evaluationGateStatus: components["schemas"]["EvaluationGateStatus"];
            /** Evaluationobservedat */
            evaluationObservedAt?: string | null;
            /** Evaluationpolicyversion */
            evaluationPolicyVersion?: number | null;
            /** Expectedexistingcount */
            expectedExistingCount: number;
            /**
             * Idempotencykey
             * Format: uuid
             */
            idempotencyKey: string;
            /**
             * Maxoutputtokensperrequest
             * @default 900
             */
            maxOutputTokensPerRequest: number;
            /** Periodtokenlimit */
            periodTokenLimit?: number | null;
            /**
             * Requireevaluationpass
             * @default false
             */
            requireEvaluationPass: boolean;
        };
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
         * BudgetEnforcementMode
         * @enum {string}
         */
        BudgetEnforcementMode: "ALERT_ONLY" | "ENFORCED";
        /**
         * CapabilityStatus
         * @enum {string}
         */
        CapabilityStatus: "AVAILABLE" | "PARTIAL" | "NOT_CONFIGURED" | "UNAVAILABLE";
        /** ChangeMemoryStateRequest */
        ChangeMemoryStateRequest: {
            /** Changereason */
            changeReason: string;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedrevision */
            expectedRevision: number;
            memoryState: components["schemas"]["MemoryState"];
            /** Reasoncode */
            reasonCode: string;
        };
        /** ChangeRoutineActivationRequest */
        ChangeRoutineActivationRequest: {
            action: components["schemas"]["RoutineActivationAction"];
            /** Changereason */
            changeReason: string;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedrevision */
            expectedRevision: number;
            /** Reasoncode */
            reasonCode: string;
            /** Startat */
            startAt?: string | null;
        };
        /** ChangeRoutineConsentRequest */
        ChangeRoutineConsentRequest: {
            /** Changereason */
            changeReason: string;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            consentState: components["schemas"]["RoutineConsentState"];
            /** Expectedrevision */
            expectedRevision: number;
            /** Reasoncode */
            reasonCode: string;
            scope: components["schemas"]["RoutineConsentScope"];
        };
        /** ChangeRoutineLifecycleRequest */
        ChangeRoutineLifecycleRequest: {
            action: components["schemas"]["RoutineLifecycleAction"];
            /** Changereason */
            changeReason: string;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedrevision */
            expectedRevision: number;
            /** Reasoncode */
            reasonCode: string;
        };
        /**
         * CitationSourceType
         * @enum {string}
         */
        CitationSourceType: "WORK_ITEM" | "MAIL" | "CALENDAR" | "APPROVAL_TASK" | "APPROVAL_REQUEST" | "APPROVAL_FORM" | "APPROVAL_OPERATION" | "ATTACHMENT";
        /** ClearProposalInboxEnvelope */
        ClearProposalInboxEnvelope: {
            data: components["schemas"]["ClearProposalInboxReceipt"];
            /**
             * Message
             * @default Proposal inbox cleared.
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
        /** ClearProposalInboxReceipt */
        ClearProposalInboxReceipt: {
            /**
             * Clearedat
             * Format: date-time
             */
            clearedAt: string;
            /** Hiddencount */
            hiddenCount: number;
        };
        /** ClearProposalInboxRequest */
        ClearProposalInboxRequest: {
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
        };
        /** CommandDecision */
        CommandDecision: {
            /** Actoruserid */
            actorUserId: string;
            /**
             * Decidedat
             * Format: date-time
             */
            decidedAt: string;
            /** Decision */
            decision: string;
            /** Evidencerefs */
            evidenceRefs: string[];
            /** Reason */
            reason: string;
        };
        /** CommandPreflight */
        CommandPreflight: {
            /** Changes */
            changes: components["schemas"]["PreflightChange"][];
            /** Impactscopes */
            impactScopes: string[];
            /** Recoveryplan */
            recoveryPlan: string;
            /** Recoveryplanhash */
            recoveryPlanHash: string;
        };
        /** CommandProblem */
        CommandProblem: {
            /** Code */
            code: string;
            /** Detail */
            detail: string;
            /** Recoveryhint */
            recoveryHint?: string | null;
        };
        /** CommandReceipt */
        CommandReceipt: {
            /**
             * Auditeventid
             * Format: uuid
             */
            auditEventId: string;
            /**
             * Completedat
             * Format: date-time
             */
            completedAt: string;
            /** Domainreceiptref */
            domainReceiptRef?: string | null;
            /**
             * Receiptid
             * Format: uuid
             */
            receiptId: string;
            /** Resultsummary */
            resultSummary: string;
            /** Rollbackref */
            rollbackRef?: string | null;
        };
        /** CommandReview */
        CommandReview: {
            /** Evidencerefs */
            evidenceRefs: string[];
            preflight: components["schemas"]["CommandPreflight"];
            /** Reason */
            reason: string;
            /** Ticketref */
            ticketRef: string;
        };
        /** CommandRoutineRunRequest */
        CommandRoutineRunRequest: {
            action: components["schemas"]["RoutineRunCommand"];
            /** Changereason */
            changeReason: string;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedrevision */
            expectedRevision: number;
            /** Reasoncode */
            reasonCode: string;
        };
        /** CommandTarget */
        CommandTarget: {
            /** Id */
            id: string;
            /** Type */
            type: string;
        };
        /** CompleteAttachmentUploadRequest */
        CompleteAttachmentUploadRequest: {
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedrevision */
            expectedRevision: number;
            /** Observedsha256 */
            observedSha256: string;
            /** Observedsizebytes */
            observedSizeBytes: number;
            /** Uploadreference */
            uploadReference: string;
        };
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
        /** ConnectorSummary */
        ConnectorSummary: {
            /** Aclcoverage */
            aclCoverage?: number | null;
            /** Connectorid */
            connectorId: string;
            health: components["schemas"]["OperationalHealth"];
            /** Lastsuccessfulsyncat */
            lastSuccessfulSyncAt?: string | null;
            /** Name */
            name: string;
            /** Ownerref */
            ownerRef: string;
            /** Providertype */
            providerType: string;
            /** Region */
            region?: string | null;
            /** Repositories */
            repositories: string[];
            /** Secretexpiresat */
            secretExpiresAt?: string | null;
            /** Syncstate */
            syncState: string;
            /** Tenantscope */
            tenantScope: string;
            /** Version */
            version: number;
        };
        /** ConnectorsSnapshot */
        ConnectorsSnapshot: {
            /** Aclmismatchcount */
            aclMismatchCount: number;
            /** Blockedrepositorycount */
            blockedRepositoryCount: number;
            capability: components["schemas"]["ControlPlaneCapability"];
            /** Connectors */
            connectors: components["schemas"]["ConnectorSummary"][];
            /**
             * Generatedat
             * Format: date-time
             */
            generatedAt: string;
        };
        /** ConsumeQuestionLaunchRequest */
        ConsumeQuestionLaunchRequest: {
            /**
             * Launchid
             * Format: uuid
             */
            launchId: string;
        };
        /** ControlPlaneCapability */
        ControlPlaneCapability: {
            /** Configured */
            configured: boolean;
            /** Reason */
            reason?: string | null;
            /** Recoveryhint */
            recoveryHint?: string | null;
            status: components["schemas"]["CapabilityStatus"];
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
            /**
             * Agentkey
             * @default DWP_ASSISTANT
             */
            agentKey: string;
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
            selectedWork?: components["schemas"]["AskSelectedWork"] | null;
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
             * Agentkey
             * @description Agent recorded on the latest visible assistant answer.
             */
            agentKey: string | null;
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
             * Evidencecount
             * @description Citation count on the latest visible assistant answer.
             */
            evidenceCount: number;
            /**
             * Lastanswerstatus
             * @description Persisted status code of the latest visible assistant answer.
             */
            lastAnswerStatus: string | null;
            /**
             * Lastmessageat
             * Format: date-time
             */
            lastMessageAt: string;
            /**
             * Legalhold
             * @description Whether the governing tenant policy currently blocks deletion.
             */
            legalHold: boolean;
            /** Locale */
            locale: string;
            /** Messagecount */
            messageCount: number;
            /**
             * Retentionuntil
             * @description Conversation retention deadline, or null when the store has no deadline.
             */
            retentionUntil: string | null;
            /**
             * Sourcesystems
             * @description Distinct source systems cited by the latest visible assistant answer.
             */
            sourceSystems: string[];
            /**
             * Summaryexcerpt
             * @description Whitespace-normalized excerpt of the latest visible assistant answer.
             */
            summaryExcerpt: string | null;
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
        /** CreateArtifactRequest */
        CreateArtifactRequest: {
            artifactType: components["schemas"]["ArtifactType"];
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            content: components["schemas"]["ArtifactDraftContent"];
            /** Expectedrevision */
            expectedRevision: number;
            metadata?: components["schemas"]["ArtifactMetadata"];
            /** Reasoncode */
            reasonCode: string;
            sourceConversation?: components["schemas"]["ArtifactConversationSource"] | null;
            /** Sources */
            sources?: components["schemas"]["ArtifactSourceReference"][];
        };
        /** CreateArtifactVersionRequest */
        CreateArtifactVersionRequest: {
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedrevision */
            expectedRevision: number;
            /** Reasoncode */
            reasonCode: string;
        };
        /** CreateAttachmentRequest */
        CreateAttachmentRequest: {
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Conversationid */
            conversationId?: string | null;
            /**
             * Expectedrevision
             * @default 0
             */
            expectedRevision: number;
            /** Filename */
            fileName: string;
            /** Mediatype */
            mediaType: string;
            /**
             * Retentionhours
             * @default 24
             */
            retentionHours: number;
            /** Sizebytes */
            sizeBytes: number;
            /** Sourcesha256 */
            sourceSha256: string;
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
        /** CreateGovernedCommandRequest */
        CreateGovernedCommandRequest: {
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Evidencerefs */
            evidenceRefs: string[];
            /** Expectedversion */
            expectedVersion: number;
            /** Impactacknowledged */
            impactAcknowledged: boolean;
            kind: components["schemas"]["GovernedCommandKind"];
            /** Payload */
            payload: {
                [key: string]: components["schemas"]["JsonValue"];
            };
            preflight: components["schemas"]["CommandPreflight"];
            /** Reason */
            reason: string;
            target: components["schemas"]["CommandTarget"];
            /** Ticketref */
            ticketRef: string;
        };
        /** CreateMemoryRequest */
        CreateMemoryRequest: {
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedrevision */
            expectedRevision: number;
            /** Expiresat */
            expiresAt?: string | null;
            kind: components["schemas"]["MemoryKind"];
            memory: components["schemas"]["ExplicitMemoryValue"];
            /** Reasoncode */
            reasonCode: string;
            /** Scope */
            scope?: components["schemas"]["MemoryScope"][];
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
        /** CreateProposalHandoffRequest */
        CreateProposalHandoffRequest: {
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedversion */
            expectedVersion: number;
            /**
             * Idempotencykey
             * Format: uuid
             */
            idempotencyKey: string;
            /** Reviewedinputs */
            reviewedInputs?: {
                [key: string]: components["schemas"]["JsonValue"];
            };
        };
        /** CreateQuestionLaunchRequest */
        CreateQuestionLaunchRequest: {
            /** Question */
            question: string;
        };
        /** CreateResearchDeliveryRequest */
        CreateResearchDeliveryRequest: {
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedversion */
            expectedVersion: number;
            /**
             * Idempotencykey
             * Format: uuid
             */
            idempotencyKey: string;
            /** Parameters */
            parameters?: {
                [key: string]: components["schemas"]["JsonValue"];
            };
        };
        /** CreateResearchPlanRequest */
        CreateResearchPlanRequest: {
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            definition: components["schemas"]["ResearchPlanDefinition"];
            /**
             * Expectedrevision
             * @default 0
             */
            expectedRevision: number;
        };
        /** CreateRoutineRequest */
        CreateRoutineRequest: {
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            definition: components["schemas"]["RoutineDefinition"];
            /** Expectedrevision */
            expectedRevision: number;
            /** Reasoncode */
            reasonCode: string;
        };
        /** CreateTeamArtifactAccessRequest */
        CreateTeamArtifactAccessRequest: {
            /** Changereason */
            changeReason: string;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedrevision */
            expectedRevision: number;
            /**
             * Preflightid
             * Format: uuid
             */
            preflightId: string;
            /** Reasoncode */
            reasonCode: string;
        };
        /** CreateTeamArtifactCommentRequest */
        CreateTeamArtifactCommentRequest: {
            /** Anchor */
            anchor?: string | null;
            /** Body */
            body: string;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedrevision */
            expectedRevision: number;
            /** Reasoncode */
            reasonCode: string;
        };
        /** CreateTeamArtifactShareRequest */
        CreateTeamArtifactShareRequest: {
            /** Changereason */
            changeReason: string;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedrevision */
            expectedRevision: number;
            /**
             * Expiresat
             * Format: date-time
             */
            expiresAt: string;
            permission: components["schemas"]["TeamArtifactSharePermission"];
            /**
             * Preflightid
             * Format: uuid
             */
            preflightId: string;
            /** Reasoncode */
            reasonCode: string;
        };
        /** CreateTeamArtifactWorkspaceRequest */
        CreateTeamArtifactWorkspaceRequest: {
            /** Changereason */
            changeReason: string;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedrevision */
            expectedRevision: number;
            /**
             * Preflightid
             * Format: uuid
             */
            preflightId: string;
            /** Reasoncode */
            reasonCode: string;
            /**
             * Teamid
             * Format: uuid
             */
            teamId: string;
        };
        /**
         * DataClassification
         * @enum {string}
         */
        DataClassification: "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
        /** DataDispositionReceipt */
        DataDispositionReceipt: {
            /** Activestoreenvelopesdestroyed */
            activeStoreEnvelopesDestroyed: boolean;
            /**
             * Backupdispositionstate
             * @default EXTERNAL_RETENTION_BOUNDARY
             */
            backupDispositionState: string;
            /**
             * Completedat
             * Format: date-time
             */
            completedAt: string;
            /**
             * Dispositionid
             * Format: uuid
             */
            dispositionId: string;
            /**
             * Dispositionmethod
             * @default PHYSICAL_ROW_PURGE_OF_ENCRYPTED_RECORDS
             */
            dispositionMethod: string;
            /**
             * Dispositionscope
             * @default AGENT_ACTIVE_POSTGRES_DOMAIN_ONLY
             */
            dispositionScope: string;
            domain: components["schemas"]["DomainKey"];
            /** Generation */
            generation: number;
            /** Purgedrowcount */
            purgedRowCount: number;
            /** Purgedtablecounts */
            purgedTableCounts?: {
                [key: string]: number;
            };
            /** Receiptfingerprint */
            receiptFingerprint: string;
            /**
             * Sourcesystemdataaffected
             * @default false
             */
            sourceSystemDataAffected: boolean;
        };
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
        /** DecideTeamArtifactReviewStageRequest */
        DecideTeamArtifactReviewStageRequest: {
            /** Changereason */
            changeReason: string;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            decision: components["schemas"]["TeamArtifactReviewDecision"];
            /** Expectedrevision */
            expectedRevision: number;
            /** Reasoncode */
            reasonCode: string;
        };
        /** DeleteAttachmentRequest */
        DeleteAttachmentRequest: {
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedrevision */
            expectedRevision: number;
            /** Reason */
            reason: string;
        };
        /** DeleteMemoryRequest */
        DeleteMemoryRequest: {
            /** Changereason */
            changeReason: string;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedrevision */
            expectedRevision: number;
            /** Reasoncode */
            reasonCode: string;
        };
        /** DeletionJob */
        DeletionJob: {
            /**
             * Attemptcount
             * @default 0
             */
            attemptCount: number;
            /** Blockeddomains */
            blockedDomains?: components["schemas"]["DomainKey"][];
            /** Completedat */
            completedAt?: string | null;
            /**
             * Deletionexecutionavailable
             * @default false
             */
            deletionExecutionAvailable: boolean;
            /**
             * Deletionjobid
             * Format: uuid
             */
            deletionJobId: string;
            /**
             * Deletionperformed
             * @default false
             */
            deletionPerformed: boolean;
            /** Domains */
            domains: components["schemas"]["DomainKey"][];
            /** Legalholds */
            legalHolds?: components["schemas"]["LegalHoldEvidence"][];
            /**
             * Requestedat
             * Format: date-time
             */
            requestedAt: string;
            /** Stages */
            stages?: components["schemas"]["DeletionStage"][];
            state: components["schemas"]["DeletionJobState"];
            /** Targets */
            targets?: components["schemas"]["DeletionTargetReceipt"][];
        };
        /** DeletionJobEnvelope */
        DeletionJobEnvelope: {
            data: components["schemas"]["DeletionJob"];
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
         * DeletionJobState
         * @enum {string}
         */
        DeletionJobState: "REQUESTED" | "RUNNING" | "PARTIAL" | "COMPLETED" | "BLOCKED_LEGAL_HOLD" | "FAILED";
        /** DeletionJobsEnvelope */
        DeletionJobsEnvelope: {
            /** Data */
            data: components["schemas"]["DeletionJob"][];
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
        /** DeletionStage */
        DeletionStage: {
            /** Detailcode */
            detailCode: string;
            /** Evidencefingerprint */
            evidenceFingerprint?: string | null;
            /** Evidencereference */
            evidenceReference?: string | null;
            key: components["schemas"]["DeletionStageKey"];
            /** Observedat */
            observedAt?: string | null;
            state: components["schemas"]["DeletionStageState"];
        };
        /**
         * DeletionStageKey
         * @enum {string}
         */
        DeletionStageKey: "REQUEST_ACCEPTED" | "TARGETS_SCHEDULED" | "ACTIVE_STORE_DISPOSITION" | "BACKUP_BOUNDARY" | "RECEIPT_FINALIZATION";
        /**
         * DeletionStageState
         * @enum {string}
         */
        DeletionStageState: "PENDING" | "RUNNING" | "COMPLETED" | "PARTIAL" | "BLOCKED" | "FAILED" | "UNAVAILABLE";
        /** DeletionTargetReceipt */
        DeletionTargetReceipt: {
            /** Affectedcount */
            affectedCount?: number | null;
            disposition?: components["schemas"]["DataDispositionReceipt"] | null;
            domain: components["schemas"]["DomainKey"];
            legalHoldEvidence?: components["schemas"]["LegalHoldEvidence"] | null;
            /** Safeerrorcode */
            safeErrorCode?: string | null;
            state: components["schemas"]["DeletionTargetState"];
        };
        /**
         * DeletionTargetState
         * @enum {string}
         */
        DeletionTargetState: "REQUESTED" | "RUNNING" | "COMPLETED" | "BLOCKED_LEGAL_HOLD" | "FAILED";
        /** DlpFinding */
        DlpFinding: {
            /** Code */
            code: string;
            /** Field */
            field: string;
            severity: components["schemas"]["DlpOutcome"];
        };
        /**
         * DlpOutcome
         * @enum {string}
         */
        DlpOutcome: "PASS" | "REVIEW" | "BLOCKED";
        /**
         * DomainKey
         * @enum {string}
         */
        DomainKey: "ROUTINE" | "MEMORY" | "ARTIFACT" | "ARTIFACT_EXPORT";
        /** DriftSignal */
        DriftSignal: {
            /** Affectedscope */
            affectedScope: string;
            /** Anonymizedsample */
            anonymizedSample?: string | null;
            /** Approvedrawaccess */
            approvedRawAccess?: boolean | null;
            /** Currentvalue */
            currentValue?: number | null;
            /**
             * Detectedat
             * Format: date-time
             */
            detectedAt: string;
            /** Feedbackevidenceref */
            feedbackEvidenceRef?: string | null;
            /** Label */
            label: string;
            /** Rollbackrecommendation */
            rollbackRecommendation?: string | null;
            /** Severity */
            severity: string;
            /** Signalid */
            signalId: string;
            /** Threshold */
            threshold?: number | null;
        };
        /** DryRunRoutineRequest */
        DryRunRoutineRequest: {
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedrevision */
            expectedRevision: number;
            /** Reasoncode */
            reasonCode: string;
            /** Referencetime */
            referenceTime?: string | null;
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
            retention: components["schemas"]["dwp_agent__operations_contracts__RetentionPolicy"];
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
        /** DwaionPageBootstrap */
        DwaionPageBootstrap: {
            /** Available */
            available: boolean;
            /** Dataroutes */
            dataRoutes: string[];
            /** Pagekey */
            pageKey: string;
            /** Reason */
            reason?: string | null;
            /** Resourceid */
            resourceId?: string | null;
        };
        /** DwaionPageBootstrapEnvelope */
        DwaionPageBootstrapEnvelope: {
            data: components["schemas"]["DwaionPageBootstrap"];
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
         * EnforcementActivationState
         * @enum {string}
         */
        EnforcementActivationState: "DISABLED" | "ENABLED";
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
        /** EvaluationComparisonSummary */
        EvaluationComparisonSummary: {
            /** Baselinelabel */
            baselineLabel: string;
            /** Candidatelabel */
            candidateLabel: string;
            /** Comparisonid */
            comparisonId: string;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /** Evaluatorfailurecount */
            evaluatorFailureCount?: number | null;
            /** Passrate */
            passRate?: number | null;
            /** Regressioncount */
            regressionCount?: number | null;
            /** State */
            state: string;
        };
        /** EvaluationDatasetSummary */
        EvaluationDatasetSummary: {
            /** Casecount */
            caseCount: number;
            /** Checksumsha256 */
            checksumSha256?: string | null;
            /** Datasetid */
            datasetId: string;
            /** Name */
            name: string;
            /** Ownerref */
            ownerRef: string;
            /** Piistate */
            piiState: string;
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
            /** Version */
            version: number;
        };
        /**
         * EvaluationEvidenceState
         * @enum {string}
         */
        EvaluationEvidenceState: "VERIFIED" | "STALE" | "UNAVAILABLE";
        /**
         * EvaluationGateStatus
         * @enum {string}
         */
        EvaluationGateStatus: "NOT_REQUIRED" | "PENDING" | "PASSED" | "FAILED" | "STALE";
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
        /** EvaluationSafetySnapshot */
        EvaluationSafetySnapshot: {
            capability: components["schemas"]["ControlPlaneCapability"];
            /** Comparisons */
            comparisons: components["schemas"]["EvaluationComparisonSummary"][];
            /** Datasets */
            datasets: components["schemas"]["EvaluationDatasetSummary"][];
            /** Driftsignals */
            driftSignals: components["schemas"]["DriftSignal"][];
            /**
             * Generatedat
             * Format: date-time
             */
            generatedAt: string;
            /** Releasegatestate */
            releaseGateState: string;
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
        /** ExecuteResearchRunRequest */
        ExecuteResearchRunRequest: {
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedversion */
            expectedVersion: number;
        };
        /** ExecutionSummary */
        ExecutionSummary: {
            /** Attentionitems */
            attentionItems?: components["schemas"]["ActivityEvent"][];
            /**
             * Cancelled
             * @default 0
             */
            cancelled: number;
            /**
             * Completed
             * @default 0
             */
            completed: number;
            coverage?: components["schemas"]["ActivityCoverage"];
            /**
             * Failed
             * @default 0
             */
            failed: number;
            /**
             * Generatedat
             * Format: date-time
             */
            generatedAt: string;
            /**
             * Needsinput
             * @default 0
             */
            needsInput: number;
            /**
             * Policyblocked
             * @default 0
             */
            policyBlocked: number;
            /**
             * Running
             * @default 0
             */
            running: number;
            /**
             * Total
             * @default 0
             */
            total: number;
            /**
             * Unknown
             * @default 0
             */
            unknown: number;
        };
        /** ExecutionSummaryEnvelope */
        ExecutionSummaryEnvelope: {
            data: components["schemas"]["ExecutionSummary"];
            /**
             * Message
             * @default Current Agent execution summary loaded.
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
        /** ExplicitMemoryValue */
        ExplicitMemoryValue: {
            /** Value */
            value: string;
        };
        /** ExportArtifactRequest */
        ExportArtifactRequest: {
            /** Changereason */
            changeReason: string;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedrevision */
            expectedRevision: number;
            exportFormat: components["schemas"]["ExportFormat"];
            /**
             * Preflightid
             * Format: uuid
             */
            preflightId: string;
            /** Reasoncode */
            reasonCode: string;
            /** Versionnumber */
            versionNumber: number;
        };
        /**
         * ExportFormat
         * @enum {string}
         */
        ExportFormat: "MARKDOWN" | "DOCX" | "PDF";
        /**
         * ExternalDataState
         * @enum {string}
         */
        ExternalDataState: "VERIFIED" | "STALE" | "UNAVAILABLE" | "UNVERIFIED";
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
        /** GovernedArtifact */
        GovernedArtifact: {
            /**
             * Artifactid
             * Format: uuid
             */
            artifactId: string;
            artifactType: components["schemas"]["ArtifactType"];
            /** Authorsubjectid */
            authorSubjectId?: string | null;
            capabilities?: components["schemas"]["ArtifactCapabilities"];
            content: components["schemas"]["ArtifactDraftContent"];
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /** Currentversionnumber */
            currentVersionNumber: number;
            /** Draftrevision */
            draftRevision: number;
            metadata?: components["schemas"]["ArtifactMetadata"];
            /** Publishedversionnumber */
            publishedVersionNumber?: number | null;
            /** Revision */
            revision: number;
            /** Sources */
            sources: components["schemas"]["ArtifactSourceReference"][];
            state: components["schemas"]["ArtifactState"];
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
        };
        /** GovernedCommand */
        GovernedCommand: {
            /** Allowedtransitions */
            allowedTransitions: string[];
            /** Approvalrequired */
            approvalRequired: boolean;
            /** Canapprove */
            canApprove: boolean;
            /** Checkeruserid */
            checkerUserId?: string | null;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            decision?: components["schemas"]["CommandDecision"] | null;
            /** Expectedversion */
            expectedVersion: number;
            kind: components["schemas"]["GovernedCommandKind"];
            /** Makeruserid */
            makerUserId: string;
            problem?: components["schemas"]["CommandProblem"] | null;
            /** Progresspercent */
            progressPercent?: number | null;
            receipt?: components["schemas"]["CommandReceipt"] | null;
            review: components["schemas"]["CommandReview"];
            state: components["schemas"]["GovernedCommandState"];
            target: components["schemas"]["CommandTarget"];
            /** Transitionblockreason */
            transitionBlockReason?: string | null;
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
            /** Version */
            version: number;
        };
        /** GovernedCommandDecisionRequest */
        GovernedCommandDecisionRequest: {
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Decision */
            decision: string;
            /** Evidencerefs */
            evidenceRefs: string[];
            /** Expectedversion */
            expectedVersion: number;
            /** Reason */
            reason: string;
        };
        /** GovernedCommandEnvelope */
        GovernedCommandEnvelope: {
            data: components["schemas"]["GovernedCommand"];
            /**
             * Message
             * @default DWAI-ON governed command loaded.
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
         * GovernedCommandKind
         * @enum {string}
         */
        GovernedCommandKind: "MODEL_ROUTING_DRAFT_SAVE" | "MODEL_ROUTING_UPDATE" | "MODEL_ROUTE_SIMULATE" | "MODEL_CANARY_START" | "MODEL_ROLLBACK" | "EMERGENCY_STOP" | "EMERGENCY_RECOVERY" | "PROVIDER_CIRCUIT_BREAK" | "MODEL_SMART_ISOLATE" | "EMERGENCY_RECOVERY_SIMULATE" | "EMERGENCY_ISOLATION_ROLLBACK" | "AGENT_DRAFT_SAVE" | "AGENT_PROMOTE" | "AGENT_EVALUATE" | "AGENT_ROLLBACK" | "AGENT_KILL_SWITCH" | "AGENT_EVALUATION_CERT_SIGN" | "CONNECTOR_DRAFT_SAVE" | "CONNECTOR_CREATE" | "CONNECTOR_PROBE" | "CONNECTOR_SYNC" | "CONNECTOR_REINDEX" | "CONNECTOR_SECRET_ROTATE" | "CONNECTOR_SCOPE_REDUCE" | "CONNECTOR_REVOKE" | "CONNECTOR_DELETE" | "CONNECTOR_OAUTH_REAUTHORIZE" | "CONNECTOR_PAUSE" | "CONNECTOR_QUARANTINE" | "CONNECTOR_DRIFT_HEAL" | "CONNECTOR_KILL_SWITCH" | "DATASET_IMPORT" | "DATASET_PII_DECIDE" | "EVALUATION_COMPARE" | "SAFETY_SIMULATE" | "DRIFT_EVIDENCE_ATTACH" | "DRIFT_RAW_EVIDENCE_REQUEST" | "EVALUATION_RUN" | "EVALUATION_RERUN" | "EVALUATION_REPORT_EXPORT" | "EVALUATION_GATE_APPROVE" | "SAFETY_GUARDRAIL_ENFORCE" | "SAFETY_CANARY_APPROVE" | "INCIDENT_EMERGENCY_STOP" | "INCIDENT_WAR_ROOM_OPEN" | "INCIDENT_REPORT_EXPORT" | "INCIDENT_VALIDATION_RUN" | "INCIDENT_CONNECTOR_REAUTH" | "INCIDENT_SAFE_ROLLBACK" | "INCIDENT_RECOVERY_RESYNC" | "INCIDENT_SKIP_QUARANTINED" | "INCIDENT_ROUTINE_PAUSE" | "INCIDENT_CONTAIN" | "RUN_QUARANTINE" | "RUN_REPLAY" | "RUN_COMPENSATE" | "INCIDENT_RECOVERY" | "INCIDENT_CLOSE" | "BACKLOG_CREATE" | "BACKLOG_UPDATE" | "BACKLOG_TICKET_OPEN" | "BACKLOG_RELEASE_LINK" | "OUTCOME_EXPORT" | "COST_SIMULATE" | "TOKEN_BUDGET_UPDATE";
        /** GovernedCommandRestartRequest */
        GovernedCommandRestartRequest: {
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Evidencerefs */
            evidenceRefs: string[];
            /** Expectedversion */
            expectedVersion: number;
            /** Reason */
            reason: string;
        };
        /**
         * GovernedCommandState
         * @enum {string}
         */
        GovernedCommandState: "AWAITING_APPROVAL" | "QUEUED" | "RUNNING" | "PARTIAL" | "SUCCEEDED" | "FAILED" | "REJECTED" | "CANCELLED" | "ROLLED_BACK";
        /** GovernedCommandTransitionRequest */
        GovernedCommandTransitionRequest: {
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Evidencerefs */
            evidenceRefs: string[];
            /** Expectedversion */
            expectedVersion: number;
            /** Reason */
            reason: string;
        };
        /** GovernedCommandsEnvelope */
        GovernedCommandsEnvelope: {
            data: components["schemas"]["GovernedCommandsSnapshot"];
            /**
             * Message
             * @default DWAI-ON governed commands loaded.
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
        /** GovernedCommandsSnapshot */
        GovernedCommandsSnapshot: {
            /** Commands */
            commands: components["schemas"]["GovernedCommand"][];
            /**
             * Generatedat
             * Format: date-time
             */
            generatedAt: string;
        };
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail?: components["schemas"]["ValidationError"][];
        };
        /** ImprovementBacklogItem */
        ImprovementBacklogItem: {
            /** Itemid */
            itemId: string;
            /** Linkedrelease */
            linkedRelease?: string | null;
            /** Metricevidence */
            metricEvidence: string;
            /** Ownerteam */
            ownerTeam: string;
            /** Priority */
            priority: string;
            /** Problemcluster */
            problemCluster: string;
            /** State */
            state: string;
            /** Targetvalue */
            targetValue?: string | null;
            /** Title */
            title: string;
            /** Version */
            version: number;
        };
        /** IncidentSummary */
        IncidentSummary: {
            /** Affectedruncount */
            affectedRunCount: number;
            /** Affectedusercount */
            affectedUserCount?: number | null;
            /** Correlationid */
            correlationId: string;
            /** Incidentid */
            incidentId: string;
            /**
             * Openedat
             * Format: date-time
             */
            openedAt: string;
            /** Ownerref */
            ownerRef?: string | null;
            /** Scope */
            scope: string;
            /** Severity */
            severity: string;
            /** State */
            state: string;
            /** Timeline */
            timeline: components["schemas"]["IncidentTimelineEvent"][];
            /** Title */
            title: string;
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
            /** Version */
            version: number;
        };
        /** IncidentTimelineEvent */
        IncidentTimelineEvent: {
            /** Actorref */
            actorRef?: string | null;
            /** Eventid */
            eventId: string;
            /** Evidencerefs */
            evidenceRefs: string[];
            /**
             * Occurredat
             * Format: date-time
             */
            occurredAt: string;
            /** Summary */
            summary: string;
            /** Type */
            type: string;
        };
        /** IncidentsSnapshot */
        IncidentsSnapshot: {
            capability: components["schemas"]["ControlPlaneCapability"];
            /**
             * Generatedat
             * Format: date-time
             */
            generatedAt: string;
            /** Incidents */
            incidents: components["schemas"]["IncidentSummary"][];
            /** Quarantinedruncount */
            quarantinedRunCount: number;
            /** Recoveryapprovalcount */
            recoveryApprovalCount: number;
        };
        JsonValue: unknown;
        /** LatestRoutingSimulation */
        LatestRoutingSimulation: {
            /** Currency */
            currency: string;
            /**
             * Decision
             * @enum {string}
             */
            decision: "ROUTED" | "BLOCKED" | "REVIEW_REQUIRED";
            /** Estimatedcost */
            estimatedCost?: number | null;
            /** Estimatedlatencyms */
            estimatedLatencyMs?: number | null;
            /** Fallbackmodelids */
            fallbackModelIds: string[];
            /**
             * Generatedat
             * Format: date-time
             */
            generatedAt: string;
            /** Matchedruleid */
            matchedRuleId: string;
            /** Simulationid */
            simulationId: string;
            /** Targetmodelid */
            targetModelId: string | null;
        };
        /** LegalHoldDirective */
        LegalHoldDirective: {
            /** Authorityreference */
            authorityReference: string;
            /** Dposubjectid */
            dpoSubjectId: string;
            /**
             * Effectiveat
             * Format: date-time
             */
            effectiveAt: string;
            /** Expiresat */
            expiresAt?: string | null;
            /** Reasoncode */
            reasonCode: string;
        };
        /** LegalHoldEvidence */
        LegalHoldEvidence: {
            /** Authorityreference */
            authorityReference?: string | null;
            /** Available */
            available: boolean;
            domain: components["schemas"]["DomainKey"];
            /** Dposubjectid */
            dpoSubjectId?: string | null;
            /** Effectiveat */
            effectiveAt?: string | null;
            /** Expiresat */
            expiresAt?: string | null;
            /** Holdid */
            holdId?: string | null;
            /** Reasoncode */
            reasonCode: string;
            /** State */
            state?: string | null;
        };
        /**
         * MeasurementFreshness
         * @enum {string}
         */
        MeasurementFreshness: "CURRENT" | "STALE" | "UNAVAILABLE";
        /** MemoryEnvelope */
        MemoryEnvelope: {
            data: components["schemas"]["PersonalMemory"];
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
        /** MemoryEvidenceCapabilities */
        MemoryEvidenceCapabilities: {
            aiDerivedMemory?: components["schemas"]["WorkflowCapability"];
            confidenceScoring?: components["schemas"]["WorkflowCapability"];
            factVector?: components["schemas"]["WorkflowCapability"];
            kmsBinding?: components["schemas"]["WorkflowCapability"];
            manualProvenance?: components["schemas"]["WorkflowCapability"];
            usageMetrics?: components["schemas"]["WorkflowCapability"];
            usageTrail?: components["schemas"]["WorkflowCapability"];
        };
        /**
         * MemoryKind
         * @enum {string}
         */
        MemoryKind: "RESPONSE_LENGTH" | "OUTPUT_FORMAT" | "TONE" | "WORKING_STYLE";
        /** MemoryListEnvelope */
        MemoryListEnvelope: {
            /** Data */
            data: components["schemas"]["PersonalMemory"][];
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
         * MemoryOrigin
         * @enum {string}
         */
        MemoryOrigin: "MANUAL";
        /**
         * MemoryPreferenceState
         * @enum {string}
         */
        MemoryPreferenceState: "UNSET" | "DISABLED" | "ENABLED";
        /**
         * MemoryScope
         * @enum {string}
         */
        MemoryScope: "ASK" | "RESEARCH" | "PROPOSALS" | "ROUTINES" | "ARTIFACTS";
        /**
         * MemoryState
         * @enum {string}
         */
        MemoryState: "ACTIVE" | "DISABLED" | "EXPIRED" | "DELETED";
        /** ModelRoutePolicy */
        ModelRoutePolicy: {
            /** Availabilityobservedat */
            availabilityObservedAt?: string | null;
            /** @default UNVERIFIED */
            availabilityState: components["schemas"]["ExternalDataState"];
            /** Model */
            model: string;
            /** Provider */
            provider: string;
            /** Region */
            region?: string | null;
        };
        /**
         * ModelRouteState
         * @enum {string}
         */
        ModelRouteState: "COMPLETED" | "NOT_INVOKED" | "CONFIGURATION_REQUIRED" | "REFUSED";
        /** ModelSummary */
        ModelSummary: {
            /** Alloweddataclassifications */
            allowedDataClassifications: string[];
            /** Contextwindow */
            contextWindow?: number | null;
            /** Costpermillioninputtokens */
            costPerMillionInputTokens?: number | null;
            /** Costpermillionoutputtokens */
            costPerMillionOutputTokens?: number | null;
            /** Credentialref */
            credentialRef: string;
            /** Credentialstate */
            credentialState: string;
            /** Displayname */
            displayName: string;
            /** Governancepolicy */
            governancePolicy: string;
            /** Lifecycle */
            lifecycle: string;
            /** Modalities */
            modalities: string[];
            /** Modelid */
            modelId: string;
            /** Providerid */
            providerId: string;
            /** Qualityscore */
            qualityScore?: number | null;
            /** Region */
            region: string;
        };
        /** ModelsRoutingSnapshot */
        ModelsRoutingSnapshot: {
            /** Activecanarycount */
            activeCanaryCount: number;
            capability: components["schemas"]["ControlPlaneCapability"];
            /** Emergencystopactive */
            emergencyStopActive: boolean;
            /**
             * Generatedat
             * Format: date-time
             */
            generatedAt: string;
            latestSimulation: components["schemas"]["LatestRoutingSimulation"] | null;
            /** Models */
            models: components["schemas"]["ModelSummary"][];
            /** Monthlybudget */
            monthlyBudget?: number | null;
            /** Monthlyspend */
            monthlySpend?: number | null;
            /** Pendingapprovalcount */
            pendingApprovalCount: number;
            /** Providers */
            providers: components["schemas"]["ProviderSummary"][];
            /** Routingpolicies */
            routingPolicies: components["schemas"]["RoutingPolicySummary"][];
            /** Routingrules */
            routingRules: components["schemas"]["RoutingRule"][];
        };
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
        /**
         * OperationalHealth
         * @enum {string}
         */
        OperationalHealth: "HEALTHY" | "DEGRADED" | "FAILED" | "UNKNOWN";
        /** OutcomeCohort */
        OutcomeCohort: {
            /** Cohortkey */
            cohortKey: string;
            /** Completedworkcount */
            completedWorkCount: number;
            /** Completionrate */
            completionRate?: number | null;
            /** Costpercompletedwork */
            costPerCompletedWork?: number | null;
            /** Label */
            label: string;
            /** Reworkrate */
            reworkRate?: number | null;
            /** Rollbackrate */
            rollbackRate?: number | null;
        };
        /** OutcomeMetric */
        OutcomeMetric: {
            /** Denominator */
            denominator?: number | null;
            /**
             * Freshnessat
             * Format: date-time
             */
            freshnessAt: string;
            /** Label */
            label: string;
            /** Metrickey */
            metricKey: string;
            /** Previousvalue */
            previousValue?: number | null;
            /** Unit */
            unit: string;
            /** Value */
            value?: number | null;
        };
        /** OutcomesSnapshot */
        OutcomesSnapshot: {
            /** Backlog */
            backlog: components["schemas"]["ImprovementBacklogItem"][];
            capability: components["schemas"]["ControlPlaneCapability"];
            /** Cohorts */
            cohorts: components["schemas"]["OutcomeCohort"][];
            /** Currency */
            currency: string;
            /**
             * Generatedat
             * Format: date-time
             */
            generatedAt: string;
            /** Metrics */
            metrics: components["schemas"]["OutcomeMetric"][];
            /** Perioddays */
            periodDays: number;
            /** Privacythreshold */
            privacyThreshold: number;
            /** Suppressedcohortcount */
            suppressedCohortCount: number;
            /** Tokenbudgets */
            tokenBudgets: components["schemas"]["TokenBudgetSummary"][];
        };
        /** PersonalAiControls */
        PersonalAiControls: {
            /**
             * Automaticmemoryinference
             * @default false
             */
            automaticMemoryInference: boolean;
            /**
             * Backgroundcredentialstorage
             * @default false
             */
            backgroundCredentialStorage: boolean;
            evidenceCapabilities?: components["schemas"]["MemoryEvidenceCapabilities"];
            /**
             * Explicitmemorystorageavailable
             * @default true
             */
            explicitMemoryStorageAvailable: boolean;
            /**
             * Externalactionwithoutapproval
             * @default false
             */
            externalActionWithoutApproval: boolean;
            /** Memoryeffective */
            memoryEffective: boolean;
            /** Memoryenabled */
            memoryEnabled: boolean;
            memoryState: components["schemas"]["MemoryPreferenceState"];
            /** Revision */
            revision: number;
            /**
             * Runtimeapplicationavailable
             * @default true
             */
            runtimeApplicationAvailable: boolean;
            /**
             * Runtimeapplicationenabled
             * @default false
             */
            runtimeApplicationEnabled: boolean;
            /** @default UNSET */
            runtimeApplicationState: components["schemas"]["MemoryPreferenceState"];
            /**
             * Sensitivememoryallowed
             * @default false
             */
            sensitiveMemoryAllowed: boolean;
            /** Sourcepreferences */
            sourcePreferences?: components["schemas"]["AiSourcePreference"][];
            /**
             * Teammemoryavailable
             * @default false
             */
            teamMemoryAvailable: boolean;
            /** Updatedat */
            updatedAt?: string | null;
        };
        /** PersonalAiControlsEnvelope */
        PersonalAiControlsEnvelope: {
            data: components["schemas"]["PersonalAiControls"];
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
        /** PersonalDataGovernanceCapabilities */
        PersonalDataGovernanceCapabilities: {
            /**
             * Activestorecryptoshredavailable
             * @default false
             */
            activeStoreCryptoShredAvailable: boolean;
            /**
             * Activestorephysicalpurgeavailable
             * @default false
             */
            activeStorePhysicalPurgeAvailable: boolean;
            /**
             * Analysisreceiptclearavailable
             * @default false
             */
            analysisReceiptClearAvailable: boolean;
            /**
             * Auditmetadatamayberetained
             * @default true
             */
            auditMetadataMayBeRetained: boolean;
            backupDestructionLog: components["schemas"]["WorkflowCapability"];
            /**
             * Backupdispositionavailable
             * @default false
             */
            backupDispositionAvailable: boolean;
            /**
             * Backupdispositionstate
             * @default EXTERNAL_RETENTION_BOUNDARY
             */
            backupDispositionState: string;
            /**
             * Deletioncompletionclaimavailable
             * @default false
             */
            deletionCompletionClaimAvailable: boolean;
            /**
             * Deletionexecutionavailable
             * @default false
             */
            deletionExecutionAvailable: boolean;
            /**
             * Deletionexecutionscope
             * @default AGENT_ACTIVE_POSTGRES_DOMAINS_ONLY
             */
            deletionExecutionScope: string;
            /**
             * Deletionrequestavailable
             * @default true
             */
            deletionRequestAvailable: boolean;
            legalHoldAppeal: components["schemas"]["WorkflowCapability"];
            legalHoldEvidence: components["schemas"]["WorkflowCapability"];
            /**
             * Proposalclearmanagedseparately
             * @default true
             */
            proposalClearManagedSeparately: boolean;
            /**
             * Proposalclearroute
             * @default /v1/proposals/clear
             */
            proposalClearRoute: string;
            siemSync: components["schemas"]["WorkflowCapability"];
            signedCertificate: components["schemas"]["WorkflowCapability"];
            /**
             * Sourcesystemdataaffected
             * @default false
             */
            sourceSystemDataAffected: boolean;
            sreSupport: components["schemas"]["WorkflowCapability"];
            /** Supporteddeletiondomains */
            supportedDeletionDomains?: components["schemas"]["DomainKey"][];
        };
        /** PersonalDataGovernanceCapabilitiesEnvelope */
        PersonalDataGovernanceCapabilitiesEnvelope: {
            data: components["schemas"]["PersonalDataGovernanceCapabilities"];
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
        /** PersonalMemory */
        PersonalMemory: {
            /** Confidence */
            confidence?: number | null;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /** Encryptionkeyreferencefingerprint */
            encryptionKeyReferenceFingerprint?: string | null;
            /** Encryptionkeyversion */
            encryptionKeyVersion?: string | null;
            /** Encryptionprovider */
            encryptionProvider?: string | null;
            /** Expiresat */
            expiresAt?: string | null;
            /** Factvector */
            factVector?: string[];
            kind: components["schemas"]["MemoryKind"];
            /** Lastusedat */
            lastUsedAt?: string | null;
            memory: components["schemas"]["ExplicitMemoryValue"];
            /**
             * Memoryid
             * Format: uuid
             */
            memoryId: string;
            /** @default MANUAL */
            origin: components["schemas"]["MemoryOrigin"];
            /** Revision */
            revision: number;
            /** Scope */
            scope?: components["schemas"]["MemoryScope"][];
            /**
             * Sourcetype
             * @default USER_EXPLICIT_ENTRY
             */
            sourceType: string;
            state: components["schemas"]["MemoryState"];
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
            /**
             * Usecount
             * @default 0
             */
            useCount: number;
        };
        /** PersonalRoutine */
        PersonalRoutine: {
            capabilities?: components["schemas"]["RoutineCapabilities"];
            consentState: components["schemas"]["RoutineConsentState"];
            consents: components["schemas"]["RoutineConsentSet"];
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            definition: components["schemas"]["RoutineDefinition"];
            /** @default DRY_RUN_ONLY */
            executionMode: components["schemas"]["RoutineExecutionMode"];
            lifecycleState: components["schemas"]["RoutineLifecycle"];
            /** Nextrunat */
            nextRunAt?: string | null;
            /** Revision */
            revision: number;
            /**
             * Routineid
             * Format: uuid
             */
            routineId: string;
            /**
             * Schedulingavailable
             * @default false
             */
            schedulingAvailable: boolean;
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
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
        /** PreflightChange */
        PreflightChange: {
            /** After */
            after: string;
            /** Before */
            before: string;
            /** Field */
            field: string;
        };
        /** ProposalAnalysisEnvelope */
        ProposalAnalysisEnvelope: {
            data: components["schemas"]["ProposalAnalysisReceipt"];
            /**
             * Message
             * @default Workspace signals analyzed.
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
        /** ProposalAnalysisPreference */
        ProposalAnalysisPreference: {
            /** Proactiveanalysisenabled */
            proactiveAnalysisEnabled: boolean;
            /** Revision */
            revision: number;
            /** Updatedat */
            updatedAt?: string | null;
        };
        /** ProposalAnalysisPreferenceEnvelope */
        ProposalAnalysisPreferenceEnvelope: {
            data: components["schemas"]["ProposalAnalysisPreference"];
            /**
             * Message
             * @default Proposal analysis preference loaded.
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
        /** ProposalAnalysisReceipt */
        ProposalAnalysisReceipt: {
            /** Actionableproposals */
            actionableProposals: number;
            /**
             * Analyzedat
             * Format: date-time
             */
            analyzedAt: string;
            /** Attemptedsources */
            attemptedSources: string[];
            /** Proposals */
            proposals: components["schemas"]["AgentProposal"][];
            /** Sourcesanalyzed */
            sourcesAnalyzed: number;
            /** Unavailablesources */
            unavailableSources: string[];
        };
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
            /** Route */
            route?: string | null;
            /** Sourcetype */
            sourceType: string;
        };
        /** ProposalHandoff */
        ProposalHandoff: {
            /** Actionkey */
            actionKey: string;
            /** Approvalrequired */
            approvalRequired: boolean;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /**
             * Handoffid
             * Format: uuid
             */
            handoffId: string;
            /**
             * Proposalid
             * Format: uuid
             */
            proposalId: string;
            /** Receiptid */
            receiptId?: string | null;
            state: components["schemas"]["ProposalHandoffState"];
            /** Targetroute */
            targetRoute: string;
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
            /** Version */
            version: number;
        };
        /** ProposalHandoffEnvelope */
        ProposalHandoffEnvelope: {
            data: components["schemas"]["ProposalHandoff"];
            /**
             * Message
             * @default Proposal handoff prepared.
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
         * ProposalHandoffState
         * @enum {string}
         */
        ProposalHandoffState: "REVIEW_REQUIRED" | "AWAITING_APPROVAL" | "HANDED_OFF" | "RUNNING" | "PARTIAL" | "COMPLETED" | "FAILED" | "CANCELLED" | "COMPENSATING" | "COMPENSATED";
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
        /** ProviderSummary */
        ProviderSummary: {
            /** Activemodelcount */
            activeModelCount: number;
            health: components["schemas"]["OperationalHealth"];
            /** Kind */
            kind: string;
            /** Latencyp95Ms */
            latencyP95Ms?: number | null;
            /** Name */
            name: string;
            /** Providerid */
            providerId: string;
            /** Region */
            region?: string | null;
            /** Successrate */
            successRate?: number | null;
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
        };
        /** PublishArtifactRequest */
        PublishArtifactRequest: {
            /** Changereason */
            changeReason: string;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedrevision */
            expectedRevision: number;
            /**
             * Preflightid
             * Format: uuid
             */
            preflightId: string;
            /** Reasoncode */
            reasonCode: string;
            /** Versionnumber */
            versionNumber: number;
        };
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
        /** ReplyTeamArtifactCommentRequest */
        ReplyTeamArtifactCommentRequest: {
            /** Body */
            body: string;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedrevision */
            expectedRevision: number;
            /** Reasoncode */
            reasonCode: string;
        };
        /** RequestDeletionRequest */
        RequestDeletionRequest: {
            /** Changereason */
            changeReason: string;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Domains */
            domains: components["schemas"]["DomainKey"][];
            /** Expectedrevision */
            expectedRevision: number;
            /** Reasoncode */
            reasonCode: string;
        };
        /** ResearchBudget */
        ResearchBudget: {
            /** Maximumminutes */
            maximumMinutes: number;
            /** Maximumsources */
            maximumSources: number;
            /** Maximumtokens */
            maximumTokens: number;
        };
        /** ResearchCapabilities */
        ResearchCapabilities: {
            auditDownload: components["schemas"]["WorkflowCapability"];
            cacheFallback: components["schemas"]["WorkflowCapability"];
            fork: components["schemas"]["WorkflowCapability"];
            keepLocal: components["schemas"]["WorkflowCapability"];
            merge: components["schemas"]["WorkflowCapability"];
            pdfExport: components["schemas"]["WorkflowCapability"];
            rawExport: components["schemas"]["WorkflowCapability"];
            receiptDownload: components["schemas"]["WorkflowCapability"];
            sensitivityRecalculation: components["schemas"]["WorkflowCapability"];
        };
        /** ResearchCapabilitiesEnvelope */
        ResearchCapabilitiesEnvelope: {
            data: components["schemas"]["ResearchCapabilities"];
            /**
             * Message
             * @default Research capabilities loaded.
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
        /** ResearchDelivery */
        ResearchDelivery: {
            /** Completedat */
            completedAt?: string | null;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /**
             * Deliveryid
             * Format: uuid
             */
            deliveryId: string;
            deliveryType: components["schemas"]["ResearchDeliveryType"];
            /** Receiptid */
            receiptId?: string | null;
            /**
             * Runid
             * Format: uuid
             */
            runId: string;
            state: components["schemas"]["ResearchDeliveryState"];
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
        };
        /** ResearchDeliveryEnvelope */
        ResearchDeliveryEnvelope: {
            data: components["schemas"]["ResearchDelivery"];
            /**
             * Message
             * @default Research delivery requested.
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
        /** ResearchDeliveryListEnvelope */
        ResearchDeliveryListEnvelope: {
            /** Data */
            data: components["schemas"]["ResearchDelivery"][];
            /**
             * Message
             * @default Research deliveries loaded.
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
         * ResearchDeliveryState
         * @enum {string}
         */
        ResearchDeliveryState: "QUEUED" | "AWAITING_APPROVAL" | "RUNNING" | "PARTIAL" | "COMPLETED" | "FAILED" | "CANCELLED";
        /**
         * ResearchDeliveryType
         * @enum {string}
         */
        ResearchDeliveryType: "ARTIFACT" | "PROPOSAL" | "EXPORT" | "HANDOFF" | "SHARE" | "ROUTINE";
        /** ResearchPlan */
        ResearchPlan: {
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            definition: components["schemas"]["ResearchPlanDefinition"];
            /**
             * Planid
             * Format: uuid
             */
            planId: string;
            /** Revision */
            revision: number;
            state: components["schemas"]["ResearchPlanState"];
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
        };
        /** ResearchPlanDefinition */
        ResearchPlanDefinition: {
            budget: components["schemas"]["ResearchBudget"];
            /** Deliverabletypes */
            deliverableTypes: string[];
            /** Goal */
            goal: string;
            /** Question */
            question: string;
            /**
             * Requireallallowedsources
             * @default false
             */
            requireAllAllowedSources: boolean;
            /** Sourcepolicies */
            sourcePolicies: components["schemas"]["ResearchSourcePolicy"][];
            /** Successcriteria */
            successCriteria: string[];
        };
        /** ResearchPlanEnvelope */
        ResearchPlanEnvelope: {
            data: components["schemas"]["ResearchPlan"];
            /**
             * Message
             * @default Research plan loaded.
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
         * ResearchPlanState
         * @enum {string}
         */
        ResearchPlanState: "DRAFT" | "READY" | "ARCHIVED";
        /** ResearchProgress */
        ResearchProgress: {
            /** Completedsteps */
            completedSteps: number;
            /** Discoveredsources */
            discoveredSources: number;
            /** Failedsources */
            failedSources?: string[];
            /** Recoveryhint */
            recoveryHint?: string | null;
            /** Totalsteps */
            totalSteps: number;
            /** Verifiedcitations */
            verifiedCitations: number;
        };
        /** ResearchRawDownload */
        ResearchRawDownload: {
            /**
             * Completedat
             * Format: date-time
             */
            completedAt: string;
            /** Integrityfingerprint */
            integrityFingerprint: string;
            /**
             * Planid
             * Format: uuid
             */
            planId: string;
            /** Planrevision */
            planRevision: number;
            result: components["schemas"]["ResearchResult"];
            /**
             * Runid
             * Format: uuid
             */
            runId: string;
            /**
             * Schemaversion
             * @default 1
             * @constant
             */
            schemaVersion: 1;
        };
        /** ResearchReceiptDownload */
        ResearchReceiptDownload: {
            /** Citationcount */
            citationCount: number;
            /**
             * Completedat
             * Format: date-time
             */
            completedAt: string;
            /** Integrityfingerprint */
            integrityFingerprint: string;
            /**
             * Planid
             * Format: uuid
             */
            planId: string;
            /** Planrevision */
            planRevision: number;
            /**
             * Receiptid
             * Format: uuid
             */
            receiptId: string;
            /** Resultsha256 */
            resultSha256: string;
            /**
             * Runid
             * Format: uuid
             */
            runId: string;
            /**
             * Schemaversion
             * @default 1
             * @constant
             */
            schemaVersion: 1;
        };
        /** ResearchResult */
        ResearchResult: {
            /** Citations */
            citations: components["schemas"]["AttachmentCitation"][];
            /** Reportmarkdown */
            reportMarkdown: string;
            /** Resultsha256 */
            resultSha256: string;
        };
        /** ResearchRun */
        ResearchRun: {
            /** Completedat */
            completedAt?: string | null;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /**
             * Planid
             * Format: uuid
             */
            planId: string;
            /** Planrevision */
            planRevision: number;
            progress: components["schemas"]["ResearchProgress"];
            /** Receiptid */
            receiptId?: string | null;
            result?: components["schemas"]["ResearchResult"] | null;
            /**
             * Runid
             * Format: uuid
             */
            runId: string;
            /** Safeerrorcode */
            safeErrorCode?: string | null;
            /** Startedat */
            startedAt?: string | null;
            state: components["schemas"]["ResearchRunState"];
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
            /** Version */
            version: number;
        };
        /**
         * ResearchRunCommandAction
         * @enum {string}
         */
        ResearchRunCommandAction: "PAUSE" | "RESUME" | "EXCLUDE_SOURCE_AND_CONTINUE" | "REPROBE_SOURCE" | "SAFE_CANCEL" | "EXTEND";
        /** ResearchRunCommandRequest */
        ResearchRunCommandRequest: {
            action: components["schemas"]["ResearchRunCommandAction"];
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedversion */
            expectedVersion: number;
            /** Extensionminutes */
            extensionMinutes?: number | null;
            /** Reason */
            reason: string;
            /** Sourcekey */
            sourceKey?: string | null;
        };
        /** ResearchRunEnvelope */
        ResearchRunEnvelope: {
            data: components["schemas"]["ResearchRun"];
            /**
             * Message
             * @default Research run loaded.
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
         * ResearchRunState
         * @enum {string}
         */
        ResearchRunState: "QUEUED" | "RUNNING" | "PAUSED" | "PARTIAL" | "CONFLICT" | "CANCELLING" | "CANCELLED" | "FAILED" | "COMPLETED";
        /** ResearchSourcePolicy */
        ResearchSourcePolicy: {
            /** Allowed */
            allowed: boolean;
            /** Scope */
            scope: string;
            /** Sourcekey */
            sourceKey: string;
        };
        /** ResolveTeamArtifactCommentRequest */
        ResolveTeamArtifactCommentRequest: {
            /** Changereason */
            changeReason: string;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedrevision */
            expectedRevision: number;
            /** Reasoncode */
            reasonCode: string;
        };
        /** ResolveTeamArtifactConflictRequest */
        ResolveTeamArtifactConflictRequest: {
            /** Changereason */
            changeReason: string;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedrevision */
            expectedRevision: number;
            mergedContent?: components["schemas"]["ArtifactDraftContent"] | null;
            /** Reasoncode */
            reasonCode: string;
            resolution: components["schemas"]["TeamArtifactConflictResolution"];
        };
        /** RetentionPoliciesEnvelope */
        RetentionPoliciesEnvelope: {
            /** Data */
            data: components["schemas"]["dwp_agent__governed_domain_contracts__RetentionPolicy"][];
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
        /** RetryDeletionRequest */
        RetryDeletionRequest: {
            /** Changereason */
            changeReason: string;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedrevision */
            expectedRevision: number;
            /** Reasoncode */
            reasonCode: string;
        };
        /** RevokeTeamArtifactShareRequest */
        RevokeTeamArtifactShareRequest: {
            /** Changereason */
            changeReason: string;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedrevision */
            expectedRevision: number;
            /** Reasoncode */
            reasonCode: string;
        };
        /**
         * RiskTier
         * @enum {string}
         */
        RiskTier: "L0" | "L1" | "L2" | "L3";
        /** RollbackRoutineVersionRequest */
        RollbackRoutineVersionRequest: {
            /** Changereason */
            changeReason: string;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedrevision */
            expectedRevision: number;
            /** Reasoncode */
            reasonCode: string;
        };
        /**
         * RoutineActivationAction
         * @enum {string}
         */
        RoutineActivationAction: "ACTIVATE" | "DEACTIVATE";
        /** RoutineBudget */
        RoutineBudget: {
            /**
             * Maximumminutesperrun
             * @default 15
             */
            maximumMinutesPerRun: number;
            /**
             * Maximumrunspermonth
             * @default 31
             */
            maximumRunsPerMonth: number;
            /**
             * Maximumtokensperrun
             * @default 32000
             */
            maximumTokensPerRun: number;
        };
        /**
         * RoutineCadence
         * @enum {string}
         */
        RoutineCadence: "DAILY" | "WEEKDAYS" | "WEEKLY";
        /** RoutineCapabilities */
        RoutineCapabilities: {
            /**
             * Activationavailable
             * @default false
             */
            activationAvailable: boolean;
            /**
             * Activewindowpreviewavailable
             * @default true
             */
            activeWindowPreviewAvailable: boolean;
            agentKernelBinding: components["schemas"]["WorkflowCapability"];
            agentSwitching: components["schemas"]["WorkflowCapability"];
            automaticQuarantine: components["schemas"]["WorkflowCapability"];
            /**
             * Backgroundexecutionavailable
             * @default false
             */
            backgroundExecutionAvailable: boolean;
            blockedSourcePolicy: components["schemas"]["WorkflowCapability"];
            changeApproval: components["schemas"]["WorkflowCapability"];
            /** Consentscopes */
            consentScopes?: components["schemas"]["RoutineConsentScope"][];
            /**
             * Costbudgetavailable
             * @default false
             */
            costBudgetAvailable: boolean;
            /**
             * Dryrunavailable
             * @default true
             */
            dryRunAvailable: boolean;
            /**
             * Executionproviderstate
             * @default NOT_CONFIGURED
             */
            executionProviderState: string;
            /**
             * Externalwriteavailable
             * @default false
             */
            externalWriteAvailable: boolean;
            /**
             * Holidaypolicyavailable
             * @default false
             */
            holidayPolicyAvailable: boolean;
            /**
             * Lifecyclemode
             * @default GOVERNED_SCHEDULED_OR_WEBHOOK_EXECUTION
             */
            lifecycleMode: string;
            /**
             * Notificationdeliveryavailable
             * @default false
             */
            notificationDeliveryAvailable: boolean;
            oauthReauthorization: components["schemas"]["WorkflowCapability"];
            /**
             * Onetimescheduleavailable
             * @default false
             */
            oneTimeScheduleAvailable: boolean;
            operatorEscalation: components["schemas"]["WorkflowCapability"];
            /**
             * Pauseresumeavailable
             * @default true
             */
            pauseResumeAvailable: boolean;
            /**
             * Proposaldeliveryavailable
             * @default false
             */
            proposalDeliveryAvailable: boolean;
            providerRollback: components["schemas"]["WorkflowCapability"];
            /**
             * Quiethoursdeliveryenforcementavailable
             * @default false
             */
            quietHoursDeliveryEnforcementAvailable: boolean;
            /**
             * Quiethourspreviewavailable
             * @default true
             */
            quietHoursPreviewAvailable: boolean;
            /**
             * Recoveryhint
             * @default Configure and start the governed routine execution broker.
             */
            recoveryHint: string | null;
            /**
             * Runtimebudgetavailable
             * @default false
             */
            runtimeBudgetAvailable: boolean;
            runtimeBudgetRetry: components["schemas"]["WorkflowCapability"];
            /**
             * Schedulingavailable
             * @default false
             */
            schedulingAvailable: boolean;
            semanticVersionDiff: components["schemas"]["WorkflowCapability"];
            /** Supportedcadences */
            supportedCadences?: components["schemas"]["RoutineCadence"][];
            temporaryBudgetIncrease: components["schemas"]["WorkflowCapability"];
            /**
             * Webhooktriggeravailable
             * @default false
             */
            webhookTriggerAvailable: boolean;
            whitelistedSourceBinding: components["schemas"]["WorkflowCapability"];
            wormDelivery: components["schemas"]["WorkflowCapability"];
            zeroWritePolicy: components["schemas"]["WorkflowCapability"];
        };
        /** RoutineCapabilitiesEnvelope */
        RoutineCapabilitiesEnvelope: {
            data: components["schemas"]["RoutineCapabilities"];
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
        /** RoutineCompensationPolicy */
        RoutineCompensationPolicy: {
            /**
             * Enabled
             * @default true
             */
            enabled: boolean;
            /** @default REVOKE_PENDING_HANDOFFS */
            strategy: components["schemas"]["RoutineCompensationStrategy"];
        };
        /**
         * RoutineCompensationStrategy
         * @enum {string}
         */
        RoutineCompensationStrategy: "REVOKE_PENDING_HANDOFFS" | "PROVIDER_MANAGED";
        /**
         * RoutineConsentScope
         * @enum {string}
         */
        RoutineConsentScope: "SOURCE_ACCESS" | "ANALYSIS" | "PROPOSAL_DELIVERY";
        /** RoutineConsentSet */
        RoutineConsentSet: {
            analysis: components["schemas"]["RoutineConsentState"];
            proposalDelivery: components["schemas"]["RoutineConsentState"];
            sourceAccess: components["schemas"]["RoutineConsentState"];
        };
        /**
         * RoutineConsentState
         * @enum {string}
         */
        RoutineConsentState: "UNSET" | "DISABLED" | "ENABLED" | "RECONSENT_REQUIRED";
        /** RoutineDefinition */
        RoutineDefinition: {
            /** Activefrom */
            activeFrom?: string | null;
            /** Activeuntil */
            activeUntil?: string | null;
            budget?: components["schemas"]["RoutineBudget"];
            cadence?: components["schemas"]["RoutineCadence"] | null;
            compensationPolicy?: components["schemas"]["RoutineCompensationPolicy"];
            /** Localtime */
            localTime?: string | null;
            /** Locale */
            locale: string;
            /** Name */
            name: string;
            notificationPolicy?: components["schemas"]["RoutineNotificationPolicy"];
            /** Objective */
            objective: string;
            /** Quiethoursend */
            quietHoursEnd?: string | null;
            /** Quiethoursstart */
            quietHoursStart?: string | null;
            retryPolicy?: components["schemas"]["RoutineRetryPolicy"];
            /** Sources */
            sources: components["schemas"]["RoutineSource"][];
            /** Timezone */
            timeZone?: string | null;
            /** @default SCHEDULED */
            triggerType: components["schemas"]["RoutineTriggerType"];
            /** Webhookendpointreference */
            webhookEndpointReference?: string | null;
            /** Webhookeventtype */
            webhookEventType?: string | null;
            /** Weekdays */
            weekDays?: number[];
        };
        /** RoutineDryRunEnvelope */
        RoutineDryRunEnvelope: {
            data: components["schemas"]["RoutineDryRunReceipt"];
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
        /** RoutineDryRunReceipt */
        RoutineDryRunReceipt: {
            /**
             * Businessevidencecount
             * @default 0
             */
            businessEvidenceCount: number;
            /**
             * Evaluatedat
             * Format: date-time
             */
            evaluatedAt: string;
            /** Evidencecount */
            evidenceCount: number;
            /**
             * Evidencescope
             * @default AUTHORIZED_SOURCE_BINDING
             */
            evidenceScope: string;
            /**
             * Externalwritesperformed
             * @default 0
             */
            externalWritesPerformed: number;
            /**
             * Outcome
             * @default VALIDATED
             */
            outcome: string;
            /** Previewnextrunat */
            previewNextRunAt?: string | null;
            /**
             * Proposalonly
             * @default true
             */
            proposalOnly: boolean;
            /**
             * Proposalscreated
             * @default 0
             */
            proposalsCreated: number;
            /**
             * Routineid
             * Format: uuid
             */
            routineId: string;
            /** Routinerevision */
            routineRevision: number;
            /**
             * Routinerunid
             * Format: uuid
             */
            routineRunId: string;
            /**
             * Schedulingavailable
             * @default false
             */
            schedulingAvailable: boolean;
            /**
             * State
             * @default VALIDATED
             */
            state: string;
            /**
             * Trigger
             * @default DRY_RUN
             */
            trigger: string;
            /** Validatedsources */
            validatedSources: components["schemas"]["RoutineSource"][];
        };
        /** RoutineEnvelope */
        RoutineEnvelope: {
            data: components["schemas"]["PersonalRoutine"];
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
        /** RoutineExecutionEnvelope */
        RoutineExecutionEnvelope: {
            data: components["schemas"]["RoutineExecutionRun"];
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
        /** RoutineExecutionListEnvelope */
        RoutineExecutionListEnvelope: {
            /** Data */
            data: components["schemas"]["RoutineExecutionRun"][];
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
         * RoutineExecutionMode
         * @enum {string}
         */
        RoutineExecutionMode: "DRY_RUN_ONLY" | "SCHEDULED" | "WEBHOOK";
        /** RoutineExecutionReceipt */
        RoutineExecutionReceipt: {
            /** Approvalgatedactionscreated */
            approvalGatedActionsCreated: number;
            /** Authorizationdecisionrevision */
            authorizationDecisionRevision: number;
            /** Authorizedsources */
            authorizedSources: components["schemas"]["RoutineSource"][];
            /**
             * Completedat
             * Format: date-time
             */
            completedAt: string;
            /** Evidencecount */
            evidenceCount: number;
            /**
             * Externalwritesperformed
             * @default 0
             */
            externalWritesPerformed: number;
            notificationState: components["schemas"]["RoutineNotificationState"];
            /** Proposalscreated */
            proposalsCreated: number;
            /** Providerreceiptid */
            providerReceiptId: string;
            /**
             * Receiptid
             * Format: uuid
             */
            receiptId: string;
            /** Resultsha256 */
            resultSha256: string;
            /**
             * Routineid
             * Format: uuid
             */
            routineId: string;
            /** Routinerevision */
            routineRevision: number;
            /**
             * Routinerunid
             * Format: uuid
             */
            routineRunId: string;
            terminalState: components["schemas"]["RoutineRunState"];
        };
        /** RoutineExecutionRun */
        RoutineExecutionRun: {
            /**
             * Approvalgatedactionscreated
             * @default 0
             */
            approvalGatedActionsCreated: number;
            /** Attemptcount */
            attemptCount: number;
            /**
             * Compensationrequired
             * @default false
             */
            compensationRequired: boolean;
            /** Completedat */
            completedAt?: string | null;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /**
             * Elapsedms
             * @default 0
             */
            elapsedMs: number;
            /**
             * Evidencecount
             * @default 0
             */
            evidenceCount: number;
            /** Maximumattempts */
            maximumAttempts: number;
            /** Nextattemptat */
            nextAttemptAt?: string | null;
            /** @default NOT_REQUIRED */
            notificationState: components["schemas"]["RoutineNotificationState"];
            /**
             * Proposalscreated
             * @default 0
             */
            proposalsCreated: number;
            receipt?: components["schemas"]["RoutineExecutionReceipt"] | null;
            /** Recoveryhint */
            recoveryHint?: string | null;
            /**
             * Routineid
             * Format: uuid
             */
            routineId: string;
            /** Routinerevision */
            routineRevision: number;
            /**
             * Routinerunid
             * Format: uuid
             */
            routineRunId: string;
            /** Safeerrorcode */
            safeErrorCode?: string | null;
            /**
             * Scheduledfor
             * Format: date-time
             */
            scheduledFor: string;
            /** Startedat */
            startedAt?: string | null;
            state: components["schemas"]["RoutineRunState"];
            /**
             * Tokensused
             * @default 0
             */
            tokensUsed: number;
            trigger: components["schemas"]["RoutineRunTrigger"];
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
            /** Version */
            version: number;
        };
        /** RoutineHealth */
        RoutineHealth: {
            /** Allconsentsenabled */
            allConsentsEnabled: boolean;
            /**
             * Checkedat
             * Format: date-time
             */
            checkedAt: string;
            /** Latestrunat */
            latestRunAt?: string | null;
            /** Latestrunid */
            latestRunId?: string | null;
            latestRunState?: components["schemas"]["RoutineRunState"] | null;
            /** Recoveryhints */
            recoveryHints?: string[];
            /**
             * Routineid
             * Format: uuid
             */
            routineId: string;
            /** Routinerevision */
            routineRevision: number;
            /** Schedulecurrent */
            scheduleCurrent: boolean;
            state: components["schemas"]["RoutineHealthState"];
            /** Workeravailable */
            workerAvailable: boolean;
        };
        /** RoutineHealthEnvelope */
        RoutineHealthEnvelope: {
            data: components["schemas"]["RoutineHealth"];
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
         * RoutineHealthState
         * @enum {string}
         */
        RoutineHealthState: "HEALTHY" | "DEGRADED" | "BLOCKED";
        /**
         * RoutineLifecycle
         * @enum {string}
         */
        RoutineLifecycle: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
        /**
         * RoutineLifecycleAction
         * @enum {string}
         */
        RoutineLifecycleAction: "PAUSE" | "RESUME";
        /** RoutineListEnvelope */
        RoutineListEnvelope: {
            /** Data */
            data: components["schemas"]["PersonalRoutine"][];
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
        /** RoutineNotificationPolicy */
        RoutineNotificationPolicy: {
            /**
             * Notifyonfailure
             * @default true
             */
            notifyOnFailure: boolean;
            /**
             * Notifyonpartial
             * @default true
             */
            notifyOnPartial: boolean;
            /**
             * Notifyonrecovery
             * @default true
             */
            notifyOnRecovery: boolean;
        };
        /**
         * RoutineNotificationState
         * @enum {string}
         */
        RoutineNotificationState: "NOT_REQUIRED" | "DELIVERED" | "NOT_CONFIGURED" | "FAILED";
        /** RoutineRetryPolicy */
        RoutineRetryPolicy: {
            /**
             * Backoffmultiplier
             * @default 2
             */
            backoffMultiplier: number;
            /**
             * Initialbackoffseconds
             * @default 30
             */
            initialBackoffSeconds: number;
            /**
             * Maximumattempts
             * @default 3
             */
            maximumAttempts: number;
        };
        /** RoutineRollbackEnvelope */
        RoutineRollbackEnvelope: {
            data: components["schemas"]["RoutineRollbackReceipt"];
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
        /** RoutineRollbackReceipt */
        RoutineRollbackReceipt: {
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Createdrevision */
            createdRevision: number;
            /** Integrityfingerprint */
            integrityFingerprint: string;
            /**
             * Rolledbackat
             * Format: date-time
             */
            rolledBackAt: string;
            routine: components["schemas"]["PersonalRoutine"];
            /**
             * Routineid
             * Format: uuid
             */
            routineId: string;
            /** Targetfingerprint */
            targetFingerprint: string;
            /** Targetrevision */
            targetRevision: number;
        };
        /**
         * RoutineRunCommand
         * @enum {string}
         */
        RoutineRunCommand: "RETRY" | "CANCEL" | "COMPENSATE";
        /**
         * RoutineRunState
         * @enum {string}
         */
        RoutineRunState: "QUEUED" | "CLAIMED" | "RUNNING" | "RETRY_SCHEDULED" | "COMPENSATING" | "PARTIAL" | "COMPLETED" | "FAILED" | "CANCELLED" | "COMPENSATED";
        /**
         * RoutineRunTrigger
         * @enum {string}
         */
        RoutineRunTrigger: "SCHEDULED" | "MANUAL" | "WEBHOOK";
        /**
         * RoutineSource
         * @enum {string}
         */
        RoutineSource: "WORK_ITEM" | "MAIL" | "CALENDAR";
        /**
         * RoutineTriggerType
         * @enum {string}
         */
        RoutineTriggerType: "SCHEDULED" | "WEBHOOK";
        /** RoutineVersionListEnvelope */
        RoutineVersionListEnvelope: {
            /** Data */
            data: components["schemas"]["RoutineVersionSnapshot"][];
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
        /** RoutineVersionSnapshot */
        RoutineVersionSnapshot: {
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Commandtype */
            commandType: string;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /** Integrityfingerprint */
            integrityFingerprint: string;
            /** Revision */
            revision: number;
            /** Rollbacktargetfingerprint */
            rollbackTargetFingerprint?: string | null;
            /** Rollbacktargetrevision */
            rollbackTargetRevision?: number | null;
            snapshot: components["schemas"]["PersonalRoutine"];
        };
        /** RoutingPolicySummary */
        RoutingPolicySummary: {
            /** Budgetmode */
            budgetMode: string;
            /** Dailybudget */
            dailyBudget?: number | null;
            /** Fallbackmodelids */
            fallbackModelIds: string[];
            /** Name */
            name: string;
            /** Policyid */
            policyId: string;
            /** Primarymodelid */
            primaryModelId: string;
            /** Scope */
            scope: string;
            /** State */
            state: string;
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
            /** Version */
            version: number;
        };
        /** RoutingRule */
        RoutingRule: {
            /** Alloweddataclassifications */
            allowedDataClassifications: string[];
            /** Conditions */
            conditions: string[];
            /** Failclosed */
            failClosed: boolean;
            /** Fallbackmodelids */
            fallbackModelIds: string[];
            /** Name */
            name: string;
            /** Primarymodelid */
            primaryModelId: string;
            /** Ruleid */
            ruleId: string;
            /** Tasktype */
            taskType: string;
            /** Version */
            version: number;
        };
        /** RunArtifactPreflightRequest */
        RunArtifactPreflightRequest: {
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedrevision */
            expectedRevision: number;
            /** Reasoncode */
            reasonCode: string;
            /** Versionnumber */
            versionNumber: number;
        };
        /**
         * RunAuditEvidenceStatus
         * @enum {string}
         */
        RunAuditEvidenceStatus: "LINKED" | "PENDING" | "NOT_AVAILABLE";
        /**
         * RunDataProvenance
         * @enum {string}
         */
        RunDataProvenance: "LIVE" | "SAMPLE";
        /**
         * RunLeaseStatus
         * @enum {string}
         */
        RunLeaseStatus: "ACTIVE" | "EXPIRED" | "RELEASED";
        /**
         * RunMeasurementStatus
         * @enum {string}
         */
        RunMeasurementStatus: "MEASURING" | "MEASURED" | "PARTIAL" | "NOT_AVAILABLE";
        /**
         * RunSourceHealthStatus
         * @enum {string}
         */
        RunSourceHealthStatus: "SUCCESS" | "UNAVAILABLE" | "NOT_CONFIGURED";
        /**
         * RunStageKey
         * @enum {string}
         */
        RunStageKey: "AUTHORIZING" | "RETRIEVING" | "REASONING" | "VERIFYING" | "PERSISTING" | "COMPLETED" | "FAILED";
        /**
         * RunStageState
         * @enum {string}
         */
        RunStageState: "ACTIVE" | "COMPLETED" | "SKIPPED" | "FAILED";
        /** RunTeamArtifactPreflightRequest */
        RunTeamArtifactPreflightRequest: {
            /** Artifactrevision */
            artifactRevision: number;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /**
             * Excludeinaccessiblesources
             * @default false
             */
            excludeInaccessibleSources: boolean;
            /** Expectedrevision */
            expectedRevision: number;
            /** Members */
            members: components["schemas"]["TeamArtifactMemberRequest"][];
            /** Reasoncode */
            reasonCode: string;
            /** Sources */
            sources?: components["schemas"]["ArtifactSourceReference"][];
            /**
             * Teamid
             * Format: uuid
             */
            teamId: string;
        };
        /**
         * RuntimeControlState
         * @enum {string}
         */
        RuntimeControlState: "ENABLED" | "EMERGENCY_DISABLED" | "POLICY_NOT_CONFIGURED" | "CONTROL_UNAVAILABLE";
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
        /** SecureAttachment */
        SecureAttachment: {
            /**
             * Attachmentid
             * Format: uuid
             */
            attachmentId: string;
            capabilities: components["schemas"]["AttachmentCapabilities"];
            /** Citations */
            citations?: components["schemas"]["AttachmentCitation"][];
            /** Conversationid */
            conversationId?: string | null;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /** Deletedat */
            deletedAt?: string | null;
            /** Filename */
            fileName: string;
            /** Mediatype */
            mediaType: string;
            /**
             * Retentionexpiresat
             * Format: date-time
             */
            retentionExpiresAt: string;
            /** Revision */
            revision: number;
            /** Sizebytes */
            sizeBytes: number;
            /** Sourcesha256 */
            sourceSha256: string;
            /** Stages */
            stages: components["schemas"]["AttachmentStage"][];
            state: components["schemas"]["AttachmentState"];
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
            uploadTicket?: components["schemas"]["AttachmentUploadTicket"] | null;
        };
        /** SetAIEmergencyDisableRequest */
        SetAIEmergencyDisableRequest: {
            /** Changereason */
            changeReason: string;
            /** Disabled */
            disabled: boolean;
            /** Expectedversion */
            expectedVersion: number;
        };
        /** SnapshotEnvelope */
        SnapshotEnvelope: {
            /** Data */
            data: components["schemas"]["ModelsRoutingSnapshot"] | components["schemas"]["ConnectorsSnapshot"] | components["schemas"]["EvaluationSafetySnapshot"] | components["schemas"]["IncidentsSnapshot"] | components["schemas"]["OutcomesSnapshot"];
            /**
             * Message
             * @default DWAI-ON control-plane snapshot loaded.
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
        /** StartResearchRunRequest */
        StartResearchRunRequest: {
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedplanrevision */
            expectedPlanRevision: number;
            /**
             * Idempotencykey
             * Format: uuid
             */
            idempotencyKey: string;
        };
        /** SubmitTeamArtifactEditRequest */
        SubmitTeamArtifactEditRequest: {
            /** Baserevision */
            baseRevision: number;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            content: components["schemas"]["ArtifactDraftContent"];
            /** Expectedrevision */
            expectedRevision: number;
            /** Reasoncode */
            reasonCode: string;
        };
        /** TeamArtifactAccessRequest */
        TeamArtifactAccessRequest: {
            /**
             * Accessrequestid
             * Format: uuid
             */
            accessRequestId: string;
            /**
             * Artifactid
             * Format: uuid
             */
            artifactId: string;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /** Deniedsourcecount */
            deniedSourceCount: number;
            /** Deniedsubjectcount */
            deniedSubjectCount: number;
            /**
             * Preflightid
             * Format: uuid
             */
            preflightId: string;
            state: components["schemas"]["TeamArtifactAccessRequestState"];
            /** Submissionevidencesha256 */
            submissionEvidenceSha256: string;
            /**
             * Teamid
             * Format: uuid
             */
            teamId: string;
        };
        /** TeamArtifactAccessRequestEnvelope */
        TeamArtifactAccessRequestEnvelope: {
            data: components["schemas"]["TeamArtifactAccessRequest"];
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
         * TeamArtifactAccessRequestState
         * @enum {string}
         */
        TeamArtifactAccessRequestState: "PENDING" | "APPROVED" | "DENIED" | "EXPIRED";
        /** TeamArtifactCapabilities */
        TeamArtifactCapabilities: {
            /** Accessrequestavailable */
            accessRequestAvailable: boolean;
            /** Aclpreflightavailable */
            aclPreflightAvailable: boolean;
            automaticMasking: components["schemas"]["WorkflowCapability"];
            /** Collaborationavailable */
            collaborationAvailable: boolean;
            /** Conflictresolutionavailable */
            conflictResolutionAvailable: boolean;
            /**
             * Externalsharingavailable
             * @default false
             */
            externalSharingAvailable: boolean;
            inlineComments: components["schemas"]["WorkflowCapability"];
            /** Internalsharingavailable */
            internalSharingAvailable: boolean;
            /** Providerstate */
            providerState: string;
            /** Recoveryhint */
            recoveryHint?: string | null;
            reviewNotification: components["schemas"]["WorkflowCapability"];
            reviewRejection: components["schemas"]["WorkflowCapability"];
            /** Shareexpiryavailable */
            shareExpiryAvailable: boolean;
            /** Sharerevocationavailable */
            shareRevocationAvailable: boolean;
            signedWormReceipt?: components["schemas"]["WorkflowCapability"];
            stagedReview?: components["schemas"]["WorkflowCapability"];
            syntheticReplacement: components["schemas"]["WorkflowCapability"];
            /** Teamworkspaceavailable */
            teamWorkspaceAvailable: boolean;
        };
        /** TeamArtifactCapabilitiesEnvelope */
        TeamArtifactCapabilitiesEnvelope: {
            data: components["schemas"]["TeamArtifactCapabilities"];
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
        /** TeamArtifactComment */
        TeamArtifactComment: {
            /** Anchor */
            anchor?: string | null;
            /**
             * Artifactid
             * Format: uuid
             */
            artifactId: string;
            /** Authordisplayname */
            authorDisplayName?: string | null;
            /** Authorsubjectid */
            authorSubjectId: string;
            /** Body */
            body: string;
            /**
             * Commentid
             * Format: uuid
             */
            commentId: string;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /** Replies */
            replies?: components["schemas"]["TeamArtifactCommentReply"][];
            /** Resolvedat */
            resolvedAt?: string | null;
            /** Revision */
            revision: number;
            state: components["schemas"]["TeamArtifactCommentState"];
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
            /**
             * Workspaceid
             * Format: uuid
             */
            workspaceId: string;
        };
        /** TeamArtifactCommentEnvelope */
        TeamArtifactCommentEnvelope: {
            data: components["schemas"]["TeamArtifactComment"];
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
        /** TeamArtifactCommentReply */
        TeamArtifactCommentReply: {
            /** Authordisplayname */
            authorDisplayName?: string | null;
            /** Authorsubjectid */
            authorSubjectId: string;
            /** Body */
            body: string;
            /**
             * Commentid
             * Format: uuid
             */
            commentId: string;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /**
             * Replyid
             * Format: uuid
             */
            replyId: string;
        };
        /**
         * TeamArtifactCommentState
         * @enum {string}
         */
        TeamArtifactCommentState: "OPEN" | "RESOLVED";
        /** TeamArtifactCommentsEnvelope */
        TeamArtifactCommentsEnvelope: {
            /** Data */
            data: components["schemas"]["TeamArtifactComment"][];
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
        /** TeamArtifactConflict */
        TeamArtifactConflict: {
            /** Baserevision */
            baseRevision: number;
            /**
             * Conflictid
             * Format: uuid
             */
            conflictId: string;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            localContent: components["schemas"]["ArtifactDraftContent"];
            /** Localsha256 */
            localSha256: string;
            /** Resolvedat */
            resolvedAt?: string | null;
            serverContent: components["schemas"]["ArtifactDraftContent"];
            /** Serverrevision */
            serverRevision: number;
            /** Serversha256 */
            serverSha256: string;
            state: components["schemas"]["TeamArtifactConflictState"];
            /**
             * Workspaceid
             * Format: uuid
             */
            workspaceId: string;
        };
        /**
         * TeamArtifactConflictResolution
         * @enum {string}
         */
        TeamArtifactConflictResolution: "USE_LOCAL" | "USE_SERVER" | "MERGE" | "STASH" | "ROLLBACK";
        /**
         * TeamArtifactConflictState
         * @enum {string}
         */
        TeamArtifactConflictState: "OPEN" | "RESOLVED_LOCAL" | "RESOLVED_SERVER" | "RESOLVED_MERGED" | "STASHED" | "ROLLED_BACK";
        /** TeamArtifactEditEnvelope */
        TeamArtifactEditEnvelope: {
            data: components["schemas"]["TeamArtifactEditResult"];
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
        /** TeamArtifactEditResult */
        TeamArtifactEditResult: {
            conflict?: components["schemas"]["TeamArtifactConflict"] | null;
            /** State */
            state: string;
            workspace: components["schemas"]["TeamArtifactWorkspace"];
        };
        /** TeamArtifactGovernanceGate */
        TeamArtifactGovernanceGate: {
            /** Detailcode */
            detailCode: string;
            /** Evaluatedat */
            evaluatedAt?: string | null;
            /** Evidencefingerprint */
            evidenceFingerprint?: string | null;
            /** Evidencereference */
            evidenceReference?: string | null;
            key: components["schemas"]["TeamArtifactGovernanceGateKey"];
            state: components["schemas"]["TeamArtifactGovernanceGateState"];
        };
        /**
         * TeamArtifactGovernanceGateKey
         * @enum {string}
         */
        TeamArtifactGovernanceGateKey: "DLP" | "CITATION" | "RECIPIENT_ACL" | "IMMUTABLE_VERSION";
        /**
         * TeamArtifactGovernanceGateState
         * @enum {string}
         */
        TeamArtifactGovernanceGateState: "PASS" | "REVIEW" | "BLOCKED" | "UNAVAILABLE";
        /** TeamArtifactMember */
        TeamArtifactMember: {
            /** Allowed */
            allowed: boolean;
            /** Deniedsourcecount */
            deniedSourceCount: number;
            /** Reasoncode */
            reasonCode?: string | null;
            role: components["schemas"]["TeamArtifactRole"];
            /** Subjectid */
            subjectId: string;
        };
        /** TeamArtifactMemberRequest */
        TeamArtifactMemberRequest: {
            role: components["schemas"]["TeamArtifactRole"];
            /** Subjectid */
            subjectId: string;
        };
        /** TeamArtifactPreflight */
        TeamArtifactPreflight: {
            /** Allowedsourcecount */
            allowedSourceCount: number;
            /**
             * Artifactid
             * Format: uuid
             */
            artifactId: string;
            /** Artifactrevision */
            artifactRevision: number;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /** Decisionrevision */
            decisionRevision: number;
            /** Evidencesha256 */
            evidenceSha256: string;
            /** Excludedsourcecount */
            excludedSourceCount: number;
            /**
             * Expiresat
             * Format: date-time
             */
            expiresAt: string;
            /** Members */
            members: components["schemas"]["TeamArtifactMember"][];
            /**
             * Preflightid
             * Format: uuid
             */
            preflightId: string;
            state: components["schemas"]["TeamArtifactPreflightState"];
            /**
             * Teamid
             * Format: uuid
             */
            teamId: string;
        };
        /** TeamArtifactPreflightEnvelope */
        TeamArtifactPreflightEnvelope: {
            data: components["schemas"]["TeamArtifactPreflight"];
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
         * TeamArtifactPreflightState
         * @enum {string}
         */
        TeamArtifactPreflightState: "READY" | "PARTIAL" | "PERMISSION_DENIED" | "EXPIRED";
        /**
         * TeamArtifactReviewDecision
         * @enum {string}
         */
        TeamArtifactReviewDecision: "APPROVE" | "REJECT";
        /** TeamArtifactReviewStage */
        TeamArtifactReviewStage: {
            /** Assigneesubjectid */
            assigneeSubjectId?: string | null;
            /** Decidedat */
            decidedAt?: string | null;
            /** Decidedbysubjectid */
            decidedBySubjectId?: string | null;
            /** Evidencefingerprint */
            evidenceFingerprint?: string | null;
            /** Revision */
            revision: number;
            /**
             * Stageid
             * Format: uuid
             */
            stageId: string;
            stageKey: components["schemas"]["TeamArtifactReviewStageKey"];
            /** Stageorder */
            stageOrder: number;
            state: components["schemas"]["TeamArtifactReviewStageState"];
        };
        /**
         * TeamArtifactReviewStageKey
         * @enum {string}
         */
        TeamArtifactReviewStageKey: "AUTHOR" | "PRIMARY_REVIEW" | "FINAL_APPROVAL";
        /**
         * TeamArtifactReviewStageState
         * @enum {string}
         */
        TeamArtifactReviewStageState: "PENDING" | "APPROVED" | "REJECTED" | "UNAVAILABLE";
        /**
         * TeamArtifactRole
         * @enum {string}
         */
        TeamArtifactRole: "OWNER" | "EDITOR" | "REVIEWER" | "VIEWER";
        /** TeamArtifactShare */
        TeamArtifactShare: {
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /**
             * Expiresat
             * Format: date-time
             */
            expiresAt: string;
            /** Membercount */
            memberCount: number;
            permission: components["schemas"]["TeamArtifactSharePermission"];
            /**
             * Receiptid
             * Format: uuid
             */
            receiptId: string;
            /** Receiptsha256 */
            receiptSha256: string;
            /** Revocationreceiptid */
            revocationReceiptId?: string | null;
            /** Revocationreceiptsha256 */
            revocationReceiptSha256?: string | null;
            /** Revokedat */
            revokedAt?: string | null;
            /**
             * Shareid
             * Format: uuid
             */
            shareId: string;
            state: components["schemas"]["TeamArtifactShareState"];
            /**
             * Workspaceid
             * Format: uuid
             */
            workspaceId: string;
        };
        /** TeamArtifactShareEnvelope */
        TeamArtifactShareEnvelope: {
            data: components["schemas"]["TeamArtifactShare"];
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
         * TeamArtifactSharePermission
         * @enum {string}
         */
        TeamArtifactSharePermission: "VIEW" | "COMMENT" | "EDIT";
        /**
         * TeamArtifactShareState
         * @enum {string}
         */
        TeamArtifactShareState: "ACTIVE" | "EXPIRED" | "REVOKED";
        /** TeamArtifactSignatureEvidence */
        TeamArtifactSignatureEvidence: {
            capability: components["schemas"]["WorkflowCapability"];
            /** Keyreferencefingerprint */
            keyReferenceFingerprint?: string | null;
            /** Provider */
            provider?: string | null;
            /** Signature */
            signature?: string | null;
            /** Signedat */
            signedAt?: string | null;
        };
        /** TeamArtifactWorkspace */
        TeamArtifactWorkspace: {
            /**
             * Artifactid
             * Format: uuid
             */
            artifactId: string;
            content: components["schemas"]["ArtifactDraftContent"];
            /** Contentsha256 */
            contentSha256: string;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            /** Governancegates */
            governanceGates?: components["schemas"]["TeamArtifactGovernanceGate"][];
            /** Members */
            members: components["schemas"]["TeamArtifactMember"][];
            openConflict?: components["schemas"]["TeamArtifactConflict"] | null;
            /** Reviewsladueat */
            reviewSlaDueAt?: string | null;
            /** Reviewstages */
            reviewStages?: components["schemas"]["TeamArtifactReviewStage"][];
            /** Revision */
            revision: number;
            /** Shares */
            shares?: components["schemas"]["TeamArtifactShare"][];
            signatureEvidence?: components["schemas"]["TeamArtifactSignatureEvidence"];
            state: components["schemas"]["TeamArtifactWorkspaceState"];
            /**
             * Teamid
             * Format: uuid
             */
            teamId: string;
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
            /**
             * Workspaceid
             * Format: uuid
             */
            workspaceId: string;
        };
        /** TeamArtifactWorkspaceEnvelope */
        TeamArtifactWorkspaceEnvelope: {
            data: components["schemas"]["TeamArtifactWorkspace"];
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
         * TeamArtifactWorkspaceState
         * @enum {string}
         */
        TeamArtifactWorkspaceState: "ACTIVE" | "READ_ONLY" | "REVOKED";
        /** TenantAIExecutionPolicy */
        TenantAIExecutionPolicy: {
            /** Alertthresholdpercent */
            alertThresholdPercent: number;
            /** Allowedknowledgesources */
            allowedKnowledgeSources?: string[];
            /** Allowedmodelroutes */
            allowedModelRoutes: components["schemas"]["ModelRoutePolicy"][];
            /** Allowedtoolkeys */
            allowedToolKeys?: string[];
            budgetEnforcementMode: components["schemas"]["BudgetEnforcementMode"];
            /** Emergencydisabled */
            emergencyDisabled: boolean;
            /** @default UNAVAILABLE */
            evaluationEvidenceState: components["schemas"]["EvaluationEvidenceState"];
            evaluationGateStatus: components["schemas"]["EvaluationGateStatus"];
            /** Evaluationobservedat */
            evaluationObservedAt?: string | null;
            /** Evaluationpolicyversion */
            evaluationPolicyVersion?: number | null;
            /** Maxoutputtokensperrequest */
            maxOutputTokensPerRequest: number;
            /** Periodtokenlimit */
            periodTokenLimit?: number | null;
            /** Policyversion */
            policyVersion: number;
            /** Requireevaluationpass */
            requireEvaluationPass: boolean;
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
        };
        /** TokenBudgetSummary */
        TokenBudgetSummary: {
            /** Budgettokens */
            budgetTokens: number;
            /** Consumedtokens */
            consumedTokens: number;
            /** Policymode */
            policyMode: string;
            /** Projectedtokens */
            projectedTokens?: number | null;
            /** Scope */
            scope: string;
            /** Spikedetected */
            spikeDetected: boolean;
            /** Version */
            version: number;
        };
        /**
         * ToolEnforcementState
         * @enum {string}
         */
        ToolEnforcementState: "NOT_CONNECTED";
        /** TriggerRoutineRunRequest */
        TriggerRoutineRunRequest: {
            /** Changereason */
            changeReason: string;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedrevision */
            expectedRevision: number;
            /** Reasoncode */
            reasonCode: string;
        };
        /** TriggerRoutineWebhookRequest */
        TriggerRoutineWebhookRequest: {
            /** Changereason */
            changeReason: string;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /**
             * Eventid
             * Format: uuid
             */
            eventId: string;
            /** Eventtype */
            eventType: string;
            /** Expectedrevision */
            expectedRevision: number;
            /**
             * Occurredat
             * Format: date-time
             */
            occurredAt: string;
            /** Payload */
            payload?: {
                [key: string]: components["schemas"]["JsonValue"];
            };
            /** Reasoncode */
            reasonCode: string;
        };
        /** UpdateAIExecutionPolicyRequest */
        UpdateAIExecutionPolicyRequest: {
            /** Alertthresholdpercent */
            alertThresholdPercent: number;
            /** Allowedknowledgesources */
            allowedKnowledgeSources?: string[];
            /** Allowedmodelroutes */
            allowedModelRoutes: components["schemas"]["ModelRoutePolicy"][];
            /** Allowedtoolkeys */
            allowedToolKeys?: string[];
            budgetEnforcementMode: components["schemas"]["BudgetEnforcementMode"];
            /** Changereason */
            changeReason: string;
            evaluationGateStatus: components["schemas"]["EvaluationGateStatus"];
            /** Evaluationobservedat */
            evaluationObservedAt?: string | null;
            /** Evaluationpolicyversion */
            evaluationPolicyVersion?: number | null;
            /** Expectedversion */
            expectedVersion: number;
            /** Maxoutputtokensperrequest */
            maxOutputTokensPerRequest: number;
            /** Periodtokenlimit */
            periodTokenLimit?: number | null;
            /** Requireevaluationpass */
            requireEvaluationPass: boolean;
        };
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
        /** UpdateAiSourcePreferenceRequest */
        UpdateAiSourcePreferenceRequest: {
            /** Changereason */
            changeReason: string;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Enabled */
            enabled: boolean;
            /** Expectedrevision */
            expectedRevision: number;
            /** Reasoncode */
            reasonCode: string;
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
        /** UpdateMemoryPreferenceRequest */
        UpdateMemoryPreferenceRequest: {
            /** Changereason */
            changeReason: string;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedrevision */
            expectedRevision: number;
            memoryState: components["schemas"]["MemoryPreferenceState"];
            /** Reasoncode */
            reasonCode: string;
        };
        /** UpdateMemoryRequest */
        UpdateMemoryRequest: {
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedrevision */
            expectedRevision: number;
            /** Expiresat */
            expiresAt?: string | null;
            memory?: components["schemas"]["ExplicitMemoryValue"] | null;
            /** Reasoncode */
            reasonCode: string;
            /** Scope */
            scope?: components["schemas"]["MemoryScope"][] | null;
        };
        /** UpdateMemoryRuntimePreferenceRequest */
        UpdateMemoryRuntimePreferenceRequest: {
            /** Changereason */
            changeReason: string;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedrevision */
            expectedRevision: number;
            /** Reasoncode */
            reasonCode: string;
            runtimeApplicationState: components["schemas"]["MemoryPreferenceState"];
        };
        /** UpdateProposalAnalysisPreferenceRequest */
        UpdateProposalAnalysisPreferenceRequest: {
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedrevision */
            expectedRevision: number;
            /** Proactiveanalysisenabled */
            proactiveAnalysisEnabled: boolean;
        };
        /** UpdateResearchPlanRequest */
        UpdateResearchPlanRequest: {
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            definition: components["schemas"]["ResearchPlanDefinition"];
            /** Expectedrevision */
            expectedRevision: number;
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
        /** UpdateRoutineRequest */
        UpdateRoutineRequest: {
            /** Changereason */
            changeReason?: string | null;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            definition: components["schemas"]["RoutineDefinition"];
            /** Expectedrevision */
            expectedRevision: number;
            /** Reasoncode */
            reasonCode: string;
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
        /** UpdateTeamArtifactMembersRequest */
        UpdateTeamArtifactMembersRequest: {
            /** Changereason */
            changeReason: string;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Expectedrevision */
            expectedRevision: number;
            /**
             * Preflightid
             * Format: uuid
             */
            preflightId: string;
            /** Reasoncode */
            reasonCode: string;
        };
        /** UpsertRetentionPolicyRequest */
        UpsertRetentionPolicyRequest: {
            /** Changereason */
            changeReason: string;
            /**
             * Commandid
             * Format: uuid
             */
            commandId: string;
            /** Deletiongracedays */
            deletionGraceDays: number;
            /** Expectedrevision */
            expectedRevision: number;
            /**
             * Legalhold
             * @default false
             */
            legalHold: boolean;
            legalHoldDirective?: components["schemas"]["LegalHoldDirective"] | null;
            /** Reasoncode */
            reasonCode: string;
            /** Retentiondays */
            retentionDays: number;
        };
        /** UserAgentRunAuditEvidence */
        UserAgentRunAuditEvidence: {
            /** Auditid */
            auditId?: string | null;
            /** Auditrecordid */
            auditRecordId?: string | null;
            /** @default NOT_AVAILABLE */
            status: components["schemas"]["RunAuditEvidenceStatus"];
        };
        /** UserAgentRunEnvelope */
        UserAgentRunEnvelope: {
            data: components["schemas"]["UserAgentRunSummary"];
            /**
             * Message
             * @default Agent run loaded.
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
        /** UserAgentRunLease */
        UserAgentRunLease: {
            /** Expiresat */
            expiresAt?: string | null;
            status: components["schemas"]["RunLeaseStatus"];
        };
        /** UserAgentRunListEnvelope */
        UserAgentRunListEnvelope: {
            /** Data */
            data: components["schemas"]["UserAgentRunSummary"][];
            /**
             * Hasmore
             * @default false
             */
            hasMore: boolean;
            /**
             * Message
             * @default Agent activity loaded.
             */
            message: string;
            /** Nextcursor */
            nextCursor?: string | null;
            /** Snapshotat */
            snapshotAt?: string | null;
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
        /** UserAgentRunSourceHealth */
        UserAgentRunSourceHealth: {
            /**
             * Lastattemptat
             * Format: date-time
             */
            lastAttemptAt: string;
            /** Lastsuccessat */
            lastSuccessAt?: string | null;
            /** Latencyms */
            latencyMs?: number | null;
            sourceType: components["schemas"]["CitationSourceType"];
            status: components["schemas"]["RunSourceHealthStatus"];
        };
        /** UserAgentRunStage */
        UserAgentRunStage: {
            /** Completedat */
            completedAt?: string | null;
            /** Durationms */
            durationMs?: number | null;
            key: components["schemas"]["RunStageKey"];
            /** Sequence */
            sequence: number;
            /**
             * Startedat
             * Format: date-time
             */
            startedAt: string;
            state: components["schemas"]["RunStageState"];
        };
        /** UserAgentRunSummary */
        UserAgentRunSummary: {
            /**
             * Activitytitle
             * @default DWAI·ON Agent execution
             */
            activityTitle: string;
            /** Agentkey */
            agentKey: string;
            /** Agentrevision */
            agentRevision: number;
            answerState?: components["schemas"]["AskState"] | null;
            /**
             * Attempt
             * @default 1
             */
            attempt: number;
            auditEvidence?: components["schemas"]["UserAgentRunAuditEvidence"];
            /** Completedat */
            completedAt?: string | null;
            /** Conversationid */
            conversationId?: string | null;
            /**
             * Createdat
             * Format: date-time
             */
            createdAt: string;
            currentStage?: components["schemas"]["RunStageKey"] | null;
            /** @default LIVE */
            dataProvenance: components["schemas"]["RunDataProvenance"];
            /** Latencyms */
            latencyMs: number;
            lease?: components["schemas"]["UserAgentRunLease"];
            /** @default NOT_AVAILABLE */
            measurementStatus: components["schemas"]["RunMeasurementStatus"];
            policyOutcome: components["schemas"]["PolicyOutcome"];
            /** Progresspercent */
            progressPercent?: number | null;
            riskTier: components["schemas"]["RiskTier"];
            /**
             * Runid
             * Format: uuid
             */
            runId: string;
            runState: components["schemas"]["AgentRunState"];
            /** Sourcecount */
            sourceCount: number;
            /** Sourcehealth */
            sourceHealth?: components["schemas"]["UserAgentRunSourceHealth"][];
            /** Stages */
            stages?: components["schemas"]["UserAgentRunStage"][];
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
        /** WorkflowCapability */
        WorkflowCapability: {
            /** Available */
            available: boolean;
            /** Configured */
            configured: boolean;
            /** Reasoncode */
            reasonCode?: string | null;
            /** Recoveryhint */
            recoveryHint?: string | null;
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
        /** RetentionPolicy */
        dwp_agent__governed_domain_contracts__RetentionPolicy: {
            /** Deletiongracedays */
            deletionGraceDays: number;
            domain: components["schemas"]["DomainKey"];
            /** Legalhold */
            legalHold: boolean;
            /** Retentiondays */
            retentionDays: number;
            /** Revision */
            revision: number;
            /**
             * Updatedat
             * Format: date-time
             */
            updatedAt: string;
        };
        /** RetentionPolicyEnvelope */
        dwp_agent__governed_domain_contracts__RetentionPolicyEnvelope: {
            data: components["schemas"]["dwp_agent__governed_domain_contracts__RetentionPolicy"];
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
        /** RetentionPolicy */
        dwp_agent__operations_contracts__RetentionPolicy: {
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
        dwp_agent__operations_contracts__RetentionPolicyEnvelope: {
            data: components["schemas"]["dwp_agent__operations_contracts__RetentionPolicy"];
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
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
    list_activity_events_v1_activity_events_get: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string | null;
                actor?: string;
                state?: string;
                query?: string;
                q?: string;
                source?: string;
                objectType?: string;
                objectId?: string;
                executionId?: string;
                from?: string | null;
                to?: string | null;
            };
            header: {
                "Accept-Language"?: string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
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
                    "application/json": components["schemas"]["ActivityPageEnvelope"];
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
    activity_event_detail_v1_activity_events__event_id__get: {
        parameters: {
            query?: never;
            header: {
                "Accept-Language"?: string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path: {
                event_id: string;
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
                    "application/json": components["schemas"]["ActivityEventEnvelope"];
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
    activity_execution_summary_v1_activity_executions_summary_get: {
        parameters: {
            query?: {
                actor?: string;
                state?: string;
                query?: string;
                q?: string;
                source?: string;
                objectType?: string;
                objectId?: string;
                executionId?: string;
                from?: string | null;
                to?: string | null;
            };
            header: {
                "Accept-Language"?: string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
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
                    "application/json": components["schemas"]["ExecutionSummaryEnvelope"];
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
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
    get_ai_control_overview_v1_admin_ai_control_get: {
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
                    "application/json": components["schemas"]["AIControlOverviewEnvelope"];
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
    bootstrap_ai_control_v1_admin_ai_control_bootstrap_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BootstrapAIExecutionPolicyRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AIControlOverviewEnvelope"];
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
    set_ai_emergency_control_v1_admin_ai_control_emergency_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SetAIEmergencyDisableRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AIControlOverviewEnvelope"];
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
    update_ai_control_policy_v1_admin_ai_control_policy_put: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": string;
                "X-DWP-User-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Permissions"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateAIExecutionPolicyRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AIControlOverviewEnvelope"];
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
    list_commands_v1_admin_control_plane_commands_get: {
        parameters: {
            query?: {
                state?: components["schemas"]["GovernedCommandState"] | null;
                limit?: number;
            };
            header: {
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
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
                    "application/json": components["schemas"]["GovernedCommandsEnvelope"];
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
    create_command_v1_admin_control_plane_commands_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-Step-Up-Challenge"?: string | null;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateGovernedCommandRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GovernedCommandEnvelope"];
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
    get_command_v1_admin_control_plane_commands__command_id__get: {
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
                command_id: string;
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
                    "application/json": components["schemas"]["GovernedCommandEnvelope"];
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
    cancel_command_v1_admin_control_plane_commands__command_id__cancel_post: {
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                command_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["GovernedCommandTransitionRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GovernedCommandEnvelope"];
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
    decide_command_v1_admin_control_plane_commands__command_id__decision_post: {
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                command_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["GovernedCommandDecisionRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GovernedCommandEnvelope"];
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
    retry_command_v1_admin_control_plane_commands__command_id__retry_post: {
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                command_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["GovernedCommandRestartRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GovernedCommandEnvelope"];
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
    rollback_command_v1_admin_control_plane_commands__command_id__rollback_post: {
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                command_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["GovernedCommandRestartRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GovernedCommandEnvelope"];
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
    connectors_v1_admin_control_plane_connectors_get: {
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
                    "application/json": components["schemas"]["SnapshotEnvelope"];
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
    evaluation_safety_v1_admin_control_plane_evaluation_safety_get: {
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
                    "application/json": components["schemas"]["SnapshotEnvelope"];
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
    incidents_v1_admin_control_plane_incidents_get: {
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
                    "application/json": components["schemas"]["SnapshotEnvelope"];
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
    models_routing_v1_admin_control_plane_models_routing_get: {
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
                    "application/json": components["schemas"]["SnapshotEnvelope"];
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
    outcomes_v1_admin_control_plane_outcomes_get: {
        parameters: {
            query?: {
                period_days?: number;
                organization?: string | null;
                work_type?: string | null;
            };
            header: {
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
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
                    "application/json": components["schemas"]["SnapshotEnvelope"];
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
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
    upsert_retention_policy_v1_admin_personal_data_retention__domain__put: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                domain: components["schemas"]["DomainKey"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpsertRetentionPolicyRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["dwp_agent__governed_domain_contracts__RetentionPolicyEnvelope"];
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
                    "application/json": components["schemas"]["dwp_agent__operations_contracts__RetentionPolicyEnvelope"];
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
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
                    "application/json": components["schemas"]["dwp_agent__operations_contracts__RetentionPolicyEnvelope"];
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
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
                    "application/json": components["schemas"]["dwp_agent__operations_contracts__RetentionPolicyEnvelope"];
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
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
    get_personal_ai_controls_v1_ai_controls_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
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
                    "application/json": components["schemas"]["PersonalAiControlsEnvelope"];
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
    update_personal_ai_controls_v1_ai_controls_put: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateMemoryPreferenceRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PersonalAiControlsEnvelope"];
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
    list_personal_memories_v1_ai_controls_memories_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
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
                    "application/json": components["schemas"]["MemoryListEnvelope"];
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
    create_personal_memory_v1_ai_controls_memories_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateMemoryRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MemoryEnvelope"];
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
    update_personal_memory_v1_ai_controls_memories__memory_id__put: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                memory_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateMemoryRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MemoryEnvelope"];
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
    delete_personal_memory_v1_ai_controls_memories__memory_id__delete_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                memory_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DeleteMemoryRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MemoryEnvelope"];
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
    change_personal_memory_state_v1_ai_controls_memories__memory_id__state_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                memory_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ChangeMemoryStateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MemoryEnvelope"];
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
    update_personal_ai_runtime_controls_v1_ai_controls_runtime_put: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateMemoryRuntimePreferenceRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PersonalAiControlsEnvelope"];
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
    update_ai_source_preference_v1_ai_controls_sources__source_key__put: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                source_key: components["schemas"]["AiSourceKey"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateAiSourcePreferenceRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AiSourcePreferenceEnvelope"];
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
    get_artifact_collaboration_capabilities_v1_artifact_collaboration_capabilities_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
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
                    "application/json": components["schemas"]["TeamArtifactCapabilitiesEnvelope"];
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
    request_team_artifact_access_v1_artifact_collaboration__artifact_id__access_requests_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                artifact_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateTeamArtifactAccessRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TeamArtifactAccessRequestEnvelope"];
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
    run_team_artifact_preflight_v1_artifact_collaboration__artifact_id__preflights_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                artifact_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RunTeamArtifactPreflightRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TeamArtifactPreflightEnvelope"];
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
    get_team_artifact_workspace_v1_artifact_collaboration__artifact_id__workspace_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path: {
                artifact_id: string;
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
                    "application/json": components["schemas"]["TeamArtifactWorkspaceEnvelope"];
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
    create_team_artifact_workspace_v1_artifact_collaboration__artifact_id__workspace_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                artifact_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateTeamArtifactWorkspaceRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TeamArtifactWorkspaceEnvelope"];
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
    list_team_artifact_comments_v1_artifact_collaboration__artifact_id__workspace_comments_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path: {
                artifact_id: string;
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
                    "application/json": components["schemas"]["TeamArtifactCommentsEnvelope"];
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
    create_team_artifact_comment_v1_artifact_collaboration__artifact_id__workspace_comments_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                artifact_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateTeamArtifactCommentRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TeamArtifactCommentEnvelope"];
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
    reply_team_artifact_comment_v1_artifact_collaboration__artifact_id__workspace_comments__comment_id__replies_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                artifact_id: string;
                comment_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReplyTeamArtifactCommentRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TeamArtifactCommentEnvelope"];
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
    resolve_team_artifact_comment_v1_artifact_collaboration__artifact_id__workspace_comments__comment_id__resolve_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                artifact_id: string;
                comment_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ResolveTeamArtifactCommentRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TeamArtifactCommentEnvelope"];
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
    resolve_team_artifact_conflict_v1_artifact_collaboration__artifact_id__workspace_conflicts__conflict_id__resolve_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                artifact_id: string;
                conflict_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ResolveTeamArtifactConflictRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TeamArtifactWorkspaceEnvelope"];
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
    submit_team_artifact_edit_v1_artifact_collaboration__artifact_id__workspace_edits_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                artifact_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SubmitTeamArtifactEditRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TeamArtifactEditEnvelope"];
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
    update_team_artifact_members_v1_artifact_collaboration__artifact_id__workspace_members_put: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                artifact_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateTeamArtifactMembersRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TeamArtifactWorkspaceEnvelope"];
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
    decide_team_artifact_review_stage_v1_artifact_collaboration__artifact_id__workspace_review_stages__stage_id__decision_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path: {
                artifact_id: string;
                stage_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DecideTeamArtifactReviewStageRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TeamArtifactWorkspaceEnvelope"];
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
    create_team_artifact_share_v1_artifact_collaboration__artifact_id__workspace_shares_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                artifact_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateTeamArtifactShareRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TeamArtifactShareEnvelope"];
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
    revoke_team_artifact_share_v1_artifact_collaboration__artifact_id__workspace_shares__share_id__revoke_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                artifact_id: string;
                share_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RevokeTeamArtifactShareRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TeamArtifactShareEnvelope"];
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
    list_artifacts_v1_artifacts_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
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
                    "application/json": components["schemas"]["ArtifactListEnvelope"];
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
    create_artifact_v1_artifacts_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateArtifactRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ArtifactEnvelope"];
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
    get_artifact_capabilities_v1_artifacts_capabilities_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
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
                    "application/json": components["schemas"]["ArtifactCapabilitiesEnvelope"];
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
    get_artifact_v1_artifacts__artifact_id__get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path: {
                artifact_id: string;
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
                    "application/json": components["schemas"]["ArtifactEnvelope"];
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
    autosave_artifact_v1_artifacts__artifact_id__draft_put: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                artifact_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AutosaveArtifactRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ArtifactEnvelope"];
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
    export_artifact_v1_artifacts__artifact_id__exports_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                artifact_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ExportArtifactRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ArtifactExportEnvelope"];
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
    get_artifact_export_v1_artifacts__artifact_id__exports__export_job_id__get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path: {
                artifact_id: string;
                export_job_id: string;
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
                    "application/json": components["schemas"]["ArtifactExportEnvelope"];
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
    download_artifact_export_v1_artifacts__artifact_id__exports__export_job_id__download_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path: {
                artifact_id: string;
                export_job_id: string;
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
    run_artifact_preflight_v1_artifacts__artifact_id__preflights_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                artifact_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RunArtifactPreflightRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ArtifactPreflightEnvelope"];
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
    get_current_artifact_preflight_v1_artifacts__artifact_id__preflights_current_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path: {
                artifact_id: string;
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
                    "application/json": components["schemas"]["ArtifactPreflightEnvelope"];
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
    publish_artifact_v1_artifacts__artifact_id__publish_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                artifact_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PublishArtifactRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ArtifactPublicationEnvelope"];
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
    list_artifact_versions_v1_artifacts__artifact_id__versions_get: {
        parameters: {
            query?: {
                limit?: number;
                beforeVersion?: number | null;
            };
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path: {
                artifact_id: string;
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
                    "application/json": components["schemas"]["ArtifactVersionSummaryListEnvelope"];
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
    create_artifact_version_v1_artifacts__artifact_id__versions_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                artifact_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateArtifactVersionRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ArtifactVersionEnvelope"];
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
    get_artifact_version_v1_artifacts__artifact_id__versions__version_number__get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path: {
                artifact_id: string;
                version_number: number;
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
                    "application/json": components["schemas"]["ArtifactVersionDetailEnvelope"];
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
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
    list_attachments_v1_attachments_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
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
                    "application/json": components["schemas"]["AttachmentListEnvelope"];
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
    create_attachment_v1_attachments_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateAttachmentRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AttachmentEnvelope"];
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
    attachment_capabilities_v1_attachments_capabilities_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
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
                    "application/json": components["schemas"]["AttachmentCapabilitiesEnvelope"];
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
    get_attachment_v1_attachments__attachment_id__get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path: {
                attachment_id: string;
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
                    "application/json": components["schemas"]["AttachmentEnvelope"];
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
    delete_attachment_v1_attachments__attachment_id__delete: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                attachment_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DeleteAttachmentRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AttachmentEnvelope"];
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
    complete_attachment_v1_attachments__attachment_id__complete_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                attachment_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CompleteAttachmentUploadRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AttachmentEnvelope"];
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
    get_attachment_evidence_v1_attachments__attachment_id__evidence_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path: {
                attachment_id: string;
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
                    "application/json": components["schemas"]["AttachmentEvidenceEnvelope"];
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
            query?: {
                agentKey?: string | null;
            };
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
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
    activity_page_v1_navigation_activity_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
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
                    "application/json": components["schemas"]["DwaionPageBootstrapEnvelope"];
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
    agents_page_v1_navigation_agents_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
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
                    "application/json": components["schemas"]["DwaionPageBootstrapEnvelope"];
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
    conversations_page_v1_navigation_conversations_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
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
                    "application/json": components["schemas"]["DwaionPageBootstrapEnvelope"];
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
    conversation_page_v1_navigation_conversations__conversation_id__get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
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
                    "application/json": components["schemas"]["DwaionPageBootstrapEnvelope"];
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
    new_page_v1_navigation_new_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
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
                    "application/json": components["schemas"]["DwaionPageBootstrapEnvelope"];
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
    get_personal_data_governance_capabilities_v1_personal_data_capabilities_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
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
                    "application/json": components["schemas"]["PersonalDataGovernanceCapabilitiesEnvelope"];
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
    list_personal_data_deletions_v1_personal_data_deletions_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
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
                    "application/json": components["schemas"]["DeletionJobsEnvelope"];
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
    request_personal_data_deletion_v1_personal_data_deletions_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RequestDeletionRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DeletionJobEnvelope"];
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
    get_personal_data_deletion_v1_personal_data_deletions__deletion_job_id__get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path: {
                deletion_job_id: string;
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
                    "application/json": components["schemas"]["DeletionJobEnvelope"];
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
    retry_personal_data_deletion_v1_personal_data_deletions__deletion_job_id__retry_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                deletion_job_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RetryDeletionRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DeletionJobEnvelope"];
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
    list_retention_policies_v1_personal_data_retention_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
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
                    "application/json": components["schemas"]["RetentionPoliciesEnvelope"];
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
    get_handoff_v1_proposal_handoffs__handoff_id__get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path: {
                handoff_id: string;
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
                    "application/json": components["schemas"]["ProposalHandoffEnvelope"];
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
    analyze_proposals_v1_proposals_analyze_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "Accept-Language"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Identity-Plane"?: string | null;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AnalyzeProposalsRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProposalAnalysisEnvelope"];
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
    clear_proposal_inbox_v1_proposals_clear_post: {
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ClearProposalInboxRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ClearProposalInboxEnvelope"];
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
    get_proposal_preferences_v1_proposals_preferences_get: {
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
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProposalAnalysisPreferenceEnvelope"];
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
    update_proposal_preferences_v1_proposals_preferences_put: {
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateProposalAnalysisPreferenceRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProposalAnalysisPreferenceEnvelope"];
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
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
    get_proposal_handoff_v1_proposals__proposal_id__handoff_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path: {
                proposal_id: string;
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
                    "application/json": components["schemas"]["ProposalHandoffEnvelope"];
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
    create_proposal_handoff_v1_proposals__proposal_id__handoff_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                proposal_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateProposalHandoffRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProposalHandoffEnvelope"];
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
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
    research_capabilities_v1_research_capabilities_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
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
                    "application/json": components["schemas"]["ResearchCapabilitiesEnvelope"];
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
    create_research_plan_v1_research_plans_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateResearchPlanRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ResearchPlanEnvelope"];
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
    get_research_plan_v1_research_plans__plan_id__get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path: {
                plan_id: string;
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
                    "application/json": components["schemas"]["ResearchPlanEnvelope"];
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
    update_research_plan_v1_research_plans__plan_id__put: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                plan_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateResearchPlanRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ResearchPlanEnvelope"];
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
    start_research_run_v1_research_plans__plan_id__runs_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                plan_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["StartResearchRunRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ResearchRunEnvelope"];
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
    get_research_run_v1_research_runs__run_id__get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path: {
                run_id: string;
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
                    "application/json": components["schemas"]["ResearchRunEnvelope"];
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
    create_research_artifact_v1_research_runs__run_id__artifact_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                run_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateResearchDeliveryRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ResearchDeliveryEnvelope"];
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
    command_research_run_v1_research_runs__run_id__commands_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                run_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ResearchRunCommandRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ResearchRunEnvelope"];
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
    list_research_deliveries_v1_research_runs__run_id__deliveries_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path: {
                run_id: string;
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
                    "application/json": components["schemas"]["ResearchDeliveryListEnvelope"];
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
    get_research_delivery_v1_research_runs__run_id__deliveries__delivery_id__get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path: {
                run_id: string;
                delivery_id: string;
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
                    "application/json": components["schemas"]["ResearchDeliveryEnvelope"];
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
    download_research_audit_v1_research_runs__run_id__downloads_audit_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path: {
                run_id: string;
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
                    "application/x-ndjson": string;
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
    download_research_raw_v1_research_runs__run_id__downloads_raw_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path: {
                run_id: string;
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
                    "application/json": components["schemas"]["ResearchRawDownload"];
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
    download_research_receipt_v1_research_runs__run_id__downloads_receipt_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path: {
                run_id: string;
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
                    "application/json": components["schemas"]["ResearchReceiptDownload"];
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
    execute_research_run_v1_research_runs__run_id__execute_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                run_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ExecuteResearchRunRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ResearchRunEnvelope"];
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
    create_research_export_v1_research_runs__run_id__exports_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                run_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateResearchDeliveryRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ResearchDeliveryEnvelope"];
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
    create_research_handoff_v1_research_runs__run_id__handoffs_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                run_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateResearchDeliveryRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ResearchDeliveryEnvelope"];
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
    create_research_proposal_v1_research_runs__run_id__proposal_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                run_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateResearchDeliveryRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ResearchDeliveryEnvelope"];
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
    create_research_routine_v1_research_runs__run_id__routines_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                run_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateResearchDeliveryRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ResearchDeliveryEnvelope"];
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
    create_research_share_v1_research_runs__run_id__shares_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                run_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateResearchDeliveryRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ResearchDeliveryEnvelope"];
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
    list_routines_v1_routines_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
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
                    "application/json": components["schemas"]["RoutineListEnvelope"];
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
    create_routine_v1_routines_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateRoutineRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RoutineEnvelope"];
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
    get_routine_capabilities_v1_routines_capabilities_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
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
                    "application/json": components["schemas"]["RoutineCapabilitiesEnvelope"];
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
    get_routine_v1_routines__routine_id__get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path: {
                routine_id: string;
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
                    "application/json": components["schemas"]["RoutineEnvelope"];
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
    update_routine_v1_routines__routine_id__put: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                routine_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateRoutineRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RoutineEnvelope"];
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
    change_routine_activation_v1_routines__routine_id__activation_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                routine_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ChangeRoutineActivationRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RoutineEnvelope"];
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
    archive_routine_v1_routines__routine_id__archive_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                routine_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ArchiveRoutineRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RoutineEnvelope"];
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
    change_routine_consent_v1_routines__routine_id__consent_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                routine_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ChangeRoutineConsentRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RoutineEnvelope"];
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
    dry_run_routine_v1_routines__routine_id__dry_runs_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                routine_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DryRunRoutineRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RoutineDryRunEnvelope"];
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
    get_routine_health_v1_routines__routine_id__health_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path: {
                routine_id: string;
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
                    "application/json": components["schemas"]["RoutineHealthEnvelope"];
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
    change_routine_lifecycle_v1_routines__routine_id__lifecycle_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                routine_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ChangeRoutineLifecycleRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RoutineEnvelope"];
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
    list_routine_runs_v1_routines__routine_id__runs_get: {
        parameters: {
            query?: {
                limit?: number;
            };
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path: {
                routine_id: string;
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
                    "application/json": components["schemas"]["RoutineExecutionListEnvelope"];
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
    trigger_routine_run_v1_routines__routine_id__runs_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                routine_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TriggerRoutineRunRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RoutineExecutionEnvelope"];
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
    get_routine_run_v1_routines__routine_id__runs__routine_run_id__get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path: {
                routine_id: string;
                routine_run_id: string;
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
                    "application/json": components["schemas"]["RoutineExecutionEnvelope"];
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
    command_routine_run_v1_routines__routine_id__runs__routine_run_id__commands_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                routine_id: string;
                routine_run_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CommandRoutineRunRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RoutineExecutionEnvelope"];
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
    download_routine_telemetry_v1_routines__routine_id__telemetry_download_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path: {
                routine_id: string;
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
                    "application/x-ndjson": string;
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
    list_routine_versions_v1_routines__routine_id__versions_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
            };
            path: {
                routine_id: string;
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
                    "application/json": components["schemas"]["RoutineVersionListEnvelope"];
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
    rollback_routine_version_v1_routines__routine_id__versions__revision__rollback_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                routine_id: string;
                revision: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RollbackRoutineVersionRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RoutineRollbackEnvelope"];
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
    trigger_routine_webhook_v1_routines__routine_id__webhook_events_post: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Auth-Session-ID": string;
                "X-DWP-User-ID": string;
                "X-DWP-Tenant-ID": string;
                "X-Correlation-ID": string;
                "X-DWP-Roles"?: string | null;
                "X-DWP-Permissions"?: string | null;
                "X-DWP-Person-Public-ID"?: string | null;
                "X-DWP-Display-Name-B64"?: string | null;
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
            };
            path: {
                routine_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TriggerRoutineWebhookRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RoutineExecutionEnvelope"];
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
                from?: string | null;
                to?: string | null;
                cursor?: string | null;
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
    get_user_run_v1_runs__run_id__get: {
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
            path: {
                run_id: string;
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
                    "application/json": components["schemas"]["UserAgentRunEnvelope"];
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
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
                /** @description Required for product-authorization rollout states 110/111. The gateway rejects a missing or stale value before the state-changing request reaches the Agent owner service; rollout states 000/100 ignore it. */
                "X-DWP-Expected-Decision-Revision"?: string | null;
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
