/** Generated from contracts/openapi/gateway-public.json. Do not edit manually. */
export interface paths {
    "/api/approvals/v1/admin/forms": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["approval_forms"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/approvals/v1/admin/forms/{formId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["approval_form"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/approvals/v1/admin/forms/{formId}/draft": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["approval_updateFormDraft"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/approvals/v1/admin/operations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["approval_operations"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/approvals/v1/admin/overview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["approval_overview"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/approvals/v1/admin/policies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["approval_policies"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/approvals/v1/admin/policies/{policyId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["approval_updatePolicy"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/approvals/v1/admin/signatures": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["approval_signatures"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/approvals/v1/admin/workflows": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["approval_workflows"];
        put?: never;
        post: operations["approval_createWorkflowDraft"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/approvals/v1/admin/workflows/{workflowId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["approval_workflow"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/approvals/v1/admin/workflows/{workflowId}/draft": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["approval_updateWorkflowDraft"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/approvals/v1/admin/workflows/{workflowId}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["approval_publishWorkflow"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/approvals/v1/delegations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["approval_delegations"];
        put?: never;
        post: operations["approval_createDelegation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/approvals/v1/home": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["approval_home"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/approvals/v1/requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["approval_requests"];
        put?: never;
        post: operations["approval_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/approvals/v1/requests/{requestId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["approval_request"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/approvals/v1/requests/{requestId}/detail": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["approval_requestDetail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/approvals/v1/requests/{requestId}/draft": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["approval_updateDraft"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/approvals/v1/requests/{requestId}/information-response": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["approval_respondToInformationRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/approvals/v1/requests/{requestId}/submit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["approval_submit"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/approvals/v1/requests/{requestId}/withdraw": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["approval_withdraw"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/approvals/v1/tasks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["approval_tasks"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/approvals/v1/tasks/{taskId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["approval_task"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/approvals/v1/tasks/{taskId}/claim": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["approval_claim"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/approvals/v1/tasks/{taskId}/decisions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["approval_decide"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/approvals/v1/workflows/published": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["approval_workflows_1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/approvals/v1/workflows/published/{workflowId}/template": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["approval_workflowTemplate"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/activations/{token}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_activation"];
        put?: never;
        post: operations["auth_activate_1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/access/app-governance": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_dashboard"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/access/app-governance/assignments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["auth_requestAssignment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/access/app-governance/assignments/{assignmentId}/decision": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["auth_decideAssignment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/access/app-governance/assignments/{assignmentId}/revoke": {
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
        patch: operations["auth_revokeAssignment"];
        trace?: never;
    };
    "/api/auth/admin/access/app-governance/resource-sets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["auth_createResourceSet"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/access/app-governance/resource-sets/{resourceSetId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["auth_updateResourceSet"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/access/governance/group-role-assignments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_groupAssignments"];
        put?: never;
        post: operations["auth_createGroupAssignment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/access/governance/group-role-assignments/{assignmentId}/revoke": {
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
        patch: operations["auth_revokeGroupAssignment"];
        trace?: never;
    };
    "/api/auth/admin/access/governance/resources": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_resources"];
        put?: never;
        post: operations["auth_createResource"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/access/governance/roles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_roles"];
        put?: never;
        post: operations["auth_createRole"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/access/governance/roles/{roleId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["auth_updateRole"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/access/governance/roles/{roleId}/permissions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["auth_replacePermissions"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/access/governance/users/{userId}/effective-access": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_effectiveAccess"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/access/privileged/delegated-scopes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_delegatedScopes"];
        put?: never;
        post: operations["auth_createDelegatedScope"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/access/privileged/delegated-scopes/{scopeId}/revoke": {
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
        patch: operations["auth_revokeDelegatedScope"];
        trace?: never;
    };
    "/api/auth/admin/access/privileged/eligibilities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_eligibilities"];
        put?: never;
        post: operations["auth_createEligibility"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/access/privileged/eligibilities/{eligibilityId}/revoke": {
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
        patch: operations["auth_revokeEligibility"];
        trace?: never;
    };
    "/api/auth/admin/access/privileged/emergency-principals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_emergencyPrincipals"];
        put?: never;
        post: operations["auth_registerEmergencyPrincipal"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/access/privileged/me/eligibilities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_myEligibilities"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/access/privileged/me/requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_myRequests"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/access/privileged/policies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_policies"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/access/privileged/policies/{policyId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["auth_updatePolicy"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/access/privileged/requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_requests"];
        put?: never;
        post: operations["auth_requestActivation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/access/privileged/requests/{requestId}/decision": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["auth_decide_1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/access/privileged/requests/{requestId}/revoke": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["auth_revoke"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/access/reviews": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_campaigns"];
        put?: never;
        post: operations["auth_create_1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/access/reviews/{campaignId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_items"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/access/reviews/{campaignId}/activate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["auth_activate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/access/reviews/{campaignId}/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["auth_complete"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/access/reviews/{campaignId}/items/{itemId}/decision": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["auth_decide"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/directory/groups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_groups_1"];
        put?: never;
        post: operations["auth_createGroup_1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/directory/groups/{groupId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_group_1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["auth_updateGroup"];
        trace?: never;
    };
    "/api/auth/admin/directory/groups/{groupId}/activate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["auth_activateGroup"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/directory/groups/{groupId}/deactivate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["auth_deactivateGroup"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/directory/groups/{groupId}/members": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["auth_replaceGroupMembers"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/directory/organizations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_organizations"];
        put?: never;
        post: operations["auth_createOrganization"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/directory/organizations/{orgUnitId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_organization"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["auth_updateOrganization"];
        trace?: never;
    };
    "/api/auth/admin/directory/organizations/{orgUnitId}/activate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["auth_activateOrganization"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/directory/organizations/{orgUnitId}/deactivate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["auth_deactivateOrganization"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/directory/organizations/{orgUnitId}/members": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["auth_replaceOrganizationMembers"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/directory/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_users_2"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/identity/audit-events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_audit"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/identity/roles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_roles_1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/identity/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_users_1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/identity/users/{userId}/roles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["auth_replaceRoles"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/provisioning/scim/connectors": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_list"];
        put?: never;
        post: operations["auth_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/provisioning/scim/connectors/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_events"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/admin/provisioning/scim/connectors/{connectorId}/lifecycle": {
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
        patch: operations["auth_lifecycle_1"];
        trace?: never;
    };
    "/api/auth/admin/provisioning/scim/connectors/{connectorId}/rotate-secret": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["auth_rotate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/csrf": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_getCsrfToken"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/idp": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_getIdentityProviders"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["auth_login"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["auth_logout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_getMe"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/me/locale": {
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
        patch: operations["auth_updatePreferredLocale"];
        trace?: never;
    };
    "/api/auth/oidc/callback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_oidcCallback"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/oidc/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_oidcLogin"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/permissions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_getPermissions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/policy": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_getPolicy"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/session/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["auth_refresh"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_getSessions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/sessions/logout-others": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["auth_logoutOthers"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/sessions/{sessionId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["auth_revoke_1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/admin/workforce/access-policies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["people_list_1"];
        put?: never;
        post: operations["people_create_2"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/admin/workforce/access-policies/organizations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["people_organizations"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/admin/workforce/access-policies/{policyId}/revoke": {
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
        patch: operations["people_revoke"];
        trace?: never;
    };
    "/api/people/v1/hr/absence": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["people_absence"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/hr/absence/requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["people_createLeaveRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/hr/absence/requests/{requestId}/decision": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["people_decideLeaveRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/hr/absence/requests/{requestId}/withdraw": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["people_withdrawLeaveRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/hr/benefits": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["people_benefits"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/hr/home": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["people_home"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/hr/operations/{domain}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["people_operations"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/hr/pay": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["people_pay"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/hr/talent": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["people_talent"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/hr/talent/goals/{goalId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["people_updateGoal"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/hr/time": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["people_time"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/hr/time/{cardId}/decision": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["people_decideTimeCard"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/hr/time/{cardId}/entries/{workDate}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["people_upsertTimeEntry"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/hr/time/{cardId}/submit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["people_submitTimeCard"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/org-chart": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["people_get_2"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/people": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["people_search_1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/people/{publicId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["people_get_1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/data-operations/hris/connectors": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["people_connectors"];
        put?: never;
        post: operations["people_createConnector"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/data-operations/hris/connectors/{connectorId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["people_updateConnector"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/data-operations/hris/connectors/{connectorId}/configuration-check": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["people_checkConnector"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/data-operations/hris/connectors/{connectorId}/executions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["people_execute"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/data-operations/hris/connectors/{connectorId}/reconciliations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["people_reconcile"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/data-operations/hris/mapping-profiles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["people_mappings"];
        put?: never;
        post: operations["people_createMapping"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/data-operations/hris/mapping-profiles/{mappingId}/activate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["people_activateMapping"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/data-operations/hris/reconciliation-issues": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["people_reconciliationIssues"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/data-operations/hris/reconciliation-issues/{issueId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["people_resolveIssue"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/data-operations/hris/reconciliations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["people_reconciliations"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/data-operations/hris/sample-import": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["people_importSample"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/data-operations/hris/sources": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["people_sources"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/data-operations/hris/sync-runs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["people_runs"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/data-operations/hris/sync-runs/{syncRunId}/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["people_retry"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/exports": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["people_list"];
        put?: never;
        post: operations["people_create_1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/exports/datasets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["people_datasets"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/exports/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["people_preview"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/exports/{requestId}/attempts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["people_attempts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/exports/{requestId}/cancel": {
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
        patch: operations["people_cancel_1"];
        trace?: never;
    };
    "/api/people/v1/workforce/exports/{requestId}/retry": {
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
        patch: operations["people_retry_1"];
        trace?: never;
    };
    "/api/people/v1/workforce/organization/chart": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["people_chart"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/organization/intelligence": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["people_intelligence"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/organization/scenarios": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["people_scenarios"];
        put?: never;
        post: operations["people_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/organization/scenarios/{scenarioId}/approval": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["people_decide"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/organization/scenarios/{scenarioId}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["people_cancel"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/organization/scenarios/{scenarioId}/changes/{changeId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["people_removeChange"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/organization/scenarios/{scenarioId}/clone": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["people_cloneScenario"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/organization/scenarios/{scenarioId}/decision-pack": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["people_decisionPack"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/organization/scenarios/{scenarioId}/decision-pack/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["people_decisionPackHistory"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/organization/scenarios/{scenarioId}/decision-pack/validate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["people_validateDecisionPack"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/organization/scenarios/{scenarioId}/moves": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["people_addMove"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/organization/scenarios/{scenarioId}/position-moves": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["people_addPositionMove"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/organization/scenarios/{scenarioId}/positions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["people_createPosition"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/organization/scenarios/{scenarioId}/positions/{positionId}/close": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["people_closePosition"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/organization/scenarios/{scenarioId}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["people_publish"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/organization/scenarios/{scenarioId}/submit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["people_submit"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/people": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["people_search"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/people/{publicId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["people_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/reference-data": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["people_catalogs"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/people/v1/workforce/reference-data/{catalogKey}/{code}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["people_update"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/announcements": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_list_4"];
        put?: never;
        post: operations["platform_create_7"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/announcements/{announcementId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["platform_update_7"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/announcements/{announcementId}/archive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_archive"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/announcements/{announcementId}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_publish_2"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/api-history/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_events_2"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/api-history/events/{historyId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_detail_5"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/api-history/overview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_overview_5"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/app-access-requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_requests_4"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/app-access-requests/{requestId}/decision": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_decide_2"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/app-access-requests/{requestId}/fulfillment": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_fulfill"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/app-access-requests/{requestId}/revocation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_revoke"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/audit-control/cases": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_cases"];
        put?: never;
        post: operations["platform_createCase"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/audit-control/cases/{caseId}": {
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
        patch: operations["platform_updateCase"];
        trace?: never;
    };
    "/api/platform/v1/admin/audit-control/cases/{caseId}/closure-report": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_caseClosureReport"];
        put?: never;
        post: operations["platform_ensureCaseClosureReport"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/audit-control/cases/{caseId}/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_linkEvent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/audit-control/cases/{caseId}/notes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_addCaseNote"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/audit-control/cases/{caseId}/tasks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_createCaseTask"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/audit-control/cases/{caseId}/tasks/{taskId}": {
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
        patch: operations["platform_updateCaseTask"];
        trace?: never;
    };
    "/api/platform/v1/admin/audit-control/cases/{caseId}/workspace": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_caseWorkspace"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/audit-control/event-correlations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_correlations"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/audit-control/event-correlations/detail": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_detail_4"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/audit-control/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_events_1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/audit-control/events/{eventId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_event"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/audit-control/exports": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_export"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/audit-control/exports/{exportId}/content": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_exportContent"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/audit-control/findings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_findings"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/audit-control/findings/{findingId}": {
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
        patch: operations["platform_updateFinding"];
        trace?: never;
    };
    "/api/platform/v1/admin/audit-control/findings/{findingId}/context": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_findingContext"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/audit-control/integrity": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_integrity"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/audit-control/integrity/checkpoint": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_checkpoint"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/audit-control/overview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_overview_4"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/audit-control/policy": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_policy_1"];
        put: operations["platform_updatePolicy_1"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/audit-control/policy/revisions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_policyRevisions"];
        put?: never;
        post: operations["platform_createPolicyRevision"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/audit-control/policy/revisions/{revisionId}/decision": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_decidePolicyRevision"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/audit-control/policy/revisions/{revisionId}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_publishPolicyRevision"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/audit-control/policy/revisions/{revisionId}/rollback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_rollbackPolicyRevision"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/audit-control/policy/revisions/{revisionId}/submit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_submitPolicyRevision"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/audit-control/saved-searches": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_savedSearches"];
        put?: never;
        post: operations["platform_saveSearch"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/audit-control/saved-searches/{savedSearchId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["platform_deleteSavedSearch"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/audit-events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_list_8"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/calendar/bookings/pending": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_pendingBookings"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/calendar/bookings/{bookingId}/decision": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_decideBooking"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/calendar/overview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_overview_3"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/calendar/policy": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_policy"];
        put: operations["platform_updatePolicy"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/calendar/resources": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_createResource"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/calendar/resources/{resourceId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["platform_updateResource"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/catalog": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_overview_2"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/catalog/assurance": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_assurance"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/catalog/assurance/evaluate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_evaluateAssurance"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/catalog/assurance/findings/{findingId}/disposition": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_dispositionFinding"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/catalog/graph": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_graph"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/catalog/impact": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_impact"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/catalog/relations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_declare"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/catalog/relations/{relationId}/retire": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_retire_2"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/home-experience": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_get_2"];
        put: operations["platform_update_6"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/home-experience/background": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_background"];
        put?: never;
        post: operations["platform_uploadBackground"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/home-experience/background/reset": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_resetBackground"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/home-experience/launchpad": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["platform_updateLaunchpad"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/home-experience/revisions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_history_1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/home-experience/revisions/{revisionId}/rollback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_rollback_1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/integrations/productivity/connectors": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_connectors"];
        put?: never;
        post: operations["platform_create_6"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/integrations/productivity/connectors/{connectorId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["platform_update_5"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/integrations/productivity/connectors/{connectorId}/activate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_activate_2"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/integrations/productivity/connectors/{connectorId}/configuration-check": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_configurationCheck"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/integrations/productivity/connectors/{connectorId}/suspend": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_suspend"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/integrations/productivity/overview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_overview_1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/integrations/productivity/runs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_runs"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/integrations/productivity/subjects": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_subjects"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/localization": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_workspace_1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/localization/bundles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_createBundle"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/localization/bundles/{bundleId}/drafts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_createDraft_1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/localization/bundles/{bundleId}/revisions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_revisions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/localization/revisions/{revisionId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_revision"];
        put: operations["platform_saveDraft_1"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/localization/revisions/{revisionId}/decision": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_decide_1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/localization/revisions/{revisionId}/diff": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_diff"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/localization/revisions/{revisionId}/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_preview_1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/localization/revisions/{revisionId}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_publish_1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/localization/revisions/{revisionId}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_restore_1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/localization/revisions/{revisionId}/submit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_submit_1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/navigation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_list_3"];
        put?: never;
        post: operations["platform_create_5"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/navigation/order": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["platform_reorder"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/navigation/studio": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_workspace"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/navigation/studio/drafts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_createDraft"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/navigation/studio/drafts/{revisionId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["platform_saveDraft"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/navigation/studio/drafts/{revisionId}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_cancel_3"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/navigation/studio/drafts/{revisionId}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_publish"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/navigation/studio/revisions/{revisionId}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_restore"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/navigation/{itemId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["platform_update_4"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/navigation/{itemId}/activate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_activate_1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/navigation/{itemId}/retire": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_retire_1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/preference-exceptions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_requests_3"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/preference-exceptions/{requestId}/decision": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_decide"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/reference-sets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_list_2"];
        put?: never;
        post: operations["platform_create_4"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/reference-sets/{setKey}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_detail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["platform_update_8"];
        trace?: never;
    };
    "/api/platform/v1/admin/reference-sets/{setKey}/activate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_activate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/reference-sets/{setKey}/audit-events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_activity_1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/reference-sets/{setKey}/items": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_createItem"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/reference-sets/{setKey}/items/{code}": {
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
        patch: operations["platform_updateItem"];
        trace?: never;
    };
    "/api/platform/v1/admin/reference-sets/{setKey}/items/{code}/activate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_activateItem"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/reference-sets/{setKey}/items/{code}/retire": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_retireItem"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/reference-sets/{setKey}/retire": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_retire"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/registry-entries": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_list_1"];
        put?: never;
        post: operations["platform_create_3"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/registry-entries/{registryType}/{entryKey}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_detail_3"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/registry-entries/{registryType}/{entryKey}/revisions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_createRevision"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/registry-entries/{registryType}/{entryKey}/revisions/{revision}": {
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
        patch: operations["platform_updateRevision"];
        trace?: never;
    };
    "/api/platform/v1/admin/registry-entries/{registryType}/{entryKey}/revisions/{revision}/activate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_activateRevision"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/registry-entries/{registryType}/{entryKey}/revisions/{revision}/retire": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_retireRevision"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/saved-view-ownership/orphaned": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_orphaned"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/saved-view-ownership/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_preview"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/saved-view-ownership/transfers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_transfers"];
        put?: never;
        post: operations["platform_transfer"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/services/catalog": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_catalog"];
        put?: never;
        post: operations["platform_createCatalog"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/services/catalog/{serviceKey}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["platform_saveCatalog"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/services/requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_requests_2"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/services/requests/{requestId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_request_2"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/services/requests/{requestId}/transition": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_transition"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/tenant-branding": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_get_1"];
        put: operations["platform_update_3"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/tenant-branding/logo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_logo"];
        put?: never;
        post: operations["platform_uploadLogo"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/tenant-branding/logo/reset": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_resetLogo"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/tenant-branding/revisions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_history"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/admin/tenant-branding/revisions/{revisionId}/rollback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_rollback"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/announcements": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_list_7"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/announcements/{announcementId}/engagements/action": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_recordAction"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/announcements/{announcementId}/engagements/view": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_recordView"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/calendar/availability": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_availability"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/calendar/calendars": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_calendars"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/calendar/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_events"];
        put?: never;
        post: operations["platform_create_2"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/calendar/events/{eventId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["platform_update_2"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/calendar/events/{eventId}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_cancel_2"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/calendar/events/{eventId}/response": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_respond"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/calendar/home": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_home"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/calendar/resources": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_resources"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/catalog/code-sets/{codeSetKey}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_get_7"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/catalog/registry-entries": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_list_6"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/catalog/registry-entries/{registryType}/{entryKey}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_detail_2"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/communications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_feed"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/communications/{communicationId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_detail_1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/communications/{communicationId}/acknowledgement": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_acknowledge"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/communications/{communicationId}/events/{eventType}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_recordInteraction"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/communications/{communicationId}/reaction": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["platform_updateReaction"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/communications/{communicationId}/reader-state": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["platform_updatePreference"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/home-experience": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_get_6"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/home-experience/background": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_background_1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/home-preferences": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_get"];
        put: operations["platform_update_1"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/home-preferences/reset": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_reset_1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/home-preferences/surfaces/{surfaceKey}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_getSurface"];
        put: operations["platform_updateSurface"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/home-preferences/surfaces/{surfaceKey}/reset": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_resetSurface"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/home/overview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_overview"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/home/recommendations/{recommendationKey}/feedback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_recordFeedback"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/navigation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_list_5"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/observability/web-vitals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_ingest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/personal-preferences": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_get_3"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["platform_patch"];
        trace?: never;
    };
    "/api/platform/v1/personal-preferences/exceptions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_requests_1"];
        put?: never;
        post: operations["platform_request"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/personal-preferences/exceptions/{requestId}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_cancel_1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/personal-preferences/managed-policy": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_policy_2"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/personal-preferences/reset": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_reset"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/reference-data/{setKey}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_get_5"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/search/audit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_record"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/services/catalog": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_catalog_1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/services/requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_requests"];
        put?: never;
        post: operations["platform_create_1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/services/requests/{requestId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_request_1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/services/requests/{requestId}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_cancel"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/services/requests/{requestId}/draft": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["platform_updateDraft"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/services/requests/{requestId}/submit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_submit"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/tenant-branding": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_get_4"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/tenant-branding/logo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_logo_1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/workspace/activity": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_activity"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/workspace/app-access-requests/{requestId}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_cancelAccessRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/workspace/apps": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_apps"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/workspace/apps/{appId}/access-requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_requestAccess"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/workspace/apps/{appId}/launch": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_launch"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/workspace/apps/{appId}/pin": {
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
        patch: operations["platform_setPinned"];
        trace?: never;
    };
    "/api/platform/v1/workspace/productivity/authorization/callback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_completeAuthorization"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/workspace/productivity/connections": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_connections"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/workspace/productivity/connections/{connectorId}/authorization": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_beginAuthorization"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/workspace/productivity/connections/{connectorId}/sync": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_sync"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/workspace/productivity/items": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_items"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/workspace/saved-views": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_list"];
        put?: never;
        post: operations["platform_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/workspace/saved-views/{savedViewId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["platform_update"];
        post?: never;
        delete: operations["platform_delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/workspace/saved-views/{savedViewId}/preference": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["platform_preference"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/workspace/saved-views/{savedViewId}/use": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["platform_markUsed"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/workspace/work-items": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["platform_workItems"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/platform/v1/workspace/work-items/batch/status": {
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
        patch: operations["platform_updateWorkStatuses"];
        trace?: never;
    };
    "/api/platform/v1/workspace/work-items/{workItemId}/status": {
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
        patch: operations["platform_updateWorkStatus"];
        trace?: never;
    };
    "/api/provider/v1/admin/audit-events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["provider_auditEvents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/audit-insights": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["provider_auditInsights"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/code-catalog/code-sets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["provider_catalog"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/code-catalog/code-sets/{codeSetKey}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["provider_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/command-center": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["provider_commandCenter"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/commercial": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["provider_commercial"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/data-governance": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["provider_snapshot"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/data-governance/policies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["provider_policies"];
        put?: never;
        post: operations["provider_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/data-governance/policies/revisions/{revisionId}/approval": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_decide_1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/data-governance/policies/revisions/{revisionId}/impact-preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_preview"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/data-governance/policies/revisions/{revisionId}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_publish"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/data-governance/policies/revisions/{revisionId}/rollback-request": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_requestRollback"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/data-governance/policies/revisions/{revisionId}/submit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_submit_1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/data-governance/policies/{policyId}/revisions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_createRevision"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/data-governance/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_refresh"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/entitlements": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["provider_entitlements"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/feature-rollouts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["provider_rollouts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/feature-rollouts/flags": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["provider_flags"];
        put?: never;
        post: operations["provider_createFlag"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/feature-rollouts/flags/{featureKey}/evaluate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["provider_evaluate"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/feature-rollouts/flags/{featureKey}/revisions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_createRollout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/feature-rollouts/{rolloutId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["provider_rollout"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/feature-rollouts/{rolloutId}/activate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_activate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/feature-rollouts/{rolloutId}/advance": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_advance"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/feature-rollouts/{rolloutId}/approval": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_decide"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/feature-rollouts/{rolloutId}/pause": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_pause"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/feature-rollouts/{rolloutId}/resume": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_resume"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/feature-rollouts/{rolloutId}/rollback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_rollback"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/feature-rollouts/{rolloutId}/submit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_submit"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/incidents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_createIncident"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/incidents/{incidentId}": {
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
        patch: operations["provider_updateIncident"];
        trace?: never;
    };
    "/api/provider/v1/admin/maintenance-windows": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_createMaintenanceWindow"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["provider_me"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/onboarding-plans": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_previewOnboarding"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/operation-approvals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["provider_operationApprovals"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/operation-approvals/{approvalId}/decision": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_decideOperationApproval"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/operations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["provider_operations"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/operations/{operationId}/execute": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_execute"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/operations/{operationId}/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_retry"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/overview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["provider_overview"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/regions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["provider_regions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/reliability-control": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["provider_reliabilityControl"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/service-health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["provider_serviceHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/subscription-renewals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["provider_subscriptionRenewals"];
        put?: never;
        post: operations["provider_createSubscriptionRenewal"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/subscription-renewals/{revisionId}/decision": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_decideSubscriptionRenewal"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/subscription-renewals/{revisionId}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_publishSubscriptionRenewal"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/support-access-requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["provider_supportAccessRequests"];
        put?: never;
        post: operations["provider_createSupportAccessRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/support-access-requests/{requestId}/activate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_activateSupportAccessRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/support-access-requests/{requestId}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_cancelSupportAccessRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/support-access-requests/{requestId}/decision": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_decideSupportAccessRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/support-access-requests/{requestId}/review": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_reviewSupportAccessRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/support-scopes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["provider_supportScopes"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/support-session-context": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["provider_supportSessionContext"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/support-sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["provider_supportSessions"];
        put?: never;
        post: operations["provider_createSupportSession"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/support-sessions/{sessionId}/revoke": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_revokeSupportSession"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/tenants": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["provider_tenants"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/tenants/{tenantId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["provider_tenant"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/tenants/{tenantId}/administrators/{administratorId}/invitations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_issueAdministratorInvitation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/tenants/{tenantId}/domains": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_createDomain"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/tenants/{tenantId}/domains/{domainId}/challenge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["provider_domainChallenge"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/tenants/{tenantId}/domains/{domainId}/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_verifyDomain"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/tenants/{tenantId}/entitlements": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["provider_replaceEntitlements"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/provider/v1/admin/tenants/{tenantId}/lifecycle": {
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
        patch: operations["provider_lifecycle"];
        trace?: never;
    };
    "/api/provider/v1/internal/support-access/resolve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["provider_resolve"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/scim/v2/Groups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_groups"];
        put?: never;
        post: operations["auth_createGroup"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/scim/v2/Groups/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_group"];
        put: operations["auth_replaceGroup"];
        post?: never;
        delete: operations["auth_deleteGroup"];
        options?: never;
        head?: never;
        patch: operations["auth_patchGroup"];
        trace?: never;
    };
    "/scim/v2/ResourceTypes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_resourceTypes"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/scim/v2/Schemas": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_schemas"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/scim/v2/ServiceProviderConfig": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_serviceProviderConfig"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/scim/v2/Users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_users"];
        put?: never;
        post: operations["auth_createUser"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/scim/v2/Users/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["auth_user"];
        put: operations["auth_replaceUser"];
        post?: never;
        delete: operations["auth_deleteUser"];
        options?: never;
        head?: never;
        patch: operations["auth_patchUser"];
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        approval_AdminPulse: {
            /** Format: int32 */
            activeRequests?: number;
            /** Format: int32 */
            draftWorkflows?: number;
            /** Format: int32 */
            failedIntegrations?: number;
            /** Format: int32 */
            overdueTasks?: number;
            /** Format: int32 */
            publishedWorkflows?: number;
        };
        approval_ApiResponseAdminPulse: {
            correlationId?: string;
            data?: components["schemas"]["approval_AdminPulse"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        approval_ApiResponseFormDetail: {
            correlationId?: string;
            data?: components["schemas"]["approval_FormDetail"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        approval_ApiResponseHomeResponse: {
            correlationId?: string;
            data?: components["schemas"]["approval_HomeResponse"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        approval_ApiResponseListDelegationSummary: {
            correlationId?: string;
            data?: components["schemas"]["approval_DelegationSummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        approval_ApiResponseListFormSummary: {
            correlationId?: string;
            data?: components["schemas"]["approval_FormSummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        approval_ApiResponseListPolicySummary: {
            correlationId?: string;
            data?: components["schemas"]["approval_PolicySummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        approval_ApiResponseListRequestSummary: {
            correlationId?: string;
            data?: components["schemas"]["approval_RequestSummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        approval_ApiResponseListSignatureProviderSummary: {
            correlationId?: string;
            data?: components["schemas"]["approval_SignatureProviderSummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        approval_ApiResponseListTaskSummary: {
            correlationId?: string;
            data?: components["schemas"]["approval_TaskSummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        approval_ApiResponseListWorkflowSummary: {
            correlationId?: string;
            data?: components["schemas"]["approval_WorkflowSummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        approval_ApiResponseOperationsResponse: {
            correlationId?: string;
            data?: components["schemas"]["approval_OperationsResponse"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        approval_ApiResponseRequestDetail: {
            correlationId?: string;
            data?: components["schemas"]["approval_RequestDetail"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        approval_ApiResponseRequestSummary: {
            correlationId?: string;
            data?: components["schemas"]["approval_RequestSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        approval_ApiResponseRequestTemplate: {
            correlationId?: string;
            data?: components["schemas"]["approval_RequestTemplate"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        approval_ApiResponseTaskDetail: {
            correlationId?: string;
            data?: components["schemas"]["approval_TaskDetail"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        approval_ApiResponseWorkflowDetail: {
            correlationId?: string;
            data?: components["schemas"]["approval_WorkflowDetail"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        approval_ApprovalMetrics: {
            /** Format: double */
            averageCycleHours?: number;
            /** Format: int32 */
            dueToday?: number;
            /** Format: int32 */
            myRequestsInFlight?: number;
            /** Format: int32 */
            needsInformation?: number;
            /** Format: int32 */
            overdue?: number;
            /** Format: int32 */
            pending?: number;
            /** Format: double */
            slaCompliancePercent?: number;
        };
        approval_CreateDelegationRequest: {
            /** Format: int64 */
            delegateUserId: number;
            /** Format: date-time */
            endsAt: string;
            reason: string;
            scopeType: string;
            /** Format: date-time */
            startsAt: string;
            workflowKey?: string;
        };
        approval_CreateRequest: {
            payload?: {
                [key: string]: unknown;
            };
            priority: string;
            summary: string;
            title: string;
            /** Format: uuid */
            workflowId: string;
        };
        approval_CreateWorkflowDraftRequest: {
            category: string;
            dataClassification: string;
            descriptionEn: string;
            descriptionKo: string;
            nameEn: string;
            nameKo: string;
            ownerGroupRef: string;
            /** Format: int32 */
            slaMinutes: number;
            steps: components["schemas"]["approval_WorkflowStepInput"][];
            workflowKey: string;
        };
        approval_DecisionInsight: {
            detailEn?: string;
            detailKo?: string;
            key?: string;
            route?: string;
            titleEn?: string;
            titleKo?: string;
            tone?: string;
        };
        approval_DecisionRequest: {
            comment?: string;
            decision: string;
            /** Format: int64 */
            expectedVersion: number;
        };
        approval_DelegationSummary: {
            /** Format: int64 */
            delegateUserId?: number;
            /** Format: uuid */
            delegationId?: string;
            /** Format: int64 */
            delegatorUserId?: number;
            /** Format: date-time */
            endsAt?: string;
            lifecycleState?: string;
            reason?: string;
            scopeType?: string;
            /** Format: date-time */
            startsAt?: string;
            /** Format: int64 */
            version?: number;
            workflowKey?: string;
        };
        approval_FormDetail: {
            form?: components["schemas"]["approval_FormSummary"];
            schema?: {
                [key: string]: unknown;
            };
            schemaHash?: string;
        };
        approval_FormFieldInput: {
            helpEn?: string;
            helpKo?: string;
            key: string;
            labelEn: string;
            labelKo: string;
            options?: string[];
            required?: boolean;
            type: string;
        };
        approval_FormSummary: {
            /** Format: int32 */
            currentVersion?: number;
            /** Format: int32 */
            fieldCount?: number;
            /** Format: uuid */
            formId?: string;
            formKey?: string;
            lifecycleState?: string;
            nameEn?: string;
            nameKo?: string;
            /** Format: date-time */
            updatedAt?: string;
            /** Format: int64 */
            version?: number;
        };
        approval_HomeResponse: {
            adminPulse?: components["schemas"]["approval_AdminPulse"];
            administrator?: boolean;
            flow?: components["schemas"]["approval_StageMetric"][];
            focusQueue?: components["schemas"]["approval_TaskSummary"][];
            /** Format: date-time */
            generatedAt?: string;
            insights?: components["schemas"]["approval_DecisionInsight"][];
            metrics?: components["schemas"]["approval_ApprovalMetrics"];
            recentRequests?: components["schemas"]["approval_RequestSummary"][];
        };
        approval_InformationResponseRequest: {
            /** Format: int64 */
            expectedVersion: number;
            message: string;
        };
        approval_OperationSignal: {
            /** Format: int32 */
            count?: number;
            detailEn?: string;
            detailKo?: string;
            key?: string;
            state?: string;
            titleEn?: string;
            titleKo?: string;
        };
        approval_OperationsResponse: {
            breachedTasks?: components["schemas"]["approval_TaskSummary"][];
            /** Format: date-time */
            generatedAt?: string;
            signals?: components["schemas"]["approval_OperationSignal"][];
        };
        approval_PolicySummary: {
            enforcementMode?: string;
            lifecycleState?: string;
            nameEn?: string;
            nameKo?: string;
            /** Format: uuid */
            policyId?: string;
            policyKey?: string;
            policyType?: string;
            rule?: {
                [key: string]: unknown;
            };
            severity?: string;
            /** Format: int64 */
            version?: number;
        };
        approval_PublishWorkflowRequest: {
            /** Format: int64 */
            expectedVersion: number;
        };
        approval_RequestDetail: {
            payload?: {
                [key: string]: unknown;
            };
            request?: components["schemas"]["approval_RequestSummary"];
            /** Format: uuid */
            workflowId?: string;
        };
        approval_RequestSummary: {
            /** Format: date-time */
            completedAt?: string;
            currentStepKey?: string;
            currentStepName?: string;
            /** Format: int32 */
            currentStepSequence?: number;
            dataClassification?: string;
            /** Format: date-time */
            dueAt?: string;
            latestInformationRequest?: string;
            priority?: string;
            /** Format: uuid */
            requestId?: string;
            requestNumber?: string;
            status?: string;
            /** Format: date-time */
            submittedAt?: string;
            summary?: string;
            title?: string;
            /** Format: int32 */
            totalSteps?: number;
            /** Format: int64 */
            version?: number;
            workflowNameEn?: string;
            workflowNameKo?: string;
        };
        approval_RequestTemplate: {
            form?: components["schemas"]["approval_FormDetail"];
            workflow?: components["schemas"]["approval_WorkflowSummary"];
        };
        approval_SignatureProviderSummary: {
            capabilities?: {
                [key: string]: unknown;
            };
            credentialConfigured?: boolean;
            displayName?: string;
            /** Format: date-time */
            lastHealthCheckedAt?: string;
            lifecycleState?: string;
            /** Format: uuid */
            providerId?: string;
            providerKey?: string;
            providerType?: string;
            /** Format: int64 */
            version?: number;
        };
        approval_StageMetric: {
            /** Format: int32 */
            atRisk?: number;
            /** Format: int32 */
            count?: number;
            stage?: string;
        };
        approval_TaskDetail: {
            canClaim?: boolean;
            canDecide?: boolean;
            payload?: {
                [key: string]: unknown;
            };
            selfApprovalBlocked?: boolean;
            task?: components["schemas"]["approval_TaskSummary"];
            timeline?: components["schemas"]["approval_TimelineEvent"][];
        };
        approval_TaskSummary: {
            dataClassification?: string;
            /** Format: date-time */
            dueAt?: string;
            priority?: string;
            /** Format: uuid */
            requestId?: string;
            requestNumber?: string;
            requesterName?: string;
            requesterOrgName?: string;
            /** Format: int32 */
            riskScore?: number;
            status?: string;
            stepKey?: string;
            stepName?: string;
            /** Format: int32 */
            stepSequence?: number;
            /** Format: date-time */
            submittedAt?: string;
            summary?: string;
            /** Format: uuid */
            taskId?: string;
            title?: string;
            /** Format: int64 */
            version?: number;
            workflowNameEn?: string;
            workflowNameKo?: string;
        };
        approval_TimelineEvent: {
            actorId?: string;
            actorType?: string;
            /** Format: uuid */
            eventId?: string;
            eventType?: string;
            message?: string;
            /** Format: date-time */
            occurredAt?: string;
            outcome?: string;
        };
        approval_UpdateDraftRequest: {
            /** Format: int64 */
            expectedVersion: number;
            payload?: {
                [key: string]: unknown;
            };
            priority: string;
            summary: string;
            title: string;
            /** Format: uuid */
            workflowId: string;
        };
        approval_UpdateFormDraftRequest: {
            /** Format: int64 */
            expectedVersion: number;
            fields: components["schemas"]["approval_FormFieldInput"][];
            nameEn: string;
            nameKo: string;
        };
        approval_UpdatePolicyRequest: {
            enforcementMode: string;
            /** Format: int64 */
            expectedVersion: number;
            lifecycleState: string;
            rule: {
                [key: string]: unknown;
            };
            severity: string;
        };
        approval_UpdateWorkflowDraftRequest: {
            category: string;
            dataClassification: string;
            descriptionEn: string;
            descriptionKo: string;
            /** Format: int64 */
            expectedVersion: number;
            nameEn: string;
            nameKo: string;
            ownerGroupRef: string;
            /** Format: int32 */
            slaMinutes: number;
            steps: components["schemas"]["approval_WorkflowStepInput"][];
        };
        approval_VersionedActionRequest: {
            /** Format: int64 */
            expectedVersion: number;
        };
        approval_WorkflowDetail: {
            definition?: {
                [key: string]: unknown;
            };
            definitionHash?: string;
            workflow?: components["schemas"]["approval_WorkflowSummary"];
        };
        approval_WorkflowStepInput: {
            candidateRole: string;
            key: string;
            mode: string;
            name: string;
            /** Format: int32 */
            slaMinutes: number;
        };
        approval_WorkflowSummary: {
            allowSelfApproval?: boolean;
            category?: string;
            /** Format: int32 */
            currentVersion?: number;
            dataClassification?: string;
            descriptionEn?: string;
            descriptionKo?: string;
            lifecycleState?: string;
            nameEn?: string;
            nameKo?: string;
            ownerGroupRef?: string;
            /** Format: int32 */
            slaMinutes?: number;
            /** Format: date-time */
            updatedAt?: string;
            /** Format: int64 */
            version?: number;
            /** Format: uuid */
            workflowId?: string;
            workflowKey?: string;
        };
        auth_ActivateAccountRequest: {
            password: string;
        };
        auth_ActivateAccountResponse: {
            email?: string;
            lifecycleState?: string;
            /** Format: int64 */
            tenantId?: number;
            tenantKey?: string;
        };
        auth_ActivationRequest: {
            /** Format: int32 */
            durationMinutes: number;
            /** Format: uuid */
            eligibilityId?: string;
            justification: string;
            requestType: string;
            /** Format: int64 */
            roleId?: number;
            ticketReference?: string;
        };
        auth_ActivationSummary: {
            displayName?: string;
            email?: string;
            /** Format: date-time */
            expiresAt?: string;
            /** Format: int64 */
            tenantId?: number;
            tenantKey?: string;
            tenantName?: string;
            /** Format: int64 */
            userId?: number;
        };
        auth_ApiResponseActivateAccountResponse: {
            correlationId?: string;
            data?: components["schemas"]["auth_ActivateAccountResponse"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseActivationSummary: {
            correlationId?: string;
            data?: components["schemas"]["auth_ActivationSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseAssignment: {
            correlationId?: string;
            data?: components["schemas"]["auth_Assignment"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseAuthPolicyResponse: {
            correlationId?: string;
            data?: components["schemas"]["auth_AuthPolicyResponse"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseCampaignItems: {
            correlationId?: string;
            data?: components["schemas"]["auth_CampaignItems"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseCampaignSummary: {
            correlationId?: string;
            data?: components["schemas"]["auth_CampaignSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseConnectorSummary: {
            correlationId?: string;
            data?: components["schemas"]["auth_ConnectorSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseCredentialIssued: {
            correlationId?: string;
            data?: components["schemas"]["auth_CredentialIssued"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseCsrfTokenResponse: {
            correlationId?: string;
            data?: components["schemas"]["auth_CsrfTokenResponse"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseDashboard: {
            correlationId?: string;
            data?: components["schemas"]["auth_Dashboard"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseDelegatedScopeSummary: {
            correlationId?: string;
            data?: components["schemas"]["auth_DelegatedScopeSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseDirectoryGroupDetail: {
            correlationId?: string;
            data?: components["schemas"]["auth_DirectoryGroupDetail"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseDirectoryGroupSummary: {
            correlationId?: string;
            data?: components["schemas"]["auth_DirectoryGroupSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseEffectiveAccess: {
            correlationId?: string;
            data?: components["schemas"]["auth_EffectiveAccess"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseEligibilitySummary: {
            correlationId?: string;
            data?: components["schemas"]["auth_EligibilitySummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseEmergencyPrincipalSummary: {
            correlationId?: string;
            data?: components["schemas"]["auth_EmergencyPrincipalSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseGroupRoleAssignmentSummary: {
            correlationId?: string;
            data?: components["schemas"]["auth_GroupRoleAssignmentSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseItemSummary: {
            correlationId?: string;
            data?: components["schemas"]["auth_ItemSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseListAuthSessionResponse: {
            correlationId?: string;
            data?: components["schemas"]["auth_AuthSessionResponse"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseListCampaignSummary: {
            correlationId?: string;
            data?: components["schemas"]["auth_CampaignSummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseListConnectorSummary: {
            correlationId?: string;
            data?: components["schemas"]["auth_ConnectorSummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseListDelegatedScopeSummary: {
            correlationId?: string;
            data?: components["schemas"]["auth_DelegatedScopeSummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseListEligibilitySummary: {
            correlationId?: string;
            data?: components["schemas"]["auth_EligibilitySummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseListEmergencyPrincipalSummary: {
            correlationId?: string;
            data?: components["schemas"]["auth_EmergencyPrincipalSummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseListGroupRoleAssignmentSummary: {
            correlationId?: string;
            data?: components["schemas"]["auth_GroupRoleAssignmentSummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseListIdentityProviderResponse: {
            correlationId?: string;
            data?: components["schemas"]["auth_IdentityProviderResponse"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseListPermissionDTO: {
            correlationId?: string;
            data?: components["schemas"]["auth_PermissionDTO"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseListPolicySummary: {
            correlationId?: string;
            data?: components["schemas"]["auth_PolicySummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseListProvisioningEvent: {
            correlationId?: string;
            data?: components["schemas"]["auth_ProvisioningEvent"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseListRequestSummary: {
            correlationId?: string;
            data?: components["schemas"]["auth_RequestSummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseListResourceSummary: {
            correlationId?: string;
            data?: components["schemas"]["auth_ResourceSummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseListRoleSummary: {
            correlationId?: string;
            data?: components["schemas"]["auth_RoleSummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseLoginResponse: {
            correlationId?: string;
            data?: components["schemas"]["auth_LoginResponse"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseMeResponse: {
            correlationId?: string;
            data?: components["schemas"]["auth_MeResponse"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseOrganizationUnitDetail: {
            correlationId?: string;
            data?: components["schemas"]["auth_OrganizationUnitDetail"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseOrganizationUnitSummary: {
            correlationId?: string;
            data?: components["schemas"]["auth_OrganizationUnitSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponsePageResultDirectoryGroupSummary: {
            correlationId?: string;
            data?: components["schemas"]["auth_PageResultDirectoryGroupSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponsePageResultDirectoryMemberSummary: {
            correlationId?: string;
            data?: components["schemas"]["auth_PageResultDirectoryMemberSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponsePageResultIdentityAuditEventResponse: {
            correlationId?: string;
            data?: components["schemas"]["auth_PageResultIdentityAuditEventResponse"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponsePageResultOrganizationUnitSummary: {
            correlationId?: string;
            data?: components["schemas"]["auth_PageResultOrganizationUnitSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponsePageResultUserAccessSummary: {
            correlationId?: string;
            data?: components["schemas"]["auth_PageResultUserAccessSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponsePolicySummary: {
            correlationId?: string;
            data?: components["schemas"]["auth_PolicySummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseRequestSummary: {
            correlationId?: string;
            data?: components["schemas"]["auth_RequestSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseResourceSet: {
            correlationId?: string;
            data?: components["schemas"]["auth_ResourceSet"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseResourceSummary: {
            correlationId?: string;
            data?: components["schemas"]["auth_ResourceSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseRoleSummary: {
            correlationId?: string;
            data?: components["schemas"]["auth_RoleSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseSessionRotationResponse: {
            correlationId?: string;
            data?: components["schemas"]["auth_SessionRotationResponse"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseUserAccessSummary: {
            correlationId?: string;
            data?: components["schemas"]["auth_UserAccessSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApiResponseVoid: {
            correlationId?: string;
            data?: unknown;
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        auth_ApplicationContext: null;
        auth_ApprovalDecisionRequest: {
            decision: string;
            reason: string;
            /** Format: int64 */
            version: number;
        };
        auth_ApprovalSummary: {
            approverDisplayName?: string;
            /** Format: int64 */
            approverUserId?: number;
            /** Format: date-time */
            decidedAt?: string;
            decision?: string;
            reason?: string;
        };
        auth_Assignment: {
            /** Format: date-time */
            approvedAt?: string;
            /** Format: int64 */
            approvedBy?: number;
            approvedByName?: string;
            /** Format: uuid */
            assignmentId?: string;
            assignmentSource?: string;
            /** Format: date-time */
            createdAt?: string;
            decisionReason?: string;
            justification?: string;
            lifecycleState?: string;
            principalName?: string;
            principalRef?: string;
            principalType?: string;
            /** Format: int64 */
            requestedBy?: number;
            requestedByName?: string;
            /** Format: uuid */
            resourceSetId?: string;
            resourceSetKey?: string;
            resourceSetName?: string;
            responsibilityCode?: string;
            /** Format: date-time */
            reviewDueAt?: string;
            /** Format: date-time */
            updatedAt?: string;
            /** Format: date-time */
            validFrom?: string;
            /** Format: date-time */
            validTo?: string;
            /** Format: int64 */
            version?: number;
        };
        auth_AssignmentDecisionRequest: {
            decision: string;
            reason: string;
            /** Format: int64 */
            version: number;
        };
        auth_AuthPolicyResponse: {
            allowedLoginTypes?: string[];
            defaultLoginType?: string;
            localLoginEnabled?: boolean;
            requireMfa?: boolean;
            ssoLoginEnabled?: boolean;
            ssoProviderKey?: string;
            /** Format: int64 */
            tenantId?: number;
        };
        auth_AuthSessionResponse: {
            current?: boolean;
            /** Format: date-time */
            expiresAt?: string;
            /** Format: date-time */
            idleExpiresAt?: string;
            ipAddress?: string;
            /** Format: date-time */
            lastSeenAt?: string;
            /** Format: uuid */
            sessionId?: string;
            /** Format: date-time */
            startedAt?: string;
            userAgent?: string;
        };
        auth_AutowireCapableBeanFactory: unknown;
        auth_BeanFactory: null;
        auth_CampaignItems: {
            campaign?: components["schemas"]["auth_CampaignSummary"];
            items?: components["schemas"]["auth_ItemSummary"][];
        };
        auth_CampaignSummary: {
            /** Format: date-time */
            activatedAt?: string;
            /** Format: int64 */
            approvedItems?: number;
            /** Format: uuid */
            campaignId?: string;
            /** Format: date-time */
            completedAt?: string;
            description?: string;
            /** Format: date-time */
            dueAt?: string;
            lifecycleState?: string;
            /** Format: int64 */
            manualRemediationItems?: number;
            name?: string;
            /** Format: int64 */
            pendingItems?: number;
            reviewerStrategy?: string;
            /** Format: int64 */
            reviewerUserId?: number;
            /** Format: int64 */
            revokedItems?: number;
            /** Format: int64 */
            scopeRef?: number;
            scopeType?: string;
            /** Format: int64 */
            totalItems?: number;
            /** Format: int64 */
            version?: number;
        };
        auth_ConnectorSummary: {
            allowedOperations?: string[];
            /** Format: uuid */
            connectorId?: string;
            connectorKey?: string;
            displayName?: string;
            /** Format: int64 */
            events24h?: number;
            /** Format: int64 */
            failedEvents24h?: number;
            health?: string;
            /** Format: date-time */
            lastFailureAt?: string;
            /** Format: date-time */
            lastSuccessAt?: string;
            /** Format: date-time */
            lastUsedAt?: string;
            lifecycleState?: string;
            tokenPrefix?: string;
            /** Format: int64 */
            version?: number;
        };
        auth_CreateAssignmentRequest: {
            justification: string;
            principalRef: string;
            principalType: string;
            /** Format: uuid */
            resourceSetId: string;
            responsibilityCode: string;
            /** Format: date-time */
            validTo?: string;
        };
        auth_CreateCampaignRequest: {
            description?: string;
            /** Format: date-time */
            dueAt: string;
            name: string;
            reviewerStrategy: string;
            /** Format: int64 */
            reviewerUserId?: number;
            /** Format: int64 */
            scopeRef?: number;
            scopeType: string;
        };
        auth_CreateDelegatedScopeRequest: {
            actionCode: string;
            /** Format: int64 */
            administratorUserId: number;
            justification: string;
            scopeRef?: string;
            scopeType: string;
            /** Format: date-time */
            validFrom?: string;
            /** Format: date-time */
            validTo?: string;
        };
        auth_CreateDirectoryGroupRequest: {
            description?: string;
            displayName: string;
            groupKey: string;
        };
        auth_CreateEligibilityRequest: {
            justification: string;
            /** Format: int64 */
            principalId: number;
            principalType: string;
            /** Format: int64 */
            roleId: number;
            scopeRef?: string;
            scopeType: string;
            /** Format: date-time */
            validFrom?: string;
            /** Format: date-time */
            validTo?: string;
        };
        auth_CreateGroupRoleAssignmentRequest: {
            assignmentType: string;
            /** Format: int64 */
            groupId: number;
            justification: string;
            /** Format: int64 */
            roleId: number;
            scopeRef?: string;
            scopeType: string;
            /** Format: date-time */
            validFrom?: string;
            /** Format: date-time */
            validTo?: string;
        };
        auth_CreateOrganizationUnitRequest: {
            description?: string;
            name: string;
            orgKey: string;
            /** Format: int64 */
            parentOrgUnitId?: number;
        };
        auth_CreateRequest: {
            connectorKey: string;
            displayName: string;
        };
        auth_CreateResourceRequest: {
            key: string;
            name: string;
            type: string;
        };
        auth_CreateResourceSetRequest: {
            description?: string;
            key: string;
            name: string;
            resourceKeys: string[];
        };
        auth_CreateRoleRequest: {
            assignableToGroups?: boolean;
            code: string;
            description?: string;
            name: string;
            privileged?: boolean;
        };
        auth_CredentialIssued: {
            bearerToken?: string;
            connector?: components["schemas"]["auth_ConnectorSummary"];
        };
        auth_CsrfToken: {
            headerName?: string;
            parameterName?: string;
            token?: string;
        };
        auth_CsrfTokenResponse: {
            headerName?: string;
            token?: string;
        };
        auth_Dashboard: {
            assignments?: components["schemas"]["auth_Assignment"][];
            metrics?: components["schemas"]["auth_Metrics"];
            principals?: components["schemas"]["auth_Principal"][];
            resourceSets?: components["schemas"]["auth_ResourceSet"][];
            responsibilities?: components["schemas"]["auth_Responsibility"][];
        };
        auth_DecisionRequest: {
            decision: string;
            reason: string;
            /** Format: int64 */
            version: number;
        };
        auth_DefaultHttpStatusCode: components["schemas"]["auth_HttpStatusCode"];
        auth_DelegatedScopeSummary: {
            actionCode?: string;
            administratorDisplayName?: string;
            /** Format: int64 */
            administratorUserId?: number;
            justification?: string;
            lifecycleState?: string;
            /** Format: uuid */
            scopeId?: string;
            scopeRef?: string;
            scopeType?: string;
            /** Format: date-time */
            validFrom?: string;
            /** Format: date-time */
            validTo?: string;
            /** Format: int64 */
            version?: number;
        };
        auth_DirectoryGroupDetail: {
            group?: components["schemas"]["auth_DirectoryGroupSummary"];
            members?: components["schemas"]["auth_DirectoryMemberSummary"][];
        };
        auth_DirectoryGroupSummary: {
            description?: string;
            displayName?: string;
            /** Format: int64 */
            groupId?: number;
            groupKey?: string;
            /** Format: int64 */
            memberCount?: number;
            /** Format: int64 */
            revision?: number;
            sourceType?: string;
            status?: string;
            /** Format: date-time */
            updatedAt?: string;
            /** Format: int64 */
            updatedBy?: number;
            /** Format: int64 */
            version?: number;
        };
        auth_DirectoryMemberSummary: {
            displayName?: string;
            email?: string;
            primaryOrgName?: string;
            /** Format: int64 */
            primaryOrgUnitId?: number;
            status?: string;
            /** Format: int64 */
            userId?: number;
        };
        auth_EffectiveAccess: {
            /** Format: int64 */
            accessRevision?: number;
            displayName?: string;
            permissions?: components["schemas"]["auth_EffectivePermission"][];
            roles?: components["schemas"]["auth_EffectiveRole"][];
            /** Format: int64 */
            userId?: number;
        };
        auth_EffectiveAccessSummary: {
            /** Format: date-time */
            assignedAt?: string;
            assignmentType?: string;
            privileged?: boolean;
            roleCode?: string;
            /** Format: int64 */
            roleId?: number;
            roleName?: string;
            scopeRef?: string;
            scopeType?: string;
            sourceId?: string;
            sourceKey?: string;
            sourceName?: string;
            sourceType?: string;
            /** Format: date-time */
            validFrom?: string;
            /** Format: date-time */
            validTo?: string;
        };
        auth_EffectivePermission: {
            effect?: string;
            grantedByRoles?: string[];
            permissionCode?: string;
            resourceKey?: string;
            resourceType?: string;
        };
        auth_EffectiveRole: {
            roleCode?: string;
            /** Format: int64 */
            roleId?: number;
            scopeRef?: string;
            scopeType?: string;
            source?: string;
            /** Format: int64 */
            sourceGroupId?: number;
            sourceGroupName?: string;
            /** Format: date-time */
            validTo?: string;
        };
        auth_EligibilitySummary: {
            /** Format: uuid */
            eligibilityId?: string;
            justification?: string;
            lifecycleState?: string;
            principalDisplayName?: string;
            /** Format: int64 */
            principalId?: number;
            principalType?: string;
            roleCode?: string;
            /** Format: int64 */
            roleId?: number;
            roleName?: string;
            scopeRef?: string;
            scopeType?: string;
            /** Format: date-time */
            validFrom?: string;
            /** Format: date-time */
            validTo?: string;
            /** Format: int64 */
            version?: number;
        };
        auth_Email: {
            primary?: boolean;
            type?: string;
            value?: string;
        };
        auth_EmergencyPrincipalSummary: {
            displayName?: string;
            /** Format: uuid */
            emergencyPrincipalId?: string;
            justification?: string;
            lifecycleState?: string;
            /** Format: date-time */
            reviewDueAt?: string;
            /** Format: int64 */
            userId?: number;
            /** Format: int64 */
            version?: number;
        };
        auth_Environment: {
            activeProfiles?: string[];
            defaultProfiles?: string[];
        };
        auth_FilterRegistration: {
            className?: string;
            initParameters?: {
                [key: string]: string;
            };
            name?: string;
            servletNameMappings?: string[];
            urlPatternMappings?: string[];
        };
        auth_GroupMembershipDTO: {
            displayName?: string;
            /** Format: uuid */
            groupRef?: string;
        };
        auth_GroupRequest: {
            displayName: string;
            externalId?: string;
            members?: components["schemas"]["auth_Member"][];
            schemas?: string[];
        };
        auth_GroupResponse: {
            displayName?: string;
            externalId?: string;
            id?: string;
            members?: components["schemas"]["auth_Member"][];
            meta?: components["schemas"]["auth_Meta"];
            schemas?: string[];
        };
        auth_GroupRoleAssignmentSummary: {
            /** Format: int64 */
            assignmentId?: number;
            assignmentType?: string;
            /** Format: int64 */
            groupId?: number;
            groupName?: string;
            justification?: string;
            lifecycleState?: string;
            roleCode?: string;
            /** Format: int64 */
            roleId?: number;
            scopeRef?: string;
            scopeType?: string;
            /** Format: date-time */
            validFrom?: string;
            /** Format: date-time */
            validTo?: string;
            /** Format: int64 */
            version?: number;
        };
        /** @enum {unknown} */
        auth_HttpStatus: "100 CONTINUE" | "101 SWITCHING_PROTOCOLS" | "102 PROCESSING" | "103 EARLY_HINTS" | "103 CHECKPOINT" | "200 OK" | "201 CREATED" | "202 ACCEPTED" | "203 NON_AUTHORITATIVE_INFORMATION" | "204 NO_CONTENT" | "205 RESET_CONTENT" | "206 PARTIAL_CONTENT" | "207 MULTI_STATUS" | "208 ALREADY_REPORTED" | "226 IM_USED" | "300 MULTIPLE_CHOICES" | "301 MOVED_PERMANENTLY" | "302 FOUND" | "302 MOVED_TEMPORARILY" | "303 SEE_OTHER" | "304 NOT_MODIFIED" | "305 USE_PROXY" | "307 TEMPORARY_REDIRECT" | "308 PERMANENT_REDIRECT" | "400 BAD_REQUEST" | "401 UNAUTHORIZED" | "402 PAYMENT_REQUIRED" | "403 FORBIDDEN" | "404 NOT_FOUND" | "405 METHOD_NOT_ALLOWED" | "406 NOT_ACCEPTABLE" | "407 PROXY_AUTHENTICATION_REQUIRED" | "408 REQUEST_TIMEOUT" | "409 CONFLICT" | "410 GONE" | "411 LENGTH_REQUIRED" | "412 PRECONDITION_FAILED" | "413 PAYLOAD_TOO_LARGE" | "413 REQUEST_ENTITY_TOO_LARGE" | "414 URI_TOO_LONG" | "414 REQUEST_URI_TOO_LONG" | "415 UNSUPPORTED_MEDIA_TYPE" | "416 REQUESTED_RANGE_NOT_SATISFIABLE" | "417 EXPECTATION_FAILED" | "418 I_AM_A_TEAPOT" | "419 INSUFFICIENT_SPACE_ON_RESOURCE" | "420 METHOD_FAILURE" | "421 DESTINATION_LOCKED" | "422 UNPROCESSABLE_ENTITY" | "423 LOCKED" | "424 FAILED_DEPENDENCY" | "425 TOO_EARLY" | "426 UPGRADE_REQUIRED" | "428 PRECONDITION_REQUIRED" | "429 TOO_MANY_REQUESTS" | "431 REQUEST_HEADER_FIELDS_TOO_LARGE" | "451 UNAVAILABLE_FOR_LEGAL_REASONS" | "500 INTERNAL_SERVER_ERROR" | "501 NOT_IMPLEMENTED" | "502 BAD_GATEWAY" | "503 SERVICE_UNAVAILABLE" | "504 GATEWAY_TIMEOUT" | "505 HTTP_VERSION_NOT_SUPPORTED" | "506 VARIANT_ALSO_NEGOTIATES" | "507 INSUFFICIENT_STORAGE" | "508 LOOP_DETECTED" | "509 BANDWIDTH_LIMIT_EXCEEDED" | "510 NOT_EXTENDED" | "511 NETWORK_AUTHENTICATION_REQUIRED";
        auth_HttpStatusCode: {
            error?: boolean;
            is1xxInformational?: boolean;
            is2xxSuccessful?: boolean;
            is3xxRedirection?: boolean;
            is4xxClientError?: boolean;
            is5xxServerError?: boolean;
        };
        auth_IdentityAuditEventResponse: {
            action?: string;
            /** Format: int64 */
            actorId?: number;
            actorType?: string;
            auditEventId?: string;
            correlationId?: string;
            /** Format: date-time */
            occurredAt?: string;
            outcome?: string;
            targetId?: string;
            targetType?: string;
        };
        auth_IdentityProviderResponse: {
            authUrl?: string;
            clientId?: string;
            enabled?: boolean;
            issuerUri?: string;
            metadataUrl?: string;
            providerKey?: string;
            providerType?: string;
            /** Format: int64 */
            tenantId?: number;
        };
        auth_InvitationResponse: {
            activationToken?: string;
            /** Format: int64 */
            administratorUserId?: number;
            email?: string;
            /** Format: date-time */
            expiresAt?: string;
            /** Format: int64 */
            tenantId?: number;
        };
        auth_IssueInvitationRequest: {
            /** Format: int64 */
            administratorUserId: number;
            /** Format: int32 */
            expiresInMinutes: number;
        };
        auth_ItemSummary: {
            /** Format: int64 */
            accessSourceId?: number;
            accessSourceType?: string;
            /** Format: date-time */
            assignmentCreatedAt?: string;
            /** Format: date-time */
            decidedAt?: string;
            /** Format: int64 */
            decidedBy?: number;
            decision?: string;
            decisionReason?: string;
            /** Format: uuid */
            itemId?: string;
            privileged?: boolean;
            recommendation?: string;
            recommendationReason?: string;
            remediationState?: string;
            /** Format: int64 */
            reviewerUserId?: number;
            roleCode?: string;
            /** Format: int64 */
            roleId?: number;
            roleName?: string;
            sourceDisplayName?: string;
            sourceKey?: string;
            subjectDisplayName?: string;
            subjectEmail?: string;
            /** Format: date-time */
            subjectLastSignInAt?: string;
            /** Format: int64 */
            subjectUserId?: number;
            /** Format: int64 */
            version?: number;
        };
        auth_JsonNode: unknown;
        auth_JspConfigDescriptor: {
            jspPropertyGroups?: components["schemas"]["auth_JspPropertyGroupDescriptor"][];
            taglibs?: components["schemas"]["auth_TaglibDescriptor"][];
        };
        auth_JspPropertyGroupDescriptor: {
            buffer?: string;
            defaultContentType?: string;
            deferredSyntaxAllowedAsLiteral?: string;
            elIgnored?: string;
            errorOnELNotFound?: string;
            errorOnUndeclaredNamespace?: string;
            includeCodas?: string[];
            includePreludes?: string[];
            isXml?: string;
            pageEncoding?: string;
            scriptingInvalid?: string;
            trimDirectiveWhitespaces?: string;
            urlPatterns?: string[];
        };
        auth_LifecycleRequest: {
            /** Format: int64 */
            version: number;
        };
        auth_ListResponseGroupResponse: {
            Resources?: components["schemas"]["auth_GroupResponse"][];
            /** Format: int32 */
            itemsPerPage?: number;
            nextCursor?: string;
            schemas?: string[];
            /** Format: int32 */
            startIndex?: number;
            /** Format: int64 */
            totalResults?: number;
        };
        auth_ListResponseUserResponse: {
            Resources?: components["schemas"]["auth_UserResponse"][];
            /** Format: int32 */
            itemsPerPage?: number;
            nextCursor?: string;
            schemas?: string[];
            /** Format: int32 */
            startIndex?: number;
            /** Format: int64 */
            totalResults?: number;
        };
        auth_LoginRequest: {
            email: string;
            password: string;
            tenantId: string;
        };
        auth_LoginResponse: {
            /** Format: int64 */
            expiresIn?: number;
            permissions?: components["schemas"]["auth_PermissionDTO"][];
            tenantId?: string;
            userId?: string;
        };
        auth_MeResponse: {
            displayName?: string;
            email?: string;
            groups?: components["schemas"]["auth_GroupMembershipDTO"][];
            jobTitle?: string;
            permissions?: components["schemas"]["auth_PermissionDTO"][];
            /** Format: uuid */
            personPublicId?: string;
            preferredLocale?: string;
            resourceRoles?: components["schemas"]["auth_ResourceRole"][];
            roles?: string[];
            tenantCode?: string;
            tenantDefaultLocale?: string;
            /** Format: int64 */
            tenantId?: number;
            tenantName?: string;
            /** Format: int64 */
            userId?: number;
        };
        auth_Member: {
            display?: string;
            type?: string;
            value: string;
        };
        auth_Meta: {
            /** Format: date-time */
            created?: string;
            /** Format: date-time */
            lastModified?: string;
            location?: string;
            resourceType?: string;
            version?: string;
        };
        auth_Metrics: {
            /** Format: int64 */
            activeAssignments?: number;
            /** Format: int64 */
            pendingApprovals?: number;
            /** Format: int64 */
            resourcesWithoutOwner?: number;
            /** Format: int64 */
            reviewsDueSoon?: number;
        };
        auth_Name: {
            familyName?: string;
            formatted?: string;
            givenName?: string;
        };
        auth_OrganizationUnitDetail: {
            members?: components["schemas"]["auth_DirectoryMemberSummary"][];
            organization?: components["schemas"]["auth_OrganizationUnitSummary"];
        };
        auth_OrganizationUnitSummary: {
            description?: string;
            /** Format: int64 */
            memberCount?: number;
            name?: string;
            orgKey?: string;
            /** Format: int64 */
            orgUnitId?: number;
            parentName?: string;
            /** Format: int64 */
            parentOrgUnitId?: number;
            /** Format: int64 */
            revision?: number;
            sourceType?: string;
            status?: string;
            /** Format: date-time */
            updatedAt?: string;
            /** Format: int64 */
            updatedBy?: number;
            /** Format: int64 */
            version?: number;
        };
        auth_PageResultDirectoryGroupSummary: {
            content?: components["schemas"]["auth_DirectoryGroupSummary"][];
            /** Format: int32 */
            page?: number;
            /** Format: int32 */
            size?: number;
            /** Format: int64 */
            totalElements?: number;
            /** Format: int32 */
            totalPages?: number;
        };
        auth_PageResultDirectoryMemberSummary: {
            content?: components["schemas"]["auth_DirectoryMemberSummary"][];
            /** Format: int32 */
            page?: number;
            /** Format: int32 */
            size?: number;
            /** Format: int64 */
            totalElements?: number;
            /** Format: int32 */
            totalPages?: number;
        };
        auth_PageResultIdentityAuditEventResponse: {
            content?: components["schemas"]["auth_IdentityAuditEventResponse"][];
            /** Format: int32 */
            page?: number;
            /** Format: int32 */
            size?: number;
            /** Format: int64 */
            totalElements?: number;
            /** Format: int32 */
            totalPages?: number;
        };
        auth_PageResultOrganizationUnitSummary: {
            content?: components["schemas"]["auth_OrganizationUnitSummary"][];
            /** Format: int32 */
            page?: number;
            /** Format: int32 */
            size?: number;
            /** Format: int64 */
            totalElements?: number;
            /** Format: int32 */
            totalPages?: number;
        };
        auth_PageResultUserAccessSummary: {
            content?: components["schemas"]["auth_UserAccessSummary"][];
            /** Format: int32 */
            page?: number;
            /** Format: int32 */
            size?: number;
            /** Format: int64 */
            totalElements?: number;
            /** Format: int32 */
            totalPages?: number;
        };
        auth_PatchOperation: {
            op: string;
            path?: string;
            value?: components["schemas"]["auth_JsonNode"];
        };
        auth_PatchRequest: {
            Operations: components["schemas"]["auth_PatchOperation"][];
            schemas: string[];
        };
        auth_PermissionDTO: {
            effect?: string;
            permissionCode?: string;
            permissionName?: string;
            resourceKey?: string;
            resourceName?: string;
            resourceType?: string;
        };
        auth_PermissionGrant: {
            effect?: string;
            permissionCode?: string;
            /** Format: int64 */
            resourceId?: number;
            resourceKey?: string;
            resourceName?: string;
            resourceType?: string;
        };
        auth_PermissionSelection: {
            effect: string;
            permissionCode: string;
            /** Format: int64 */
            resourceId: number;
        };
        auth_PolicySummary: {
            activationMode?: string;
            /** Format: int32 */
            approvalQuorum?: number;
            assuranceLevel?: string;
            emergencyMode?: string;
            lifecycleState?: string;
            /** Format: int32 */
            maximumDurationMinutes?: number;
            /** Format: int64 */
            policyId?: number;
            roleCode?: string;
            /** Format: int64 */
            roleId?: number;
            roleName?: string;
            ticketRequired?: boolean;
            /** Format: int64 */
            version?: number;
        };
        auth_Principal: {
            detail?: string;
            displayName?: string;
            ref?: string;
            type?: string;
        };
        auth_ProvisionTenantRequest: {
            administratorDisplayName: string;
            /** Format: email */
            administratorEmail: string;
            dataRegion: string;
            defaultLocale: string;
            displayName: string;
            entitlementKeys: string[];
            isolationModel: string;
            /** Format: uuid */
            providerTenantId: string;
            tenantKey: string;
            timeZone: string;
        };
        auth_ProvisionTenantResponse: {
            administratorEmail?: string;
            /** Format: int64 */
            administratorUserId?: number;
            lifecycleState?: string;
            /** Format: uuid */
            providerTenantId?: string;
            /** Format: int32 */
            schemaVersion?: number;
            /** Format: int64 */
            tenantId?: number;
        };
        auth_ProvisioningEvent: {
            /** Format: uuid */
            connectorId?: string;
            connectorName?: string;
            correlationId?: string;
            /** Format: uuid */
            eventId?: string;
            /** Format: date-time */
            occurredAt?: string;
            operation?: string;
            outcome?: string;
            resourceId?: string;
            resourceType?: string;
            summary?: string;
        };
        auth_RedirectView: {
            applicationContext?: components["schemas"]["auth_ApplicationContext"];
            attributes?: {
                [key: string]: string;
            };
            attributesCSV?: string;
            attributesMap?: {
                [key: string]: unknown;
            };
            beanName?: string | null;
            contentType?: string | null;
            contextRelative?: boolean;
            encodingScheme?: string;
            expandUriTemplateVariables?: boolean;
            exposeContextBeansAsAttributes?: boolean;
            exposeModelAttributes?: boolean;
            exposePathVariables?: boolean;
            exposedContextBeanNames?: string[];
            hosts?: string[] | null;
            http10Compatible?: boolean;
            propagateQueryParams?: boolean;
            propagateQueryProperties?: boolean;
            redirectView?: boolean;
            requestContextAttribute?: string | null;
            servletContext?: components["schemas"]["auth_ServletContext"];
            staticAttributes?: {
                [key: string]: unknown;
            };
            statusCode?: components["schemas"]["auth_DefaultHttpStatusCode"] | components["schemas"]["auth_HttpStatus"];
            url?: string | null;
        };
        auth_RegisterEmergencyPrincipalRequest: {
            justification: string;
            /** Format: date-time */
            reviewDueAt: string;
            /** Format: int64 */
            userId: number;
        };
        auth_ReplaceEntitlementsRequest: {
            entitlementKeys: string[];
        };
        auth_ReplaceMembersRequest: {
            userIds: number[];
            /** Format: int64 */
            version: number;
        };
        auth_ReplacePermissionsRequest: {
            permissions: components["schemas"]["auth_PermissionSelection"][];
            /** Format: int64 */
            version: number;
        };
        auth_ReplaceUserRolesRequest: {
            /** Format: int64 */
            accessRevision: number;
            justification: string;
            roleCodes: string[];
            /** Format: int64 */
            version: number;
        };
        auth_RequestSummary: {
            /** Format: date-time */
            activatedAt?: string;
            /** Format: int32 */
            approvalQuorum?: number;
            approvals?: components["schemas"]["auth_ApprovalSummary"][];
            assuranceLevel?: string;
            /** Format: int32 */
            durationMinutes?: number;
            /** Format: uuid */
            eligibilityId?: string;
            /** Format: date-time */
            expiresAt?: string;
            justification?: string;
            lifecycleState?: string;
            /** Format: uuid */
            requestId?: string;
            requestType?: string;
            /** Format: date-time */
            requestedAt?: string;
            requesterDisplayName?: string;
            /** Format: int64 */
            requesterUserId?: number;
            /** Format: date-time */
            revokedAt?: string;
            roleCode?: string;
            /** Format: int64 */
            roleId?: number;
            roleName?: string;
            scopeRef?: string;
            scopeType?: string;
            ticketReference?: string;
            /** Format: int64 */
            version?: number;
        };
        auth_ResourceMember: {
            resourceKey?: string;
            resourceName?: string;
            resourceType?: string;
        };
        auth_ResourceRole: {
            resourceKey?: string;
            /** Format: uuid */
            resourceSetId?: string;
            resourceSetKey?: string;
            resourceType?: string;
            responsibilityCode?: string;
            /** Format: date-time */
            validTo?: string;
        };
        auth_ResourceSet: {
            description?: string;
            key?: string;
            lifecycleState?: string;
            name?: string;
            /** Format: uuid */
            resourceSetId?: string;
            resources?: components["schemas"]["auth_ResourceMember"][];
            /** Format: int64 */
            version?: number;
        };
        auth_ResourceSummary: {
            enabled?: boolean;
            key?: string;
            name?: string;
            /** Format: int64 */
            resourceId?: number;
            type?: string;
        };
        auth_Responsibility: {
            code?: string;
            description?: string;
            displayName?: string;
            riskTier?: string;
            /** Format: int32 */
            sortOrder?: number;
        };
        auth_RevokeAssignmentRequest: {
            reason: string;
            /** Format: int64 */
            version: number;
        };
        auth_RevokeRequest: {
            reason: string;
            /** Format: int64 */
            version: number;
        };
        auth_RoleManagementSummary: {
            allowed?: boolean;
            reason?: string;
        };
        auth_RoleSummary: {
            assignableToGroups?: boolean;
            code?: string;
            description?: string;
            name?: string;
            permissions?: components["schemas"]["auth_PermissionGrant"][];
            privileged?: boolean;
            /** Format: int64 */
            roleId?: number;
            roleType?: string;
            status?: string;
            /** Format: int64 */
            version?: number;
        };
        auth_ServletContext: {
            attributeNames?: unknown;
            classLoader?: {
                defaultAssertionStatus?: boolean;
                definedPackages?: {
                    annotations?: unknown[];
                    declaredAnnotations?: unknown[];
                    implementationTitle?: string;
                    implementationVendor?: string;
                    implementationVersion?: string;
                    name?: string;
                    sealed?: boolean;
                    specificationTitle?: string;
                    specificationVendor?: string;
                    specificationVersion?: string;
                }[];
                name?: string;
                registeredAsParallelCapable?: boolean;
            };
            contextPath?: string;
            defaultSessionTrackingModes?: ("COOKIE" | "URL" | "SSL")[];
            /** Format: int32 */
            effectiveMajorVersion?: number;
            /** Format: int32 */
            effectiveMinorVersion?: number;
            effectiveSessionTrackingModes?: ("COOKIE" | "URL" | "SSL")[];
            filterRegistrations?: {
                [key: string]: components["schemas"]["auth_FilterRegistration"];
            };
            initParameterNames?: unknown;
            jspConfigDescriptor?: components["schemas"]["auth_JspConfigDescriptor"];
            /** Format: int32 */
            majorVersion?: number;
            /** Format: int32 */
            minorVersion?: number;
            requestCharacterEncoding?: string;
            responseCharacterEncoding?: string;
            serverInfo?: string;
            servletContextName?: string;
            servletRegistrations?: {
                [key: string]: components["schemas"]["auth_ServletRegistration"];
            };
            sessionCookieConfig?: components["schemas"]["auth_SessionCookieConfig"];
            /** Format: int32 */
            sessionTimeout?: number;
            sessionTrackingModes?: ("COOKIE" | "URL" | "SSL")[];
            virtualServerName?: string;
        };
        auth_ServletRegistration: {
            className?: string;
            initParameters?: {
                [key: string]: string;
            };
            mappings?: string[];
            name?: string;
            runAsRole?: string;
        };
        auth_SessionCookieConfig: {
            attributes?: {
                [key: string]: string;
            };
            /** @deprecated */
            comment?: string;
            domain?: string;
            httpOnly?: boolean;
            /** Format: int32 */
            maxAge?: number;
            name?: string;
            path?: string;
            secure?: boolean;
        };
        auth_SessionRotationResponse: {
            /** Format: date-time */
            expiresAt?: string;
            /** Format: date-time */
            idleExpiresAt?: string;
            rotated?: boolean;
        };
        auth_Subject: {
            displayName?: string;
            email?: string;
            /** Format: uuid */
            publicId?: string;
            status?: string;
            /** Format: int64 */
            tenantId?: number;
            /** Format: int64 */
            userId?: number;
        };
        auth_SyncRequest: {
            action: string;
            /** Format: int64 */
            actorId: number;
            justification: string;
            permissionCode: string;
            principalRef: string;
            principalType: string;
            resourceKey: string;
            /** Format: date-time */
            validTo?: string;
        };
        auth_SyncResult: {
            changed?: boolean;
            grantId?: string;
            lifecycleState?: string;
            permissionCode?: string;
            principalRef?: string;
            principalType?: string;
            resourceKey?: string;
            sourceRef?: string;
            sourceType?: string;
            /** Format: int64 */
            tenantId?: number;
            /** Format: date-time */
            validFrom?: string;
            /** Format: date-time */
            validTo?: string;
            /** Format: int64 */
            version?: number;
        };
        auth_TaglibDescriptor: {
            taglibLocation?: string;
            taglibURI?: string;
        };
        auth_UpdateDirectoryGroupRequest: {
            description?: string;
            displayName: string;
            /** Format: int64 */
            version: number;
        };
        auth_UpdateLifecycleRequest: {
            lifecycleState: string;
        };
        auth_UpdateOrganizationUnitRequest: {
            description?: string;
            name: string;
            /** Format: int64 */
            parentOrgUnitId?: number;
            /** Format: int64 */
            version: number;
        };
        auth_UpdatePolicyRequest: {
            activationMode: string;
            /** Format: int32 */
            approvalQuorum: number;
            assuranceLevel: string;
            emergencyMode: string;
            lifecycleState: string;
            /** Format: int32 */
            maximumDurationMinutes: number;
            ticketRequired?: boolean;
            /** Format: int64 */
            version: number;
        };
        auth_UpdatePreferredLocaleRequest: {
            locale: string;
        };
        auth_UpdateResourceSetRequest: {
            description?: string;
            name: string;
            resourceKeys: string[];
            /** Format: int64 */
            version: number;
        };
        auth_UpdateRoleRequest: {
            assignableToGroups?: boolean;
            description?: string;
            name: string;
            privileged?: boolean;
            status: string;
            /** Format: int64 */
            version: number;
        };
        auth_UserAccessSummary: {
            /** Format: int64 */
            accessRevision?: number;
            /** Format: int64 */
            activeSessionCount?: number;
            displayName?: string;
            effectiveAccess?: components["schemas"]["auth_EffectiveAccessSummary"][];
            effectiveRoles?: string[];
            email?: string;
            /** Format: date-time */
            lastSignInAt?: string;
            mfaEnabled?: boolean;
            roleManagement?: components["schemas"]["auth_RoleManagementSummary"];
            roles?: string[];
            status?: string;
            /** Format: date-time */
            updatedAt?: string;
            /** Format: int64 */
            updatedBy?: number;
            /** Format: int64 */
            userId?: number;
            /** Format: int64 */
            version?: number;
        };
        auth_UserRequest: {
            active?: boolean;
            displayName?: string;
            emails?: components["schemas"]["auth_Email"][];
            externalId?: string;
            locale?: string;
            name?: components["schemas"]["auth_Name"];
            schemas?: string[];
            title?: string;
            userName: string;
        };
        auth_UserResponse: {
            active?: boolean;
            displayName?: string;
            emails?: components["schemas"]["auth_Email"][];
            externalId?: string;
            id?: string;
            locale?: string;
            meta?: components["schemas"]["auth_Meta"];
            name?: components["schemas"]["auth_Name"];
            schemas?: string[];
            title?: string;
            userName?: string;
        };
        auth_VersionRequest: {
            /** Format: int64 */
            version: number;
        };
        auth_WorkforceIdentityEvent: {
            displayName: string;
            /** Format: uuid */
            eventId: string;
            externalId: string;
            familyName?: string;
            givenName?: string;
            jobTitle?: string;
            /** Format: uuid */
            personPublicId: string;
            preferredLocale?: string;
            /** Format: uuid */
            providerTenantId: string;
            sourceVersion?: string;
            /** Format: email */
            workEmail?: string;
            workerStatus: string;
        };
        people_AbsenceWorkspace: {
            balances?: components["schemas"]["people_LeaveBalance"][];
            employee?: components["schemas"]["people_EmployeeContext"];
            requests?: components["schemas"]["people_LeaveRequest"][];
            teamCalendar?: components["schemas"]["people_TeamAbsence"][];
            teamQueue?: components["schemas"]["people_ApprovalItem"][];
        };
        people_ActivateMappingRequest: {
            /** Format: int64 */
            version: number;
        };
        people_AddOrganizationMoveRequest: {
            /** Format: uuid */
            newParentOrganizationId: string;
            /** Format: uuid */
            organizationId: string;
            /** Format: int64 */
            version: number;
        };
        people_AddPositionMoveRequest: {
            /** Format: uuid */
            newParentPositionId: string;
            /** Format: uuid */
            positionId: string;
            /** Format: int64 */
            version: number;
        };
        people_Analysis: {
            /** Format: double */
            averageManagerSpan?: number;
            /** Format: double */
            contingentRatioPercent?: number;
            /** Format: int32 */
            dataQualityScore?: number;
            /** Format: int32 */
            healthScore?: number;
            /** Format: double */
            managerRatioPercent?: number;
            /** Format: int32 */
            maximumLayers?: number;
            /** Format: int32 */
            missingGradeCount?: number;
            /** Format: int32 */
            missingManagerCount?: number;
            /** Format: int32 */
            narrowSpanManagerCount?: number;
            /** Format: int32 */
            orphanOrganizationCount?: number;
            policy?: components["schemas"]["people_DesignPolicy"];
            signals?: components["schemas"]["people_AnalysisSignal"][];
            /** Format: int32 */
            singleReportManagerCount?: number;
            /** Format: int32 */
            wideSpanManagerCount?: number;
        };
        people_AnalysisSignal: {
            code?: string;
            /** Format: int32 */
            count?: number;
            /** Format: uuid */
            organizationId?: string;
            severity?: string;
        };
        people_ApiResponseAbsenceWorkspace: {
            correlationId?: string;
            data?: components["schemas"]["people_AbsenceWorkspace"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseApprovalItem: {
            correlationId?: string;
            data?: components["schemas"]["people_ApprovalItem"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseBenefitsWorkspace: {
            correlationId?: string;
            data?: components["schemas"]["people_BenefitsWorkspace"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseConfigurationCheck: {
            correlationId?: string;
            data?: components["schemas"]["people_ConfigurationCheck"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseConnectorInstance: {
            correlationId?: string;
            data?: components["schemas"]["people_ConnectorInstance"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseCursorPagePersonSummary: {
            correlationId?: string;
            data?: components["schemas"]["people_CursorPagePersonSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseDecisionPack: {
            correlationId?: string;
            data?: components["schemas"]["people_DecisionPack"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseDomainOperations: {
            correlationId?: string;
            data?: components["schemas"]["people_DomainOperations"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseHomeOverview: {
            correlationId?: string;
            data?: components["schemas"]["people_HomeOverview"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseImportResult: {
            correlationId?: string;
            data?: components["schemas"]["people_ImportResult"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseIntelligence: {
            correlationId?: string;
            data?: components["schemas"]["people_Intelligence"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseLeaveRequest: {
            correlationId?: string;
            data?: components["schemas"]["people_LeaveRequest"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseListAttemptEvent: {
            correlationId?: string;
            data?: components["schemas"]["people_AttemptEvent"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseListConnectorInstance: {
            correlationId?: string;
            data?: components["schemas"]["people_ConnectorInstance"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseListDatasetSummary: {
            correlationId?: string;
            data?: components["schemas"]["people_DatasetSummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseListMappingProfile: {
            correlationId?: string;
            data?: components["schemas"]["people_MappingProfile"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseListOrganizationOption: {
            correlationId?: string;
            data?: components["schemas"]["people_OrganizationOption"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseListPolicy: {
            correlationId?: string;
            data?: components["schemas"]["people_Policy"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseListReconciliationIssue: {
            correlationId?: string;
            data?: components["schemas"]["people_ReconciliationIssue"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseListReconciliationRun: {
            correlationId?: string;
            data?: components["schemas"]["people_ReconciliationRun"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseListReferenceCatalog: {
            correlationId?: string;
            data?: components["schemas"]["people_ReferenceCatalog"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseListRequestSummary: {
            correlationId?: string;
            data?: components["schemas"]["people_RequestSummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseListScenario: {
            correlationId?: string;
            data?: components["schemas"]["people_Scenario"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseListSourceSystem: {
            correlationId?: string;
            data?: components["schemas"]["people_SourceSystem"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseListSyncRun: {
            correlationId?: string;
            data?: components["schemas"]["people_SyncRun"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseListValidationRunSummary: {
            correlationId?: string;
            data?: components["schemas"]["people_ValidationRunSummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseMappingProfile: {
            correlationId?: string;
            data?: components["schemas"]["people_MappingProfile"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseOrganizationChart: {
            correlationId?: string;
            data?: components["schemas"]["people_OrganizationChart"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponsePayWorkspace: {
            correlationId?: string;
            data?: components["schemas"]["people_PayWorkspace"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponsePersonDetail: {
            correlationId?: string;
            data?: components["schemas"]["people_PersonDetail"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponsePolicy: {
            correlationId?: string;
            data?: components["schemas"]["people_Policy"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponsePreview: {
            correlationId?: string;
            data?: components["schemas"]["people_Preview"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseReconciliationRun: {
            correlationId?: string;
            data?: components["schemas"]["people_ReconciliationRun"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseReferenceValue: {
            correlationId?: string;
            data?: components["schemas"]["people_ReferenceValue"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseRequestSummary: {
            correlationId?: string;
            data?: components["schemas"]["people_RequestSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseScenario: {
            correlationId?: string;
            data?: components["schemas"]["people_Scenario"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseTalentWorkspace: {
            correlationId?: string;
            data?: components["schemas"]["people_TalentWorkspace"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseTimeWorkspace: {
            correlationId?: string;
            data?: components["schemas"]["people_TimeWorkspace"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_ApiResponseVoid: {
            correlationId?: string;
            data?: unknown;
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        people_Approval: {
            /** Format: uuid */
            approvalId?: string;
            /** Format: date-time */
            decidedAt?: string;
            /** Format: int64 */
            decidedBy?: number;
            decisionReason?: string;
            /** Format: uuid */
            decisionValidationRunId?: string;
            evidenceBindingState?: string;
            /** Format: date-time */
            expiresAt?: string;
            gateKey?: string;
            lifecycleState?: string;
            requestReason?: string;
            /** Format: uuid */
            requestValidationRunId?: string;
            /** Format: date-time */
            requestedAt?: string;
            /** Format: int64 */
            requestedBy?: number;
            requiredRoleCode?: string;
            separationOfDuties?: boolean;
            /** Format: int64 */
            version?: number;
        };
        people_ApprovalItem: {
            domain?: string;
            employeeName?: string;
            employeeTitle?: string;
            /** Format: uuid */
            itemId?: string;
            /** Format: uuid */
            personId?: string;
            status?: string;
            /** Format: date-time */
            submittedAt?: string;
            summary?: string;
            /** Format: int64 */
            version?: number;
        };
        people_AssignmentSummary: {
            assignmentKey?: string;
            assignmentStatus?: string;
            businessTitle?: string;
            changeReasonCode?: string;
            /** Format: date */
            effectiveEndDate?: string;
            /** Format: date */
            effectiveStartDate?: string;
            jobGradeName?: string;
            jobProfileName?: string;
            locationName?: string;
            managerAssignmentKey?: string;
            organizationName?: string;
            primaryAssignment?: boolean;
        };
        people_AttemptEvent: {
            artifactSha256?: string;
            /** Format: int64 */
            artifactSizeBytes?: number;
            /** Format: uuid */
            attemptEventId?: string;
            /** Format: int32 */
            attemptNumber?: number;
            eventType?: string;
            failureCode?: string;
            /** Format: date-time */
            occurredAt?: string;
            redactedFailureMessage?: string;
            workerReference?: string;
        };
        people_BenefitPlan: {
            coverageLevel?: string;
            /** Format: date */
            effectiveEnd?: string;
            /** Format: date */
            effectiveStart?: string;
            name?: string;
            /** Format: uuid */
            planId?: string;
            planType?: string;
            providerName?: string;
            status?: string;
        };
        people_BenefitsWorkspace: {
            employee?: components["schemas"]["people_EmployeeContext"];
            plans?: components["schemas"]["people_BenefitPlan"][];
            referenceData?: boolean;
            windows?: components["schemas"]["people_EnrollmentWindow"][];
        };
        people_CancelScenarioRequest: {
            reason: string;
            /** Format: int64 */
            version: number;
        };
        people_Change: {
            afterSnapshot?: string;
            beforeSnapshot?: string;
            /** Format: uuid */
            changeId?: string;
            changeType?: string;
            costCurrency?: string;
            /** Format: date */
            effectiveDate?: string;
            estimatedCostDelta?: number;
            /** Format: double */
            estimatedFteDelta?: number;
            /** Format: int32 */
            estimatedHeadcountDelta?: number;
            /** Format: int32 */
            payloadSchemaVersion?: number;
            relatedReference?: string;
            /** Format: int32 */
            sequence?: number;
            targetKind?: string;
            targetReference?: string;
            validationMessage?: string;
            validationState?: string;
            /** Format: int64 */
            version?: number;
        };
        people_CloneScenarioRequest: {
            description?: string;
            /** Format: date */
            effectiveDate: string;
            name: string;
            scenarioKey: string;
        };
        people_ClosePositionRequest: {
            /** Format: int64 */
            version: number;
        };
        people_Company: {
            description?: string;
            name?: string;
            /** Format: uuid */
            organizationId?: string;
            organizationKey?: string;
        };
        people_ComparisonSummary: {
            /** Format: double */
            averageManagerSpanDelta?: number;
            costCurrency?: string;
            /** Format: int32 */
            dataQualityScoreDelta?: number;
            /** Format: int32 */
            headcountDelta?: number;
            /** Format: int32 */
            managerChanges?: number;
            /** Format: int32 */
            managerDelta?: number;
            /** Format: int32 */
            maximumLayersDelta?: number;
            /** Format: int32 */
            openPositionDelta?: number;
            /** Format: int32 */
            organizationDelta?: number;
            /** Format: int32 */
            organizationHealthScoreDelta?: number;
            /** Format: int32 */
            organizationMoves?: number;
            /** Format: int32 */
            peopleMoved?: number;
            plannedFteDelta?: number;
            /** Format: int32 */
            totalChanges?: number;
            workforceCostDelta?: number;
        };
        people_ConfigurationCheck: {
            /** Format: date-time */
            checkedAt?: string;
            /** Format: uuid */
            connectorInstanceId?: string;
            externalConnectivityTested?: boolean;
            healthState?: string;
            issues?: string[];
            valid?: boolean;
        };
        people_ConnectorInstance: {
            authMode?: string;
            /** Format: uuid */
            connectorInstanceId?: string;
            connectorKey?: string;
            connectorType?: string;
            /** Format: int32 */
            consecutiveFailureCount?: number;
            credentialReference?: string;
            endpointUri?: string;
            healthState?: string;
            /** Format: date-time */
            lastAttemptedSyncAt?: string;
            lastErrorCode?: string;
            /** Format: date-time */
            lastHealthCheckedAt?: string;
            /** Format: date-time */
            lastSuccessfulSyncAt?: string;
            lifecycleState?: string;
            scheduleExpression?: string;
            sourceKey?: string;
            /** Format: int64 */
            sourceSystemId?: number;
            /** Format: int64 */
            version?: number;
        };
        people_CreateConnectorRequest: {
            authMode: string;
            connectorKey: string;
            connectorType: string;
            credentialReference?: string;
            endpointUri?: string;
            scheduleExpression?: string;
            sourceKey: string;
            sourceName: string;
            sourceType: string;
        };
        people_CreateLeaveRequest: {
            /** Format: date-time */
            endAt: string;
            /** Format: uuid */
            planId: string;
            reason?: string;
            /** Format: int32 */
            requestedMinutes?: number;
            /** Format: date-time */
            startAt: string;
        };
        people_CreateMappingProfileRequest: {
            adapterType: string;
            mappingDefinition: components["schemas"]["people_JsonNode"];
            profileKey: string;
            sourceSchemaVersion: string;
            /** Format: int64 */
            sourceSystemId: number;
            targetSchemaVersion: string;
        };
        people_CreatePolicyRequest: {
            actionCodes: string[];
            fieldGroups: string[];
            justification: string;
            /** Format: uuid */
            organizationId?: string;
            populationType: string;
            subjectRef: string;
            subjectType: string;
            /** Format: date-time */
            validFrom?: string;
            /** Format: date-time */
            validTo?: string;
        };
        people_CreatePositionRequest: {
            annualCostAmount?: number;
            /** Format: date */
            availabilityDate: string;
            budgetedFte: number;
            costCurrency?: string;
            criticality: string;
            /** Format: uuid */
            organizationId: string;
            positionKey: string;
            positionType: string;
            /** Format: uuid */
            reportsToPositionId: string;
            title: string;
            /** Format: int64 */
            version: number;
        };
        people_CreateRequest: {
            datasetKey: string;
            exportFormat: string;
            idempotencyKey: string;
            purpose: string;
            recipientReference: string;
            selection: {
                [key: string]: string;
            };
            sourceReference: string;
        };
        people_CreateScenarioRequest: {
            /** Format: date */
            baselineDate: string;
            description?: string;
            /** Format: date */
            effectiveDate: string;
            name: string;
            scenarioKey: string;
        };
        people_CursorPagePersonSummary: {
            /** Format: date */
            asOf?: string;
            hasMore?: boolean;
            items?: components["schemas"]["people_PersonSummary"][];
            nextCursor?: string;
            /** Format: int32 */
            size?: number;
        };
        people_DataAccess: {
            classification?: string;
            excludedFieldGroups?: string[];
            workerNumberMasked?: boolean;
        };
        people_DataQualityIssue: {
            entityId?: string;
            entityName?: string;
            entityType?: string;
            issueCode?: string;
            message?: string;
            severity?: string;
        };
        people_DatasetSummary: {
            allowedSelectionKeys?: string[];
            datasetKey?: string;
            description?: string;
            name?: string;
            requiredFieldGroups?: string[];
            /** Format: int64 */
            version?: number;
        };
        people_DecideScenarioRequest: {
            decision: string;
            reason: string;
            /** Format: int64 */
            version: number;
        };
        people_DecisionCheck: {
            checkCode?: string;
            entityReference?: string;
            entityType?: string;
            evidence?: {
                [key: string]: unknown;
            };
            outcome?: string;
            severity?: string;
        };
        people_DecisionMetrics: {
            /** Format: double */
            averageManagerSpan?: number;
            costCurrency?: string;
            /** Format: int32 */
            dataQualityScore?: number;
            /** Format: int32 */
            headcount?: number;
            /** Format: int32 */
            managerCount?: number;
            /** Format: int32 */
            maximumLayers?: number;
            /** Format: int32 */
            openPositionCount?: number;
            /** Format: int32 */
            organizationCount?: number;
            /** Format: int32 */
            organizationHealthScore?: number;
            plannedFte?: number;
            workforceCost?: number;
        };
        people_DecisionPack: {
            baseline?: components["schemas"]["people_DecisionMetrics"];
            baselineCurrent?: boolean;
            /** Format: date */
            baselineDate?: string;
            baselineFingerprint?: string;
            /** Format: int32 */
            blockingIssueCount?: number;
            checks?: components["schemas"]["people_DecisionCheck"][];
            decisionState?: string;
            delta?: components["schemas"]["people_DecisionMetrics"];
            /** Format: date */
            effectiveDate?: string;
            /** Format: date-time */
            evaluatedAt?: string;
            lifecycleState?: string;
            observedFingerprint?: string;
            proposed?: components["schemas"]["people_DecisionMetrics"];
            /** Format: int32 */
            readinessScore?: number;
            /** Format: uuid */
            scenarioId?: string;
            /** Format: int64 */
            scenarioVersion?: number;
            /** Format: uuid */
            validationRunId?: string;
            /** Format: int32 */
            warningCount?: number;
        };
        people_DecisionRequest: {
            decision: string;
            note: string;
            /** Format: int64 */
            version?: number;
        };
        people_DesignPolicy: {
            /** Format: double */
            maximumContingentPercent?: number;
            /** Format: int32 */
            maximumLayers?: number;
            /** Format: int32 */
            maximumManagerSpan?: number;
            /** Format: double */
            maximumVacancyPercent?: number;
            /** Format: int32 */
            minimumManagerSpan?: number;
        };
        people_DomainMetric: {
            key?: string;
            severity?: string;
            /** Format: int64 */
            value?: number;
        };
        people_DomainOperations: {
            dataBoundary?: string;
            domain?: string;
            /** Format: date-time */
            generatedAt?: string;
            metrics?: components["schemas"]["people_DomainMetric"][];
            workQueue?: components["schemas"]["people_ApprovalItem"][];
        };
        people_EmployeeContext: {
            businessTitle?: string;
            /** Format: int32 */
            directReportCount?: number;
            displayName?: string;
            managerDisplayName?: string;
            organizationName?: string;
            /** Format: uuid */
            personId?: string;
        };
        people_EnrollmentWindow: {
            /** Format: date-time */
            closesAt?: string;
            lifecycleState?: string;
            name?: string;
            /** Format: date-time */
            opensAt?: string;
            /** Format: uuid */
            windowId?: string;
            windowType?: string;
        };
        people_ExecuteConnectorRequest: {
            syncMode: string;
        };
        people_Goal: {
            /** Format: date */
            dueDate?: string;
            /** Format: uuid */
            goalId?: string;
            goalType?: string;
            /** Format: int32 */
            progressPercent?: number;
            status?: string;
            title?: string;
            /** Format: int64 */
            version?: number;
        };
        people_HealthSummary: {
            /** Format: int32 */
            attentionOrganizations?: number;
            /** Format: double */
            averageManagerSpan?: number;
            /** Format: double */
            contingentRatioPct?: number;
            /** Format: int32 */
            criticalOrganizations?: number;
            /** Format: int32 */
            dataQualityScore?: number;
            /** Format: int32 */
            disconnectedOrganizations?: number;
            /** Format: int32 */
            managerReferenceIssues?: number;
            /** Format: int32 */
            maximumLayers?: number;
            /** Format: double */
            medianManagerSpan?: number;
            /** Format: int32 */
            openPositions?: number;
            /** Format: int32 */
            organizationHealthScore?: number;
            /** Format: int32 */
            organizationsAtRisk?: number;
            /** Format: int32 */
            overloadedManagers?: number;
            /** Format: int32 */
            singleReportManagers?: number;
        };
        people_HomeDomainState: {
            /** @enum {string} */
            availability?: "AVAILABLE" | "UNAVAILABLE";
            /** @enum {string} */
            dataOrigin?: "SOURCE" | "MANUAL" | "REFERENCE" | "MIXED" | "NONE" | "UNKNOWN";
            reasonCode?: string;
        };
        people_HomeOverview: {
            /** Format: int32 */
            activeBenefitCount?: number;
            /** Format: int32 */
            activeGoalCount?: number;
            /** Format: date */
            asOf?: string;
            domainStates?: {
                [key: string]: components["schemas"]["people_HomeDomainState"];
            };
            employee?: components["schemas"]["people_EmployeeContext"];
            enrollmentWindows?: components["schemas"]["people_EnrollmentWindow"][];
            /** Format: date-time */
            generatedAt?: string;
            journeys?: components["schemas"]["people_Journey"][];
            leaveBalances?: components["schemas"]["people_LeaveBalance"][];
            /** Format: int32 */
            openBenefitWindowCount?: number;
            pay?: components["schemas"]["people_PayCycle"];
            referenceDataPresent?: boolean;
            /** Format: int32 */
            requiredLearningCount?: number;
            /** Format: int32 */
            standardDayMinutes?: number;
            /** Format: int32 */
            teamAbsencePendingCount?: number;
            /** Format: int32 */
            teamPendingCount?: number;
            /** Format: int32 */
            teamTimePendingCount?: number;
            time?: components["schemas"]["people_TimeCard"];
            timeZone?: string;
        };
        people_ImportResult: {
            /** Format: int64 */
            createdCount?: number;
            emittedEventTypes?: string[];
            lifecycleState?: string;
            /** Format: int64 */
            readCount?: number;
            /** Format: int64 */
            rejectedCount?: number;
            replayed?: boolean;
            sourceKey?: string;
            /** Format: uuid */
            syncRunId?: string;
            syntheticFixture?: boolean;
            /** Format: int64 */
            updatedCount?: number;
        };
        people_Intelligence: {
            /** Format: date */
            asOf?: string;
            changes?: components["schemas"]["people_Change"][];
            /** Format: date */
            compareTo?: string;
            comparison?: components["schemas"]["people_ComparisonSummary"];
            dataQualityIssues?: components["schemas"]["people_DataQualityIssue"][];
            health?: components["schemas"]["people_HealthSummary"];
            organizations?: components["schemas"]["people_OrganizationHealth"][];
        };
        people_Journey: {
            /** Format: uuid */
            journeyId?: string;
            journeyType?: string;
            name?: string;
            /** Format: int32 */
            progressPercent?: number;
            status?: string;
            /** Format: date */
            targetDate?: string;
        };
        people_JsonNode: unknown;
        people_Learning: {
            /** Format: date */
            dueDate?: string;
            /** Format: uuid */
            learningId?: string;
            /** Format: int32 */
            progressPercent?: number;
            providerName?: string;
            required?: boolean;
            status?: string;
            title?: string;
        };
        people_LeaveBalance: {
            /** Format: date */
            asOf?: string;
            /** Format: int32 */
            availableMinutes?: number;
            dataOrigin?: string;
            /** Format: int32 */
            grantedMinutes?: number;
            /** Format: int32 */
            pendingMinutes?: number;
            /** Format: uuid */
            planId?: string;
            planKey?: string;
            planName?: string;
            /** Format: int32 */
            usedMinutes?: number;
        };
        people_LeaveRequest: {
            cancellationNote?: string;
            /** Format: date-time */
            cancelledAt?: string;
            decisionNote?: string;
            /** Format: date-time */
            endAt?: string;
            /** Format: uuid */
            planId?: string;
            planName?: string;
            reason?: string;
            /** Format: uuid */
            requestId?: string;
            /** Format: int32 */
            requestedMinutes?: number;
            /** Format: date-time */
            startAt?: string;
            status?: string;
            /** Format: date-time */
            submittedAt?: string;
            /** Format: int64 */
            version?: number;
        };
        people_MappingProfile: {
            /** Format: date-time */
            activatedAt?: string;
            adapterType?: string;
            lifecycleState?: string;
            /** Format: uuid */
            mappingProfileId?: string;
            mappingSha256?: string;
            profileKey?: string;
            sourceSchemaVersion?: string;
            /** Format: int64 */
            sourceSystemId?: number;
            targetSchemaVersion?: string;
            /** Format: int64 */
            version?: number;
        };
        people_Metrics: {
            /** Format: int32 */
            activeHeadcount?: number;
            /** Format: int32 */
            contingentHeadcount?: number;
            costCurrency?: string;
            /** Format: int32 */
            headcount?: number;
            /** Format: int32 */
            locationCount?: number;
            /** Format: int32 */
            managerCount?: number;
            /** Format: int32 */
            onLeaveHeadcount?: number;
            /** Format: int32 */
            openPositionCount?: number;
            /** Format: int32 */
            organizationCount?: number;
            plannedFte?: number;
            workforceCostAmount?: number;
        };
        people_OpenPosition: {
            annualCostAmount?: number;
            /** Format: date */
            availabilityDate?: string;
            budgetedFte?: number;
            costCurrency?: string;
            criticality?: string;
            jobProfileName?: string;
            locationName?: string;
            /** Format: uuid */
            organizationId?: string;
            /** Format: uuid */
            positionId?: string;
            positionKey?: string;
            title?: string;
        };
        people_Organization: {
            /** Format: double */
            averageManagerSpan?: number;
            /** Format: int32 */
            childOrganizationCount?: number;
            colorToken?: string;
            /** Format: int32 */
            contingentHeadcount?: number;
            costCenterKey?: string;
            description?: string;
            /** Format: int32 */
            directHeadcount?: number;
            directMemberIds?: string[];
            healthSignals?: string[];
            healthStatus?: string;
            /** Format: int32 */
            layerDepth?: number;
            /** Format: uuid */
            leaderPersonId?: string;
            /** Format: int32 */
            managerCount?: number;
            name?: string;
            /** Format: int32 */
            openPositionCount?: number;
            /** Format: uuid */
            organizationId?: string;
            organizationKey?: string;
            organizationType?: string;
            organizationTypeName?: string;
            /** Format: uuid */
            parentOrganizationId?: string;
            shortName?: string;
            /** Format: int32 */
            totalHeadcount?: number;
        };
        people_OrganizationChart: {
            analysis?: components["schemas"]["people_Analysis"];
            /** Format: date */
            asOf?: string;
            company?: components["schemas"]["people_Company"];
            metrics?: components["schemas"]["people_Metrics"];
            openPositions?: components["schemas"]["people_OpenPosition"][];
            organizations?: components["schemas"]["people_Organization"][];
            people?: components["schemas"]["people_Person"][];
            positions?: components["schemas"]["people_Position"][];
            relationships?: components["schemas"]["people_Relationship"][];
            scenario?: components["schemas"]["people_ScenarioProjection"];
        };
        people_OrganizationHealth: {
            /** Format: double */
            averageManagerSpan?: number;
            /** Format: double */
            contingentRatioPct?: number;
            /** Format: int32 */
            directHeadcount?: number;
            /** Format: int32 */
            healthScore?: number;
            /** Format: int32 */
            layer?: number;
            /** Format: int32 */
            managerCount?: number;
            /** Format: int32 */
            openPositionCount?: number;
            /** Format: uuid */
            organizationId?: string;
            organizationName?: string;
            organizationType?: string;
            /** Format: int32 */
            overloadedManagerCount?: number;
            riskState?: string;
            signals?: string[];
            /** Format: int32 */
            totalHeadcount?: number;
        };
        people_OrganizationOption: {
            name?: string;
            /** Format: uuid */
            organizationId?: string;
            organizationKey?: string;
            /** Format: uuid */
            parentOrganizationId?: string;
        };
        people_PayCycle: {
            absenceValidated?: boolean;
            dataOrigin?: string;
            name?: string;
            /** Format: uuid */
            payCycleId?: string;
            /** Format: date */
            payDate?: string;
            /** Format: date */
            periodEnd?: string;
            /** Format: date */
            periodStart?: string;
            sourceConfirmed?: boolean;
            status?: string;
            timeValidated?: boolean;
        };
        people_PayStatement: {
            availabilityState?: string;
            downloadable?: boolean;
            periodLabel?: string;
            /** Format: date-time */
            publishedAt?: string;
            /** Format: uuid */
            statementId?: string;
        };
        people_PayWorkspace: {
            employee?: components["schemas"]["people_EmployeeContext"];
            monetaryDataRedacted?: boolean;
            nextCycle?: components["schemas"]["people_PayCycle"];
            statements?: components["schemas"]["people_PayStatement"][];
        };
        people_Person: {
            assignmentKey?: string;
            businessTitle?: string;
            /** Format: int32 */
            directReportCount?: number;
            displayName?: string;
            fullTimeEquivalent?: number;
            jobGradeKey?: string;
            jobGradeName?: string;
            /** Format: int32 */
            jobGradeOrder?: number;
            jobProfileName?: string;
            locationKey?: string;
            locationName?: string;
            managementLevel?: string;
            /** Format: uuid */
            managerPersonId?: string;
            managerReferenceMissing?: boolean;
            /** Format: uuid */
            organizationId?: string;
            /** Format: uuid */
            personId?: string;
            /** Format: uuid */
            positionId?: string;
            positionKey?: string;
            workEmail?: string;
            workerNumber?: string;
            workerStatus?: string;
            workerType?: string;
        };
        people_PersonDetail: {
            assignments?: components["schemas"]["people_AssignmentSummary"][];
            legalEmployerName?: string;
            managerAssignmentKey?: string;
            /** Format: date */
            originalHireDate?: string;
            person?: components["schemas"]["people_PersonSummary"];
            workers?: components["schemas"]["people_Worker"][];
        };
        people_PersonSummary: {
            /** Format: date */
            assignmentEffectiveFrom?: string;
            assignmentKey?: string;
            businessTitle?: string;
            dataAccess?: components["schemas"]["people_DataAccess"];
            /** Format: int32 */
            directReportCount?: number;
            displayName?: string;
            jobGradeKey?: string;
            jobGradeName?: string;
            jobProfileName?: string;
            lifecycleState?: string;
            locationKey?: string;
            locationName?: string;
            managementLevel?: string;
            managerDisplayName?: string;
            /** Format: uuid */
            managerPersonId?: string;
            /** Format: uuid */
            organizationId?: string;
            organizationKey?: string;
            organizationName?: string;
            /** Format: uuid */
            personId?: string;
            preferredLocale?: string;
            profileImageKey?: string;
            timeZone?: string;
            workEmail?: string;
            workerNumber?: string;
            workerStatus?: string;
            workerType?: string;
        };
        people_Policy: {
            actionCodes?: string[];
            fieldGroups?: string[];
            justification?: string;
            lifecycleState?: string;
            /** Format: uuid */
            organizationId?: string;
            organizationName?: string;
            /** Format: uuid */
            policyId?: string;
            populationType?: string;
            subjectRef?: string;
            subjectType?: string;
            /** Format: date-time */
            validFrom?: string;
            /** Format: date-time */
            validTo?: string;
            /** Format: int64 */
            version?: number;
        };
        people_Position: {
            annualCostAmount?: number;
            /** Format: date */
            availabilityDate?: string;
            budgetedFte?: number;
            costCurrency?: string;
            criticality?: string;
            incumbentPersonIds?: string[];
            jobProfileName?: string;
            locationName?: string;
            /** Format: uuid */
            organizationId?: string;
            /** Format: uuid */
            positionId?: string;
            positionKey?: string;
            positionType?: string;
            /** Format: uuid */
            reportsToPositionId?: string;
            status?: string;
            /** Format: int32 */
            subordinatePositionCount?: number;
            title?: string;
        };
        people_Preview: {
            allowedSelectionKeys?: string[];
            /** Format: int32 */
            artifactTtlHours?: number;
            authorized?: boolean;
            blockers?: string[];
            datasetKey?: string;
            /** Format: date-time */
            evaluatedAt?: string;
            executionEnabled?: boolean;
            exportFormat?: string;
            fieldGroups?: string[];
            maskingProfile?: string;
            /** Format: int32 */
            maximumAttempts?: number;
            /** Format: int32 */
            maximumManualRetries?: number;
            message?: string;
            organizationIds?: string[];
            populationType?: string;
            watermarkTemplate?: string;
        };
        people_PreviewRequest: {
            datasetKey: string;
            selection: {
                [key: string]: string;
            };
        };
        people_ProvisionTenantRequest: {
            dataRegion: string;
            displayName: string;
            isolationModel: string;
            /** Format: uuid */
            providerTenantId: string;
            /** Format: int64 */
            tenantId: number;
            tenantKey: string;
        };
        people_ProvisionTenantResponse: {
            externalReference?: string;
            lifecycleState?: string;
            /** Format: uuid */
            providerTenantId?: string;
            /** Format: int32 */
            schemaVersion?: number;
            /** Format: int64 */
            tenantId?: number;
        };
        people_PublishScenarioRequest: {
            /** Format: int64 */
            version: number;
        };
        people_ReconciliationIssue: {
            /** Format: uuid */
            connectorInstanceId?: string;
            entityType?: string;
            externalId?: string;
            /** Format: date-time */
            firstDetectedAt?: string;
            internalKey?: string;
            issueCode?: string;
            lifecycleState?: string;
            /** Format: uuid */
            reconciliationIssueId?: string;
            /** Format: uuid */
            reconciliationRunId?: string;
            redactedSummary?: string;
            /** Format: date-time */
            resolvedAt?: string;
            severity?: string;
        };
        people_ReconciliationRun: {
            /** Format: int64 */
            checkedCount?: number;
            /** Format: date-time */
            completedAt?: string;
            /** Format: uuid */
            connectorInstanceId?: string;
            /** Format: int64 */
            criticalCount?: number;
            /** Format: int64 */
            issueCount?: number;
            lifecycleState?: string;
            /** Format: uuid */
            reconciliationRunId?: string;
            /** Format: date-time */
            startedAt?: string;
            /** Format: uuid */
            syncRunId?: string;
        };
        people_ReferenceCatalog: {
            catalogKey?: string;
            editable?: boolean;
            ownership?: string;
            values?: components["schemas"]["people_ReferenceValue"][];
        };
        people_ReferenceValue: {
            code?: string;
            description?: string;
            detail?: string;
            displayName?: string;
            labels?: {
                [key: string]: string;
            };
            lifecycleState?: string;
            localizedLabel?: string;
            predefined?: boolean;
            /** Format: int32 */
            sortOrder?: number;
            /** Format: int64 */
            version?: number;
        };
        people_Relationship: {
            /** Format: uuid */
            childOrganizationId?: string;
            /** Format: uuid */
            parentOrganizationId?: string;
            primaryRelationship?: boolean;
            relationshipType?: string;
        };
        people_RequestSummary: {
            /** Format: date-time */
            artifactExpiresAt?: string;
            artifactSha256?: string;
            /** Format: int64 */
            artifactSizeBytes?: number;
            /** Format: int32 */
            attemptCount?: number;
            blockers?: string[];
            /** Format: date-time */
            cancellationRequestedAt?: string;
            /** Format: date-time */
            completedAt?: string;
            /** Format: date-time */
            createdAt?: string;
            datasetKey?: string;
            executionEnabled?: boolean;
            exportFormat?: string;
            fieldGroups?: string[];
            lifecycleState?: string;
            /** Format: int32 */
            manualRetryCount?: number;
            maskingProfile?: string;
            /** Format: date-time */
            nextAttemptAt?: string;
            organizationIds?: string[];
            populationType?: string;
            purpose?: string;
            recipientReference?: string;
            /** Format: uuid */
            requestId?: string;
            requestSha256?: string;
            /** Format: int32 */
            retryCycleAttemptCount?: number;
            selection?: {
                [key: string]: string;
            };
            sourceReference?: string;
            /** Format: date-time */
            updatedAt?: string;
            /** Format: int64 */
            version?: number;
            watermarkText?: string;
        };
        people_ResolveIssueRequest: {
            lifecycleState: string;
            resolutionNote: string;
        };
        people_RevokePolicyRequest: {
            reason: string;
            /** Format: int64 */
            version: number;
        };
        people_Scenario: {
            approval?: components["schemas"]["people_Approval"];
            /** Format: date */
            baselineDate?: string;
            changes?: components["schemas"]["people_Change"][];
            description?: string;
            /** Format: date */
            effectiveDate?: string;
            lifecycleState?: string;
            name?: string;
            /** Format: int64 */
            ownerUserId?: number;
            publicationEvidenceState?: string;
            /** Format: uuid */
            publicationValidationRunId?: string;
            /** Format: date-time */
            publishedAt?: string;
            /** Format: uuid */
            scenarioId?: string;
            scenarioKey?: string;
            /** Format: uuid */
            sourceScenarioId?: string;
            /** Format: date-time */
            submittedAt?: string;
            /** Format: int64 */
            version?: number;
        };
        people_ScenarioProjection: {
            /** Format: int32 */
            activeChangeCount?: number;
            /** Format: date */
            baseAsOf?: string;
            /** Format: date */
            effectiveDate?: string;
            lifecycleState?: string;
            name?: string;
            /** Format: uuid */
            scenarioId?: string;
            /** Format: int64 */
            version?: number;
        };
        people_SourceSystem: {
            lifecycleState?: string;
            name?: string;
            sourceKey?: string;
            /** Format: int64 */
            sourceSystemId?: number;
            systemType?: string;
            /** Format: int64 */
            version?: number;
        };
        people_SubmitScenarioRequest: {
            reason: string;
            /** Format: int64 */
            version: number;
        };
        people_SyncRun: {
            committedWatermark?: string;
            /** Format: date-time */
            completedAt?: string;
            /** Format: uuid */
            connectorInstanceId?: string;
            /** Format: int64 */
            createdCount?: number;
            failureCode?: string;
            lifecycleState?: string;
            /** Format: uuid */
            mappingProfileId?: string;
            /** Format: int32 */
            pageCount?: number;
            /** Format: int64 */
            readCount?: number;
            redactedFailureMessage?: string;
            /** Format: int64 */
            rejectedCount?: number;
            requestedWatermark?: string;
            /** Format: uuid */
            retryOfSyncRunId?: string;
            sourceKey?: string;
            /** Format: date-time */
            startedAt?: string;
            syncMode?: string;
            /** Format: uuid */
            syncRunId?: string;
            /** Format: int64 */
            unchangedCount?: number;
            /** Format: int64 */
            updatedCount?: number;
        };
        people_TalentWorkspace: {
            employee?: components["schemas"]["people_EmployeeContext"];
            goals?: components["schemas"]["people_Goal"][];
            journeys?: components["schemas"]["people_Journey"][];
            learning?: components["schemas"]["people_Learning"][];
        };
        people_TeamAbsence: {
            employeeName?: string;
            employeeTitle?: string;
            /** Format: date-time */
            endAt?: string;
            /** Format: uuid */
            personId?: string;
            planName?: string;
            /** Format: uuid */
            requestId?: string;
            /** Format: date-time */
            startAt?: string;
            status?: string;
        };
        people_TimeCard: {
            dataOrigin?: string;
            /** Format: int32 */
            exceptionCount?: number;
            /** Format: date */
            periodEnd?: string;
            /** Format: date */
            periodStart?: string;
            /** Format: int32 */
            recordedMinutes?: number;
            /** Format: int32 */
            scheduledMinutes?: number;
            status?: string;
            /** Format: uuid */
            timeCardId?: string;
            /** Format: int64 */
            version?: number;
        };
        people_TimeEntry: {
            entryType?: string;
            /** Format: int32 */
            minutes?: number;
            note?: string;
            /** Format: uuid */
            timeEntryId?: string;
            /** Format: int64 */
            version?: number;
            /** Format: date */
            workDate?: string;
            workMode?: string;
        };
        people_TimeException: {
            exceptionCode?: string;
            /** Format: uuid */
            exceptionId?: string;
            lifecycleState?: string;
            message?: string;
            /** Format: date */
            occurredOn?: string;
            resolutionNote?: string;
            severity?: string;
        };
        people_TimeWorkspace: {
            card?: components["schemas"]["people_TimeCard"];
            employee?: components["schemas"]["people_EmployeeContext"];
            entries?: components["schemas"]["people_TimeEntry"][];
            exceptions?: components["schemas"]["people_TimeException"][];
            teamQueue?: components["schemas"]["people_ApprovalItem"][];
        };
        people_UpdateConnectorRequest: {
            credentialReference?: string;
            endpointUri?: string;
            lifecycleState: string;
            scheduleExpression?: string;
            /** Format: int64 */
            version: number;
        };
        people_UpdateGoalRequest: {
            /** Format: int32 */
            progressPercent?: number;
            status: string;
            /** Format: int64 */
            version?: number;
        };
        people_UpdateLifecycleRequest: {
            lifecycleState: string;
        };
        people_UpdateReferenceValueRequest: {
            description?: string;
            displayName: string;
            labels: {
                [key: string]: string;
            };
            lifecycleState: string;
            /** Format: int64 */
            version?: number;
        };
        people_UpsertTimeEntryRequest: {
            /** Format: int64 */
            cardVersion?: number;
            /** Format: int32 */
            minutes?: number;
            note?: string;
            workMode: string;
        };
        people_ValidateScenarioRequest: {
            /** Format: int64 */
            version: number;
        };
        people_ValidationRunSummary: {
            baselineCurrent?: boolean;
            /** Format: int32 */
            blockingIssueCount?: number;
            correlationId?: string;
            decisionState?: string;
            /** Format: date-time */
            evaluatedAt?: string;
            /** Format: int64 */
            evaluatedBy?: number;
            /** Format: int32 */
            readinessScore?: number;
            /** Format: int64 */
            scenarioVersion?: number;
            triggerType?: string;
            /** Format: uuid */
            validationRunId?: string;
            /** Format: int32 */
            warningCount?: number;
        };
        people_WithdrawLeaveRequest: {
            note: string;
            /** Format: int64 */
            version?: number;
        };
        people_WorkAssignment: {
            /** Format: uuid */
            assignmentId?: string;
            assignmentKey?: string;
            assignmentStatus?: string;
            businessTitle?: string;
            changeReasonCode?: string;
            /** Format: date */
            effectiveEndDate?: string;
            /** Format: int32 */
            effectiveSequence?: number;
            /** Format: date */
            effectiveStartDate?: string;
            jobGradeName?: string;
            jobProfileName?: string;
            locationKey?: string;
            locationName?: string;
            managerAssignmentKey?: string;
            /** Format: uuid */
            organizationId?: string;
            organizationKey?: string;
            organizationName?: string;
            primaryAssignment?: boolean;
        };
        people_WorkRelationship: {
            assignments?: components["schemas"]["people_WorkAssignment"][];
            /** Format: date */
            endDate?: string;
            legalEmployerCountryCode?: string;
            legalEmployerKey?: string;
            legalEmployerName?: string;
            primaryRelationship?: boolean;
            /** Format: date */
            projectedEndDate?: string;
            relationshipKey?: string;
            relationshipType?: string;
            /** Format: date */
            startDate?: string;
            /** Format: uuid */
            workRelationshipId?: string;
        };
        people_Worker: {
            /** Format: date */
            originalHireDate?: string;
            workRelationships?: components["schemas"]["people_WorkRelationship"][];
            /** Format: uuid */
            workerId?: string;
            workerNumber?: string;
            workerStatus?: string;
            workerType?: string;
        };
        platform_ActivityEvent: {
            actor?: string;
            actorName?: string;
            auditId?: string;
            /** Format: uuid */
            id?: string;
            objectLabel?: string;
            objectType?: string;
            /** Format: date-time */
            occurredAt?: string;
            /** Format: int32 */
            progress?: number;
            source?: string;
            sourceRoute?: string;
            state?: string;
            summary?: string;
            title?: string;
            tool?: string;
        };
        platform_ActivityFeed: {
            events?: components["schemas"]["platform_ActivityEvent"][];
            /** Format: date-time */
            generatedAt?: string;
        };
        platform_AdminCatalogItem: {
            categoryKey?: string;
            /** @enum {string} */
            dataClassification?: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
            descriptionEn?: string;
            descriptionKo?: string;
            /** Format: int32 */
            estimatedResolutionHours?: number;
            featured?: boolean;
            /** @enum {string} */
            lifecycleState?: "DRAFT" | "ACTIVE" | "RETIRED";
            nameEn?: string;
            nameKo?: string;
            ownerGroup?: string;
            requestSchema?: components["schemas"]["platform_JsonNode"];
            /** Format: int32 */
            schemaVersion?: number;
            serviceKey?: string;
            /** Format: int32 */
            slaHours?: number;
            tags?: string[];
            /** Format: int64 */
            version?: number;
        };
        platform_AdminNode: {
            children?: components["schemas"]["platform_AdminNode"][];
            iconKey?: string;
            itemType?: string;
            labels?: components["schemas"]["platform_Label"][];
            lifecycleState?: string;
            /** Format: int64 */
            navigationItemId?: number;
            navigationKey?: string;
            /** Format: int64 */
            parentNavigationItemId?: number;
            registryEntryKey?: string;
            requiredPermissionCode?: string;
            requiredResourceKey?: string;
            route?: string;
            /** Format: int32 */
            sortOrder?: number;
            /** Format: int64 */
            version?: number;
        };
        platform_AdminOverview: {
            /** Format: int64 */
            activeResources?: number;
            /** Format: int64 */
            bookingsThisWeek?: number;
            /** Format: int64 */
            conflictedUsers?: number;
            /** Format: int64 */
            eventsThisWeek?: number;
            /** Format: date-time */
            generatedAt?: string;
            /** Format: int64 */
            pendingBookings?: number;
            policy?: components["schemas"]["platform_Policy"];
            resources?: components["schemas"]["platform_ResourceSummary"][];
            /** Format: int64 */
            resourcesInMaintenance?: number;
        };
        platform_AnnouncementDefinition: {
            /** Format: date-time */
            acknowledgementDueAt?: string;
            acknowledgementRequired?: boolean;
            actionLabel?: string;
            actionUrl?: string;
            /** @enum {string} */
            audienceType: "ALL" | "ROLE";
            audienceValue?: string;
            body?: string;
            categoryKey?: string;
            /** @enum {string} */
            contentType?: "ANNOUNCEMENT" | "NEWS" | "EVENT" | "POLICY_UPDATE";
            coverImageUrl?: string;
            dismissible?: boolean;
            /** Format: date-time */
            endsAt?: string;
            featured?: boolean;
            message: string;
            pinned: boolean;
            publisherName?: string;
            /** Format: int32 */
            readingMinutes?: number;
            /** @enum {string} */
            severity: "INFO" | "SUCCESS" | "WARNING" | "CRITICAL";
            sourceLocale?: string;
            /** Format: date-time */
            startsAt?: string;
            title: string;
        };
        platform_AnnouncementResponse: {
            /** Format: int64 */
            acknowledgementCount?: number;
            /** Format: date-time */
            acknowledgementDueAt?: string;
            acknowledgementRequired?: boolean;
            /** Format: int64 */
            actionClickCount?: number;
            actionLabel?: string;
            actionUrl?: string;
            /** Format: int64 */
            announcementId?: number;
            /** @enum {string} */
            audienceType?: "ALL" | "ROLE";
            audienceValue?: string;
            body?: string;
            categoryKey?: string;
            /** @enum {string} */
            contentType?: "ANNOUNCEMENT" | "NEWS" | "EVENT" | "POLICY_UPDATE";
            coverImageUrl?: string;
            dismissible?: boolean;
            /** Format: date-time */
            endsAt?: string;
            featured?: boolean;
            /** @enum {string} */
            lifecycleState?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
            message?: string;
            pinned?: boolean;
            /** Format: date-time */
            publishedAt?: string;
            /** Format: int64 */
            publishedBy?: number;
            publisherName?: string;
            /** Format: int32 */
            readingMinutes?: number;
            /** @enum {string} */
            severity?: "INFO" | "SUCCESS" | "WARNING" | "CRITICAL";
            sourceLocale?: string;
            /** Format: date-time */
            startsAt?: string;
            title?: string;
            /** Format: int64 */
            uniqueViewerCount?: number;
            /** Format: date-time */
            updatedAt?: string;
            /** Format: int64 */
            updatedBy?: number;
            /** Format: int64 */
            version?: number;
            /** Format: int64 */
            viewCount?: number;
        };
        platform_ApiHistoryEvent: {
            actorId?: string;
            actorType?: string;
            authType?: string;
            capturePolicyVersion?: string;
            clientAddressHash?: string;
            /** Format: date-time */
            completedAt?: string;
            correlationId?: string;
            /** Format: int64 */
            durationMs?: number;
            environment?: string;
            errorType?: string;
            /** Format: uuid */
            historyId?: string;
            httpMethod?: string;
            httpProtocol?: string;
            httpScheme?: string;
            observationPoint?: string;
            /** Format: date-time */
            occurredAt?: string;
            outcome?: string;
            parentSpanId?: string;
            requestPath?: string;
            /** Format: int64 */
            requestSizeBytes?: number;
            /** Format: int64 */
            responseSizeBytes?: number;
            routeId?: string;
            routeTemplate?: string;
            serviceInstance?: string;
            serviceName?: string;
            serviceVersion?: string;
            spanId?: string;
            /** Format: int32 */
            statusCode?: number;
            /** Format: int64 */
            tenantId?: number;
            traceId?: string;
            userAgentFamily?: string;
            userAgentHash?: string;
        };
        platform_ApiResponseActivityFeed: {
            correlationId?: string;
            data?: components["schemas"]["platform_ActivityFeed"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseAdminCatalogItem: {
            correlationId?: string;
            data?: components["schemas"]["platform_AdminCatalogItem"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseAdminNode: {
            correlationId?: string;
            data?: components["schemas"]["platform_AdminNode"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseAdminOverview: {
            correlationId?: string;
            data?: components["schemas"]["platform_AdminOverview"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseAnnouncementResponse: {
            correlationId?: string;
            data?: components["schemas"]["platform_AnnouncementResponse"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseAppAccessRequest: {
            correlationId?: string;
            data?: components["schemas"]["platform_AppAccessRequest"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseAppLaunch: {
            correlationId?: string;
            data?: components["schemas"]["platform_AppLaunch"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseAssuranceFinding: {
            correlationId?: string;
            data?: components["schemas"]["platform_AssuranceFinding"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseAssuranceSummary: {
            correlationId?: string;
            data?: components["schemas"]["platform_AssuranceSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseAuditCase: {
            correlationId?: string;
            data?: components["schemas"]["platform_AuditCase"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseAuditPage: {
            correlationId?: string;
            data?: components["schemas"]["platform_AuditPage"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseAuditReceipt: {
            correlationId?: string;
            data?: components["schemas"]["platform_AuditReceipt"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseAuthorizationStart: {
            correlationId?: string;
            data?: components["schemas"]["platform_AuthorizationStart"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseAvailabilityResponse: {
            correlationId?: string;
            data?: components["schemas"]["platform_AvailabilityResponse"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseBookingSummary: {
            correlationId?: string;
            data?: components["schemas"]["platform_BookingSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseCaseClosureReport: {
            correlationId?: string;
            data?: components["schemas"]["platform_CaseClosureReport"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseCaseTask: {
            correlationId?: string;
            data?: components["schemas"]["platform_CaseTask"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseCaseWorkspace: {
            correlationId?: string;
            data?: components["schemas"]["platform_CaseWorkspace"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseCatalogResponse: {
            correlationId?: string;
            data?: components["schemas"]["platform_CatalogResponse"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseCatalogSnapshot: {
            correlationId?: string;
            data?: components["schemas"]["platform_CatalogSnapshot"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseCodeSet: {
            correlationId?: string;
            data?: components["schemas"]["platform_CodeSet"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseCommunicationItem: {
            correlationId?: string;
            data?: components["schemas"]["platform_CommunicationItem"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseConfigurationCheck: {
            correlationId?: string;
            data?: components["schemas"]["platform_ConfigurationCheck"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseConnection: {
            correlationId?: string;
            data?: components["schemas"]["platform_Connection"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseConnector: {
            correlationId?: string;
            data?: components["schemas"]["platform_Connector"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseCorrelationDetail: {
            correlationId?: string;
            data?: components["schemas"]["platform_CorrelationDetail"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseCorrelationPage: {
            correlationId?: string;
            data?: components["schemas"]["platform_CorrelationPage"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseDiff: {
            correlationId?: string;
            data?: components["schemas"]["platform_Diff"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseEvent: {
            correlationId?: string;
            data?: components["schemas"]["platform_Event"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseEventPage: {
            correlationId?: string;
            data?: components["schemas"]["platform_EventPage"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseEventSummary: {
            correlationId?: string;
            data?: components["schemas"]["platform_EventSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseExportJob: {
            correlationId?: string;
            data?: components["schemas"]["platform_ExportJob"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseFeedResponse: {
            correlationId?: string;
            data?: components["schemas"]["platform_FeedResponse"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseFinding: {
            correlationId?: string;
            data?: components["schemas"]["platform_Finding"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseFindingContext: {
            correlationId?: string;
            data?: components["schemas"]["platform_FindingContext"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseGraph: {
            correlationId?: string;
            data?: components["schemas"]["platform_Graph"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseHomeExperienceResponse: {
            correlationId?: string;
            data?: components["schemas"]["platform_HomeExperienceResponse"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseHomeOverviewResponse: {
            correlationId?: string;
            data?: components["schemas"]["platform_HomeOverviewResponse"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseHomePreferenceResponse: {
            correlationId?: string;
            data?: components["schemas"]["platform_HomePreferenceResponse"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseHomeResponse: {
            correlationId?: string;
            data?: components["schemas"]["platform_HomeResponse"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseImpactAnalysis: {
            correlationId?: string;
            data?: components["schemas"]["platform_ImpactAnalysis"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseIngestResult: {
            correlationId?: string;
            data?: components["schemas"]["platform_IngestResult"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseItemPage: {
            correlationId?: string;
            data?: components["schemas"]["platform_ItemPage"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseListAdminCatalogItem: {
            correlationId?: string;
            data?: components["schemas"]["platform_AdminCatalogItem"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseListAdminNode: {
            correlationId?: string;
            data?: components["schemas"]["platform_AdminNode"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseListAnnouncementResponse: {
            correlationId?: string;
            data?: components["schemas"]["platform_AnnouncementResponse"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseListAppAccessRequest: {
            correlationId?: string;
            data?: components["schemas"]["platform_AppAccessRequest"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseListAuditCase: {
            correlationId?: string;
            data?: components["schemas"]["platform_AuditCase"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseListBookingSummary: {
            correlationId?: string;
            data?: components["schemas"]["platform_BookingSummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseListBrandingRevisionResponse: {
            correlationId?: string;
            data?: components["schemas"]["platform_BrandingRevisionResponse"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseListCalendarSummary: {
            correlationId?: string;
            data?: components["schemas"]["platform_CalendarSummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseListConnection: {
            correlationId?: string;
            data?: components["schemas"]["platform_Connection"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseListConnector: {
            correlationId?: string;
            data?: components["schemas"]["platform_Connector"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseListEventSummary: {
            correlationId?: string;
            data?: components["schemas"]["platform_EventSummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseListFinding: {
            correlationId?: string;
            data?: components["schemas"]["platform_Finding"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseListHomeExperienceRevisionResponse: {
            correlationId?: string;
            data?: components["schemas"]["platform_HomeExperienceRevisionResponse"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseListIntegrityCheckpoint: {
            correlationId?: string;
            data?: components["schemas"]["platform_IntegrityCheckpoint"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseListOrphanedView: {
            correlationId?: string;
            data?: components["schemas"]["platform_OrphanedView"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseListOwnershipTransferSummary: {
            correlationId?: string;
            data?: components["schemas"]["platform_OwnershipTransferSummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseListPolicyRevision: {
            correlationId?: string;
            data?: components["schemas"]["platform_PolicyRevision"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseListPreferenceExceptionRequest: {
            correlationId?: string;
            data?: components["schemas"]["platform_PreferenceExceptionRequest"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseListRequestSummary: {
            correlationId?: string;
            data?: components["schemas"]["platform_RequestSummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseListResourceSummary: {
            correlationId?: string;
            data?: components["schemas"]["platform_ResourceSummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseListRevision: {
            correlationId?: string;
            data?: components["schemas"]["platform_Revision"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseListRuntimeNode: {
            correlationId?: string;
            data?: components["schemas"]["platform_RuntimeNode"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseListRuntimeRegistryEntry: {
            correlationId?: string;
            data?: components["schemas"]["platform_RuntimeRegistryEntry"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseListSavedSearch: {
            correlationId?: string;
            data?: components["schemas"]["platform_SavedSearch"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseListSavedView: {
            correlationId?: string;
            data?: components["schemas"]["platform_SavedView"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseListSubject: {
            correlationId?: string;
            data?: components["schemas"]["platform_Subject"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseListSyncRun: {
            correlationId?: string;
            data?: components["schemas"]["platform_SyncRun"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseListWorkItem: {
            correlationId?: string;
            data?: components["schemas"]["platform_WorkItem"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseListWorkspaceApp: {
            correlationId?: string;
            data?: components["schemas"]["platform_WorkspaceApp"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseManagedPreferencePolicy: {
            correlationId?: string;
            data?: components["schemas"]["platform_ManagedPreferencePolicy"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseOverview: {
            correlationId?: string;
            data?: components["schemas"]["platform_Overview"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseOwnershipPreview: {
            correlationId?: string;
            data?: components["schemas"]["platform_OwnershipPreview"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseOwnershipTransfer: {
            correlationId?: string;
            data?: components["schemas"]["platform_OwnershipTransfer"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponsePageResultReferenceSetSummary: {
            correlationId?: string;
            data?: components["schemas"]["platform_PageResultReferenceSetSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponsePageResultRegistryEntryResponse: {
            correlationId?: string;
            data?: components["schemas"]["platform_PageResultRegistryEntryResponse"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponsePersonalPreferenceResponse: {
            correlationId?: string;
            data?: components["schemas"]["platform_PersonalPreferenceResponse"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponsePolicy: {
            correlationId?: string;
            data?: components["schemas"]["platform_Policy"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponsePolicyRevision: {
            correlationId?: string;
            data?: components["schemas"]["platform_PolicyRevision"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponsePreferenceExceptionRequest: {
            correlationId?: string;
            data?: components["schemas"]["platform_PreferenceExceptionRequest"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponsePreview: {
            correlationId?: string;
            data?: components["schemas"]["platform_Preview"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseReactionSummary: {
            correlationId?: string;
            data?: components["schemas"]["platform_ReactionSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseReaderPreferenceResponse: {
            correlationId?: string;
            data?: components["schemas"]["platform_ReaderPreferenceResponse"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseRecommendationFeedbackResponse: {
            correlationId?: string;
            data?: components["schemas"]["platform_RecommendationFeedbackResponse"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseReferenceSetDetail: {
            correlationId?: string;
            data?: components["schemas"]["platform_ReferenceSetDetail"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseRegistryEntryDetail: {
            correlationId?: string;
            data?: components["schemas"]["platform_RegistryEntryDetail"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseRegistryEntryResponse: {
            correlationId?: string;
            data?: components["schemas"]["platform_RegistryEntryResponse"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseRelation: {
            correlationId?: string;
            data?: components["schemas"]["platform_Relation"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseRequestDetail: {
            correlationId?: string;
            data?: components["schemas"]["platform_RequestDetail"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseResourceSummary: {
            correlationId?: string;
            data?: components["schemas"]["platform_ResourceSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseRetentionPolicy: {
            correlationId?: string;
            data?: components["schemas"]["platform_RetentionPolicy"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseRevision: {
            correlationId?: string;
            data?: components["schemas"]["platform_Revision"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseRuntimeCodeSet: {
            correlationId?: string;
            data?: components["schemas"]["platform_RuntimeCodeSet"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseRuntimeReferenceSet: {
            correlationId?: string;
            data?: components["schemas"]["platform_RuntimeReferenceSet"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseRuntimeRegistryEntry: {
            correlationId?: string;
            data?: components["schemas"]["platform_RuntimeRegistryEntry"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseSavedSearch: {
            correlationId?: string;
            data?: components["schemas"]["platform_SavedSearch"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseSavedView: {
            correlationId?: string;
            data?: components["schemas"]["platform_SavedView"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseSyncRun: {
            correlationId?: string;
            data?: components["schemas"]["platform_SyncRun"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseTenantBrandingResponse: {
            correlationId?: string;
            data?: components["schemas"]["platform_TenantBrandingResponse"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseTraceDetail: {
            correlationId?: string;
            data?: components["schemas"]["platform_TraceDetail"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseVoid: {
            correlationId?: string;
            data?: unknown;
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseWorkItem: {
            correlationId?: string;
            data?: components["schemas"]["platform_WorkItem"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseWorkQueue: {
            correlationId?: string;
            data?: components["schemas"]["platform_WorkQueue"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseWorkspace: {
            correlationId?: string;
            data?: components["schemas"]["platform_Workspace"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_ApiResponseWorkspaceApp: {
            correlationId?: string;
            data?: components["schemas"]["platform_WorkspaceApp"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        platform_AppAccessDecisionRequest: {
            decision: string;
            decisionNote: string;
            /** Format: int64 */
            version: number;
        };
        platform_AppAccessFulfillmentRequest: {
            note: string;
            /** Format: int64 */
            version: number;
        };
        platform_AppAccessRequest: {
            appId?: string;
            appName?: string;
            /** Format: date-time */
            createdAt?: string;
            /** Format: date-time */
            decidedAt?: string;
            /** Format: int64 */
            decidedBy?: number;
            decisionNote?: string;
            /** Format: date-time */
            fulfilledAt?: string;
            /** Format: int64 */
            fulfilledBy?: number;
            /** Format: int32 */
            fulfillmentAttempts?: number;
            fulfillmentNote?: string;
            fulfillmentState?: string;
            justification?: string;
            /** Format: date-time */
            lastFulfillmentAt?: string;
            lastFulfillmentError?: string;
            /** Format: uuid */
            requestId?: string;
            requestedPermissionCode?: string;
            /** Format: date-time */
            requestedUntil?: string;
            resourceKey?: string;
            revocationNote?: string;
            /** Format: date-time */
            revokedAt?: string;
            /** Format: int64 */
            revokedBy?: number;
            state?: string;
            /** Format: date-time */
            updatedAt?: string;
            /** Format: int64 */
            userId?: number;
            /** Format: int64 */
            version?: number;
        };
        platform_AppLaunch: {
            appId?: string;
            launchMode?: string;
            launchTarget?: string;
            /** Format: date-time */
            launchedAt?: string;
        };
        platform_AssuranceFinding: {
            /** Format: date-time */
            disposedAt?: string;
            /** Format: int64 */
            disposedBy?: number;
            dispositionEvidenceRef?: string;
            dispositionReason?: string;
            entityRef?: string;
            evidence?: components["schemas"]["platform_JsonNode"];
            evidenceSha256?: string;
            findingCode?: string;
            /** Format: uuid */
            findingId?: string;
            /** Format: date-time */
            firstDetectedAt?: string;
            /** Format: date-time */
            lastDetectedAt?: string;
            lifecycleState?: string;
            ruleKey?: string;
            /** Format: int64 */
            ruleVersion?: number;
            severity?: string;
            /** Format: int64 */
            version?: number;
        };
        platform_AssuranceSummary: {
            activeRule?: components["schemas"]["platform_CompatibilityRule"];
            /** Format: int64 */
            criticalCount?: number;
            /** Format: int64 */
            deprecationImpactCount?: number;
            findings?: components["schemas"]["platform_AssuranceFinding"][];
            /** Format: date-time */
            generatedAt?: string;
            /** Format: int64 */
            openCount?: number;
            /** Format: int64 */
            ownerMissingCount?: number;
        };
        platform_Attendee: {
            email?: string;
            name?: string;
            /** Format: uuid */
            personPublicId?: string;
            /** @enum {string} */
            response?: "NEEDS_ACTION" | "ACCEPTED" | "TENTATIVE" | "DECLINED";
            /** @enum {string} */
            type?: "REQUIRED" | "OPTIONAL" | "RESOURCE";
            /** Format: int64 */
            userId?: number;
        };
        platform_AttendeeInput: {
            /** Format: email */
            email: string;
            name: string;
            /** Format: uuid */
            personPublicId?: string;
            /** @enum {string} */
            type: "REQUIRED" | "OPTIONAL" | "RESOURCE";
            /** Format: int64 */
            userId?: number;
        };
        platform_AttentionItem: {
            actionPath?: string;
            description?: string;
            /** Format: uuid */
            eventId?: string;
            key?: string;
            severity?: string;
            title?: string;
        };
        platform_AudienceContext: {
            profile?: string;
            reasons?: string[];
            ruleVersion?: string;
        };
        platform_AuditCase: {
            /** Format: uuid */
            caseId?: string;
            /** Format: int64 */
            caseNumber?: number;
            /** Format: date-time */
            closedAt?: string;
            createdBy?: string;
            description?: string;
            /** Format: date-time */
            dueAt?: string;
            /** Format: int32 */
            linkedEvents?: number;
            /** Format: int32 */
            linkedFindings?: number;
            /** Format: date-time */
            openedAt?: string;
            ownerActorId?: string;
            resolution?: string;
            severity?: string;
            slaState?: string;
            status?: string;
            title?: string;
            /** Format: date-time */
            updatedAt?: string;
            updatedBy?: string;
        };
        platform_AuditEvent: {
            action?: string;
            actorDisplayName?: string;
            actorId?: string;
            actorPrincipal?: string;
            actorRoles?: string[];
            actorType?: string;
            afterState?: {
                [key: string]: unknown;
            };
            approvalId?: string;
            authenticationMethod?: string;
            beforeState?: {
                [key: string]: unknown;
            };
            category?: string;
            clientAddressHash?: string;
            correlationId?: string;
            environment?: string;
            /** Format: uuid */
            eventId?: string;
            eventVersion?: string;
            metadata?: {
                [key: string]: unknown;
            };
            /** Format: date-time */
            occurredAt?: string;
            outcome?: string;
            policyDecision?: string;
            policyId?: string;
            reason?: string;
            retentionClass?: string;
            /** Format: int32 */
            riskScore?: number;
            sessionIdHash?: string;
            severity?: string;
            sourceInstance?: string;
            sourceModule?: string;
            sourceService?: string;
            targetDisplayName?: string;
            targetId?: string;
            targetType?: string;
            /** Format: int64 */
            tenantId?: number;
            traceId?: string;
        };
        platform_AuditEventResponse: {
            action?: string;
            /** Format: int64 */
            actorId?: number;
            actorType?: string;
            /** Format: uuid */
            auditEventId?: string;
            correlationId?: string;
            /** Format: date-time */
            occurredAt?: string;
            outcome?: string;
            targetId?: string;
            targetType?: string;
        };
        platform_AuditPage: {
            content?: components["schemas"]["platform_AuditEventResponse"][];
            /** Format: int32 */
            page?: number;
            /** Format: int32 */
            size?: number;
            /** Format: int64 */
            totalElements?: number;
            /** Format: int32 */
            totalPages?: number;
        };
        platform_AuditReceipt: {
            eventId?: string;
            queryDigest?: string;
        };
        platform_AuditRequest: {
            phase: string;
            query: string;
            /** Format: int32 */
            resultCount?: number;
            selectedId?: string;
            selectedKind?: string;
            sources?: string[];
        };
        platform_AuthorizationCallbackRequest: {
            code: string;
            state: string;
        };
        platform_AuthorizationStart: {
            authorizationUrl?: string;
            /** Format: date-time */
            expiresAt?: string;
            /** Format: uuid */
            transactionId?: string;
        };
        platform_AvailabilityParticipant: {
            /** Format: int32 */
            availableSlotCount?: number;
            /** Format: int32 */
            busyMinutes?: number;
            /** Format: uuid */
            personPublicId?: string;
        };
        platform_AvailabilityResponse: {
            /** Format: date-time */
            generatedAt?: string;
            participants?: components["schemas"]["platform_AvailabilityParticipant"][];
            suggestions?: components["schemas"]["platform_AvailabilitySlot"][];
        };
        platform_AvailabilitySlot: {
            /** Format: date-time */
            endsAt?: string;
            reason?: string;
            /** Format: int32 */
            score?: number;
            /** Format: date-time */
            startsAt?: string;
        };
        platform_BatchUpdateWorkStatusRequest: {
            items: components["schemas"]["platform_WorkStatusChange"][];
            status: string;
        };
        platform_BookingDecisionRequest: {
            decision: string;
            note?: string;
            /** Format: int64 */
            version: number;
        };
        platform_BookingSummary: {
            /** Format: uuid */
            bookingId?: string;
            /** Format: date-time */
            decidedAt?: string;
            /** Format: int64 */
            decidedBy?: number;
            decisionNote?: string;
            /** Format: date-time */
            endsAt?: string;
            /** Format: uuid */
            eventId?: string;
            eventTitle?: string;
            organizerEmail?: string;
            organizerName?: string;
            /** Format: int64 */
            requestedBy?: number;
            /** Format: uuid */
            resourceId?: string;
            resourceName?: string;
            /** Format: date-time */
            startsAt?: string;
            status?: string;
            /** Format: int64 */
            version?: number;
        };
        platform_BrandingRevisionResponse: {
            accentColor?: string;
            changeType?: string;
            /** Format: date-time */
            createdAt?: string;
            /** Format: int64 */
            createdBy?: number;
            current?: boolean;
            /** Format: int32 */
            logoHeight?: number;
            logoOriginalName?: string;
            /** Format: int32 */
            logoWidth?: number;
            organizationName?: string;
            /** Format: int64 */
            revisionId?: number;
            /** Format: int64 */
            sourceVersion?: number;
        };
        platform_CalendarSummary: {
            /** Format: uuid */
            calendarId?: string;
            calendarKey?: string;
            color?: string;
            name?: string;
            selected?: boolean;
            /** @enum {string} */
            type?: "PERSONAL" | "TEAM" | "RESOURCE" | "SYSTEM";
            visibility?: string;
        };
        platform_CaseActivity: {
            /** Format: uuid */
            activityId?: string;
            activityType?: string;
            actorId?: string;
            message?: string;
            /** Format: date-time */
            occurredAt?: string;
            payload?: {
                [key: string]: unknown;
            };
        };
        platform_CaseClosureReport: {
            /** Format: uuid */
            caseId?: string;
            /** Format: int64 */
            caseNumber?: number;
            contentSha256?: string;
            /** Format: date-time */
            generatedAt?: string;
            generatedBy?: string;
            report?: {
                [key: string]: unknown;
            };
            /** Format: uuid */
            reportId?: string;
            /** Format: int32 */
            reportVersion?: number;
        };
        platform_CaseCreate: {
            description?: string;
            ownerActorId?: string;
            severity?: string;
            title?: string;
        };
        platform_CaseEntity: {
            attributes?: {
                [key: string]: unknown;
            };
            displayName?: string;
            entityId?: string;
            entityType?: string;
            /** Format: date-time */
            firstSeenAt?: string;
            /** Format: date-time */
            lastSeenAt?: string;
            relationship?: string;
            /** Format: int32 */
            riskScore?: number;
        };
        platform_CaseEventLink: {
            /** Format: uuid */
            eventId?: string;
            note?: string;
            /** Format: date-time */
            occurredAt?: string;
        };
        platform_CaseNoteCreate: {
            message?: string;
        };
        platform_CaseTask: {
            /** Format: date-time */
            completedAt?: string;
            /** Format: date-time */
            createdAt?: string;
            createdBy?: string;
            description?: string;
            /** Format: date-time */
            dueAt?: string;
            ownerActorId?: string;
            priority?: string;
            status?: string;
            /** Format: uuid */
            taskId?: string;
            title?: string;
            /** Format: date-time */
            updatedAt?: string;
            updatedBy?: string;
        };
        platform_CaseTaskCreate: {
            description?: string;
            /** Format: date-time */
            dueAt?: string;
            ownerActorId?: string;
            priority?: string;
            title?: string;
        };
        platform_CaseTaskUpdate: {
            description?: string;
            /** Format: date-time */
            dueAt?: string;
            ownerActorId?: string;
            priority?: string;
            status?: string;
            title?: string;
        };
        platform_CaseUpdate: {
            description?: string;
            ownerActorId?: string;
            resolution?: string;
            severity?: string;
            status?: string;
            title?: string;
        };
        platform_CaseWorkspace: {
            activities?: components["schemas"]["platform_CaseActivity"][];
            auditCase?: components["schemas"]["platform_AuditCase"];
            entities?: components["schemas"]["platform_CaseEntity"][];
            evidence?: components["schemas"]["platform_Event"][];
            findings?: components["schemas"]["platform_Finding"][];
            summary?: components["schemas"]["platform_InvestigationSummary"];
            tasks?: components["schemas"]["platform_CaseTask"][];
        };
        platform_CatalogDefinitionRequest: {
            categoryKey: string;
            /** @enum {string} */
            dataClassification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
            descriptionEn: string;
            descriptionKo: string;
            /** Format: int32 */
            estimatedResolutionHours?: number;
            featured?: boolean;
            /** @enum {string} */
            lifecycleState: "DRAFT" | "ACTIVE" | "RETIRED";
            nameEn: string;
            nameKo: string;
            ownerGroup: string;
            requestSchema: components["schemas"]["platform_JsonNode"];
            serviceKey: string;
            /** Format: int32 */
            slaHours?: number;
            tags: string[];
            /** Format: int64 */
            version?: number;
        };
        platform_CatalogItem: {
            categoryKey?: string;
            /** @enum {string} */
            dataClassification?: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
            description?: string;
            /** Format: int32 */
            estimatedResolutionHours?: number;
            featured?: boolean;
            /** @enum {string} */
            lifecycleState?: "DRAFT" | "ACTIVE" | "RETIRED";
            name?: string;
            ownerGroup?: string;
            requestSchema?: components["schemas"]["platform_JsonNode"];
            /** Format: int32 */
            schemaVersion?: number;
            serviceKey?: string;
            /** Format: int32 */
            slaHours?: number;
            tags?: string[];
            /** Format: int64 */
            version?: number;
        };
        platform_CatalogResponse: {
            /** Format: int64 */
            activeCount?: number;
            categories?: components["schemas"]["platform_Category"][];
            /** Format: date-time */
            generatedAt?: string;
            items?: components["schemas"]["platform_CatalogItem"][];
        };
        platform_CatalogSnapshot: {
            catalogScope?: string;
            changePolicy?: string;
            codeSets?: components["schemas"]["platform_CodeSetHealth"][];
        };
        platform_Category: {
            categoryKey?: string;
            description?: string;
            iconKey?: string;
            name?: string;
            /** Format: int32 */
            sortOrder?: number;
            tone?: string;
        };
        platform_CodeBinding: {
            consumerService?: string;
            enforcementType?: string;
            sourceReference?: string;
            usageType?: string;
        };
        platform_CodeSet: {
            bindings?: components["schemas"]["platform_CodeBinding"][];
            codeSetKey?: string;
            configurationLevel?: string;
            contractKind?: string;
            description?: string;
            displayName?: string;
            ownerService?: string;
            runtimeVisibility?: string;
            /** Format: int32 */
            schemaVersion?: number;
            sourceReference?: string;
            validationSource?: string;
            values?: components["schemas"]["platform_CodeValue"][];
        };
        platform_CodeSetHealth: {
            /** Format: int64 */
            bindingCount?: number;
            codeSetKey?: string;
            configurationLevel?: string;
            contractKind?: string;
            displayName?: string;
            /** Format: int64 */
            enforcedBindingCount?: number;
            ownerService?: string;
            registrationState?: string;
            runtimeVisibility?: string;
            /** Format: int32 */
            schemaVersion?: number;
            validationSource?: string;
            /** Format: int64 */
            valueCount?: number;
        };
        platform_CodeValue: {
            behaviorMetadata?: components["schemas"]["platform_JsonNode"];
            code?: string;
            displayName?: string;
            label?: string;
            lifecycleState?: string;
            predefined?: boolean;
            /** Format: int32 */
            sortOrder?: number;
        };
        platform_CommunicationItem: {
            /** Format: date-time */
            acknowledgementDueAt?: string;
            acknowledgementRequired?: boolean;
            actionLabel?: string;
            actionUrl?: string;
            body?: string;
            categoryKey?: string;
            /** Format: int64 */
            communicationId?: number;
            /** @enum {string} */
            contentType?: "ANNOUNCEMENT" | "NEWS" | "EVENT" | "POLICY_UPDATE";
            coverImageUrl?: string;
            dismissible?: boolean;
            /** Format: date-time */
            endsAt?: string;
            featured?: boolean;
            pinned?: boolean;
            /** Format: date-time */
            publishedAt?: string;
            publisherName?: string;
            reactions?: components["schemas"]["platform_ReactionSummary"];
            readerState?: components["schemas"]["platform_ReaderState"];
            /** Format: int32 */
            readingMinutes?: number;
            /** @enum {string} */
            severity?: "INFO" | "SUCCESS" | "WARNING" | "CRITICAL";
            sourceLocale?: string;
            summary?: string;
            title?: string;
        };
        platform_CompatibilityRule: {
            contentSha256?: string;
            definition?: components["schemas"]["platform_JsonNode"];
            ruleKey?: string;
            /** Format: int64 */
            ruleVersion?: number;
        };
        platform_ConfigurationCheck: {
            blockingCodes?: string[];
            /** Format: date-time */
            checkedAt?: string;
            checks?: string[];
            /** Format: uuid */
            connectorId?: string;
            /** @enum {string} */
            healthState?: "CONFIGURATION_REQUIRED" | "HEALTHY" | "DEGRADED" | "AUTHENTICATION_REQUIRED" | "UNAVAILABLE";
            ready?: boolean;
        };
        platform_Connection: {
            actionRequiredCode?: string;
            /** Format: uuid */
            connectorId?: string;
            connectorKey?: string;
            /** @enum {string} */
            consentState?: "NOT_CONNECTED" | "CONNECTED" | "REAUTHORIZATION_REQUIRED" | "REVOKED";
            displayName?: string;
            grantedScopes?: string[];
            /** @enum {string} */
            healthState?: "CONFIGURATION_REQUIRED" | "HEALTHY" | "DEGRADED" | "AUTHENTICATION_REQUIRED" | "UNAVAILABLE";
            /** Format: date-time */
            lastSuccessfulSyncAt?: string;
            /** @enum {string} */
            lifecycleState?: "DRAFT" | "ACTIVE" | "SUSPENDED" | "RETIRED";
            /** @enum {string} */
            providerType?: "MICROSOFT_GRAPH";
            requestedScopes?: string[];
        };
        platform_Connector: {
            /** @enum {string} */
            authMode?: "DELEGATED";
            capabilities?: string[];
            clientId?: string;
            /** Format: uuid */
            connectorId?: string;
            connectorKey?: string;
            /** Format: int32 */
            consecutiveFailures?: number;
            credentialReference?: string;
            displayName?: string;
            /** @enum {string} */
            healthState?: "CONFIGURATION_REQUIRED" | "HEALTHY" | "DEGRADED" | "AUTHENTICATION_REQUIRED" | "UNAVAILABLE";
            /** Format: date-time */
            lastConfigurationCheckAt?: string;
            /** Format: date-time */
            lastSuccessfulSyncAt?: string;
            /** @enum {string} */
            lifecycleState?: "DRAFT" | "ACTIVE" | "SUSPENDED" | "RETIRED";
            /** @enum {string} */
            policyState?: "REVIEW_REQUIRED" | "APPROVED" | "BLOCKED";
            providerTenantId?: string;
            /** @enum {string} */
            providerType?: "MICROSOFT_GRAPH";
            redirectUri?: string;
            requestedScopes?: string[];
            safeErrorCode?: string;
            /** Format: int64 */
            version?: number;
        };
        platform_Correlation: {
            attentionRequired?: boolean;
            classifications?: string[];
            correlationId?: string;
            /** Format: int32 */
            domainCount?: number;
            domains?: string[];
            /** Format: int64 */
            eventCount?: number;
            /** Format: date-time */
            firstOccurredAt?: string;
            /** Format: date-time */
            lastOccurredAt?: string;
            latestEventType?: string;
            latestSubjectDisplayName?: string;
            latestSubjectId?: string;
            latestSubjectType?: string;
            /** Format: int32 */
            maxRiskScore?: number;
            maxSeverity?: string;
            outcomes?: string[];
            /** Format: int32 */
            serviceCount?: number;
            sourceServices?: string[];
        };
        platform_CorrelationDetail: {
            events?: components["schemas"]["platform_Envelope"][];
            summary?: components["schemas"]["platform_Correlation"];
        };
        platform_CorrelationPage: {
            content?: components["schemas"]["platform_Correlation"][];
            /** Format: int32 */
            page?: number;
            /** Format: int32 */
            size?: number;
            /** Format: int64 */
            totalElements?: number;
            /** Format: int32 */
            totalPages?: number;
        };
        platform_CreateAnnouncementRequest: {
            definition: components["schemas"]["platform_AnnouncementDefinition"];
        };
        platform_CreateAppAccessRequest: {
            justification: string;
            /** Format: date-time */
            requestedUntil?: string;
        };
        platform_CreateBundleRequest: {
            bundleKey: string;
            changeSummary: string;
            entries: {
                [key: string]: string;
            };
            sourceEntries: {
                [key: string]: string;
            };
            sourceLocale: string;
            targetLocale: string;
        };
        platform_CreateDraftRequest: {
            changeSummary?: string;
        };
        platform_CreateEventRequest: {
            allDay?: boolean;
            attendees: components["schemas"]["platform_AttendeeInput"][];
            conferenceUrl?: string;
            description?: string;
            /** Format: date-time */
            endsAt: string;
            /** Format: uuid */
            idempotencyKey: string;
            location?: string;
            /** @enum {string} */
            recurrence: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
            /** Format: int32 */
            recurrenceInterval?: number;
            /** Format: date */
            recurrenceUntil?: string;
            /** Format: uuid */
            resourceId?: string;
            responseRequired?: boolean;
            /** Format: date-time */
            startsAt: string;
            timeZone: string;
            title: string;
            /** @enum {string} */
            type: "MEETING" | "FOCUS" | "TASK" | "OUT_OF_OFFICE" | "REMINDER";
            /** @enum {string} */
            visibility: "DEFAULT" | "PUBLIC" | "PRIVATE" | "CONFIDENTIAL";
        };
        platform_CreateExceptionRequest: {
            businessImpact: string;
            businessJustification: string;
            preferencePath: string;
            /** Format: date-time */
            requestedUntil?: string;
            requestedValue: components["schemas"]["platform_JsonNode"];
        };
        platform_CreateItemRequest: {
            code: string;
            labels: components["schemas"]["platform_LocalizedLabelRequest"][];
            parentCode?: string;
            /** Format: int32 */
            sortOrder: number;
            /** Format: date-time */
            validFrom?: string;
            /** Format: date-time */
            validTo?: string;
        };
        platform_CreateRegistryEntryRequest: {
            artifactVersion: string;
            description?: string;
            entryKey: string;
            name: string;
            ownerRef: string;
            /** @enum {string} */
            registryType: "APP" | "CONNECTOR" | "AGENT" | "TOOL" | "POLICY" | "API" | "DATA_PRODUCT";
            /** @enum {string} */
            riskTier: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
        };
        platform_CreateRegistryRevisionRequest: {
            artifactVersion: string;
            description?: string;
            name: string;
            ownerRef: string;
            /** @enum {string} */
            riskTier: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
        };
        platform_CreateRequest: {
            configuration: {
                [key: string]: unknown;
            };
            defaultView?: boolean;
            favorite?: boolean;
            name: string;
            /** Format: uuid */
            ownerGroupRef?: string;
            scope: string;
        };
        platform_CreateSetRequest: {
            description?: string;
            name: string;
            setKey: string;
        };
        platform_DayLoad: {
            /** Format: int32 */
            conflictCount?: number;
            /** Format: date */
            date?: string;
            /** Format: int32 */
            eventCount?: number;
            /** Format: int32 */
            focusMinutes?: number;
            /** Format: int32 */
            loadPercent?: number;
            /** Format: int32 */
            meetingMinutes?: number;
        };
        platform_DecideExceptionRequest: {
            decision: string;
            evidenceRef?: string;
            reason: string;
            /** Format: int64 */
            version: number;
        };
        platform_DecisionRequest: {
            decision: string;
            reason: string;
            /** Format: int64 */
            version: number;
        };
        platform_DeclareRelationRequest: {
            criticality: string;
            evidenceRef?: string;
            metadata?: components["schemas"]["platform_JsonNode"];
            relationType: string;
            sourceRef: string;
            targetRef: string;
            /** Format: int64 */
            version?: number;
        };
        platform_Diff: {
            /** Format: int64 */
            added?: number;
            /** Format: uuid */
            comparedWithRevisionId?: string;
            entries?: components["schemas"]["platform_DiffEntry"][];
            /** Format: int64 */
            removed?: number;
            /** Format: uuid */
            revisionId?: string;
            /** Format: int64 */
            unchanged?: number;
            /** Format: int64 */
            updated?: number;
        };
        platform_DiffEntry: {
            afterValue?: string;
            beforeValue?: string;
            changeType?: string;
            fallback?: boolean;
            key?: string;
            sourceValue?: string;
        };
        platform_DiffSummary: {
            /** Format: int64 */
            added?: number;
            /** Format: int64 */
            changed?: number;
            /** Format: int64 */
            lifecycleChanged?: number;
            /** Format: int64 */
            removed?: number;
            /** Format: int64 */
            reordered?: number;
        };
        platform_DispositionFindingRequest: {
            decision: string;
            evidenceRef?: string;
            reason: string;
            /** Format: int64 */
            version: number;
        };
        platform_Entity: {
            description?: string;
            key?: string;
            kind?: string;
            lifecycleState?: string;
            metadata?: components["schemas"]["platform_JsonNode"];
            name?: string;
            ownerRef?: string;
            ref?: string;
            /** Format: int64 */
            revision?: number;
            riskTier?: string;
            scope?: string;
        };
        platform_Envelope: {
            actorDisplayName?: string;
            actorId?: string;
            actorType?: string;
            afterState?: {
                [key: string]: unknown;
            };
            beforeState?: {
                [key: string]: unknown;
            };
            causationId?: string;
            classification?: string;
            correlationId?: string;
            domain?: string;
            /** Format: uuid */
            eventId?: string;
            eventType?: string;
            /** Format: date-time */
            ingestedAt?: string;
            metadata?: {
                [key: string]: unknown;
            };
            /** Format: date-time */
            occurredAt?: string;
            outcome?: string;
            recordHash?: string;
            /** Format: int32 */
            riskScore?: number;
            schemaVersion?: string;
            severity?: string;
            sourceModule?: string;
            sourceService?: string;
            subjectDisplayName?: string;
            subjectId?: string;
            subjectType?: string;
            /** Format: int64 */
            tenantId?: number;
            traceId?: string;
        };
        platform_Event: {
            action?: string;
            actorDisplayName?: string;
            actorId?: string;
            actorPrincipal?: string;
            actorRoles?: string[];
            actorType?: string;
            afterState?: {
                [key: string]: unknown;
            };
            approvalId?: string;
            authenticationMethod?: string;
            beforeState?: {
                [key: string]: unknown;
            };
            category?: string;
            changedFields?: string[];
            correlationId?: string;
            environment?: string;
            /** Format: uuid */
            eventId?: string;
            /** Format: date-time */
            ingestedAt?: string;
            metadata?: {
                [key: string]: unknown;
            };
            /** Format: date-time */
            occurredAt?: string;
            outcome?: string;
            policyDecision?: string;
            policyId?: string;
            reason?: string;
            recordHash?: string;
            retentionClass?: string;
            /** Format: int32 */
            riskScore?: number;
            severity?: string;
            sourceInstance?: string;
            sourceModule?: string;
            sourceService?: string;
            targetDisplayName?: string;
            targetId?: string;
            targetType?: string;
            /** Format: int64 */
            tenantId?: number;
            traceId?: string;
        };
        platform_EventPage: {
            content?: components["schemas"]["platform_Event"][];
            /** Format: int32 */
            page?: number;
            /** Format: int32 */
            size?: number;
            /** Format: int64 */
            totalElements?: number;
            /** Format: int32 */
            totalPages?: number;
        };
        platform_EventResponse: {
            actorId?: string;
            actorType?: string;
            authType?: string;
            capturePolicyVersion?: string;
            clientAddressHash?: string;
            /** Format: date-time */
            completedAt?: string;
            correlationId?: string;
            /** Format: int64 */
            durationMs?: number;
            environment?: string;
            errorType?: string;
            /** Format: uuid */
            historyId?: string;
            httpMethod?: string;
            httpProtocol?: string;
            httpScheme?: string;
            /** Format: date-time */
            ingestedAt?: string;
            observationPoint?: string;
            /** Format: date-time */
            occurredAt?: string;
            outcome?: string;
            parentSpanId?: string;
            requestPath?: string;
            /** Format: int64 */
            requestSizeBytes?: number;
            /** Format: int64 */
            responseSizeBytes?: number;
            routeId?: string;
            routeTemplate?: string;
            serviceInstance?: string;
            serviceName?: string;
            serviceVersion?: string;
            spanId?: string;
            /** Format: int32 */
            statusCode?: number;
            /** Format: int64 */
            tenantId?: number;
            traceId?: string;
            userAgentFamily?: string;
            userAgentHash?: string;
        };
        platform_EventSummary: {
            allDay?: boolean;
            attendees?: components["schemas"]["platform_Attendee"][];
            calendarColor?: string;
            /** Format: uuid */
            calendarId?: string;
            calendarName?: string;
            conferenceUrl?: string;
            conflict?: boolean;
            description?: string;
            /** Format: date-time */
            endsAt?: string;
            /** Format: uuid */
            eventId?: string;
            location?: string;
            /** @enum {string} */
            myResponse?: "NEEDS_ACTION" | "ACCEPTED" | "TENTATIVE" | "DECLINED";
            organizerEmail?: string;
            organizerName?: string;
            /** Format: uuid */
            organizerPersonPublicId?: string;
            /** Format: int64 */
            organizerUserId?: number;
            /** @enum {string} */
            recurrence?: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
            /** Format: int32 */
            recurrenceInterval?: number;
            /** Format: date */
            recurrenceUntil?: string;
            resource?: components["schemas"]["platform_ResourceSummary"];
            responseRequired?: boolean;
            /** Format: date-time */
            startsAt?: string;
            /** @enum {string} */
            status?: "CONFIRMED" | "TENTATIVE" | "CANCELLED";
            timeZone?: string;
            title?: string;
            /** @enum {string} */
            type?: "MEETING" | "FOCUS" | "TASK" | "OUT_OF_OFFICE" | "REMINDER";
            /** Format: int64 */
            version?: number;
            /** @enum {string} */
            visibility?: "DEFAULT" | "PUBLIC" | "PRIVATE" | "CONFIDENTIAL";
        };
        platform_ExportJob: {
            /** Format: date-time */
            completedAt?: string;
            contentSha256?: string;
            errorMessage?: string;
            /** Format: date-time */
            expiresAt?: string;
            /** Format: uuid */
            exportJobId?: string;
            format?: string;
            /** Format: date-time */
            requestedAt?: string;
            /** Format: int32 */
            rowCount?: number;
            status?: string;
        };
        platform_ExportRequest: {
            actor?: string;
            category?: string;
            format?: string;
            outcome?: string;
            query?: string;
            reason?: string;
            severity?: string;
            sourceService?: string;
            /** @enum {string} */
            window?: "H24" | "D7" | "D30" | "D90";
        };
        platform_FeedResponse: {
            featured?: components["schemas"]["platform_CommunicationItem"];
            /** Format: date-time */
            generatedAt?: string;
            items?: components["schemas"]["platform_CommunicationItem"][];
            summary?: components["schemas"]["platform_FeedSummary"];
        };
        platform_FeedSummary: {
            /** Format: int64 */
            required?: number;
            /** Format: int64 */
            saved?: number;
            /** Format: int64 */
            total?: number;
            /** Format: int64 */
            unread?: number;
        };
        platform_Finding: {
            actorId?: string;
            assignedTo?: string;
            /** Format: uuid */
            caseId?: string;
            description?: string;
            /** Format: uuid */
            eventId?: string;
            /** Format: uuid */
            findingId?: string;
            findingType?: string;
            /** Format: date-time */
            firstSeenAt?: string;
            /** Format: date-time */
            lastSeenAt?: string;
            /** Format: int32 */
            occurrenceCount?: number;
            resolution?: string;
            /** Format: int32 */
            riskScore?: number;
            ruleKey?: string;
            severity?: string;
            sourceService?: string;
            status?: string;
            targetId?: string;
            targetType?: string;
            title?: string;
            /** Format: date-time */
            updatedAt?: string;
        };
        platform_FindingContext: {
            finding?: components["schemas"]["platform_Finding"];
            primaryEvent?: components["schemas"]["platform_Event"];
            relatedEvents?: components["schemas"]["platform_Event"][];
        };
        platform_FindingUpdate: {
            assignedTo?: string;
            /** Format: uuid */
            caseId?: string;
            resolution?: string;
            status?: string;
        };
        platform_Graph: {
            focusRef?: string;
            /** Format: date-time */
            generatedAt?: string;
            nodes?: components["schemas"]["platform_GraphNode"][];
            relations?: components["schemas"]["platform_Relation"][];
            truncated?: boolean;
        };
        platform_GraphNode: {
            entity?: components["schemas"]["platform_Entity"];
            /** Format: int64 */
            incomingCount?: number;
            orphan?: boolean;
            /** Format: int64 */
            outgoingCount?: number;
        };
        platform_HomeAppPlacement: {
            groupKey?: string;
            resourceKey?: string;
            /** Format: int32 */
            sortOrder?: number;
        };
        platform_HomeExperienceResponse: {
            backgroundContentType?: string;
            /** Format: int32 */
            backgroundHeight?: number;
            backgroundOriginalName?: string;
            backgroundPosition?: string;
            /** Format: int64 */
            backgroundSizeBytes?: number;
            backgroundUrl?: string;
            /** Format: int32 */
            backgroundWidth?: number;
            defaultLocale?: string;
            headline?: string;
            launchpadConfiguration?: components["schemas"]["platform_HomeLaunchpadConfiguration"];
            localizedContent?: {
                [key: string]: components["schemas"]["platform_LocalizedCopy"];
            };
            /** Format: int32 */
            overlayOpacity?: number;
            subheadline?: string;
            /** Format: date-time */
            updatedAt?: string;
            /** Format: int64 */
            updatedBy?: number;
            /** Format: int64 */
            version?: number;
        };
        platform_HomeExperienceRevisionResponse: {
            /** Format: int32 */
            backgroundHeight?: number;
            backgroundOriginalName?: string;
            /** Format: int32 */
            backgroundWidth?: number;
            changeType?: string;
            /** Format: date-time */
            createdAt?: string;
            /** Format: int64 */
            createdBy?: number;
            current?: boolean;
            headline?: string;
            /** Format: int32 */
            localeCount?: number;
            /** Format: int64 */
            revisionId?: number;
            /** Format: int64 */
            sourceVersion?: number;
        };
        platform_HomeLaunchpadConfiguration: {
            groups?: components["schemas"]["platform_HomeLaunchpadGroup"][];
            placements?: components["schemas"]["platform_HomeAppPlacement"][];
            /** Format: int32 */
            schemaVersion?: number;
        };
        platform_HomeLaunchpadGroup: {
            descriptions?: {
                [key: string]: string;
            };
            enabled?: boolean;
            groupKey?: string;
            labels?: {
                [key: string]: string;
            };
            /** Format: int32 */
            sortOrder?: number;
        };
        platform_HomeLayoutPayload: {
            appLayout?: components["schemas"]["platform_JsonNode"];
            presentation?: string;
            widgets: components["schemas"]["platform_WidgetPreference"][];
        };
        platform_HomeMetrics: {
            /** Format: int32 */
            availableRoomCount?: number;
            /** Format: int32 */
            awaitingResponseCount?: number;
            /** Format: int32 */
            conflictCount?: number;
            /** Format: int32 */
            eventCount?: number;
            /** Format: int32 */
            focusMinutes?: number;
            /** Format: int32 */
            focusTargetMinutes?: number;
            /** Format: int32 */
            meetingMinutes?: number;
        };
        platform_HomeOverviewResponse: {
            activity?: components["schemas"]["platform_SectionActivityFeed"];
            audience?: components["schemas"]["platform_AudienceContext"];
            calendar?: components["schemas"]["platform_SectionHomeResponse"];
            communications?: components["schemas"]["platform_SectionFeedResponse"];
            /** Format: date-time */
            generatedAt?: string;
            recommendations?: components["schemas"]["platform_Recommendation"][];
            work?: components["schemas"]["platform_SectionWorkQueue"];
        };
        platform_HomePreferenceResponse: {
            customized?: boolean;
            layout?: components["schemas"]["platform_HomeLayoutPayload"];
            /** Format: int32 */
            schemaVersion?: number;
            surfaceKey?: string;
            /** Format: date-time */
            updatedAt?: string;
            /** Format: int64 */
            version?: number;
        };
        platform_HomeResponse: {
            attention?: components["schemas"]["platform_AttentionItem"][];
            /** Format: date */
            date?: string;
            /** Format: date-time */
            generatedAt?: string;
            metrics?: components["schemas"]["platform_HomeMetrics"];
            nextEvent?: components["schemas"]["platform_EventSummary"];
            timeZone?: string;
            today?: components["schemas"]["platform_EventSummary"][];
            weekLoad?: components["schemas"]["platform_DayLoad"][];
        };
        platform_ImpactAnalysis: {
            blocked?: boolean;
            compatibilityState?: string;
            /** Format: int64 */
            directDependentCount?: number;
            findings?: string[];
            /** Format: date-time */
            generatedAt?: string;
            impactedEntities?: components["schemas"]["platform_ImpactItem"][];
            operation?: string;
            /** Format: int32 */
            riskScore?: number;
            ruleKey?: string;
            /** Format: int64 */
            ruleVersion?: number;
            target?: components["schemas"]["platform_Entity"];
            /** Format: int64 */
            transitiveDependentCount?: number;
        };
        platform_ImpactItem: {
            /** Format: int32 */
            distance?: number;
            entity?: components["schemas"]["platform_Entity"];
            highestCriticality?: string;
            relationTypes?: string[];
        };
        platform_IngestResult: {
            /** Format: int32 */
            accepted?: number;
        };
        platform_IntegrityCheckpoint: {
            /** Format: date */
            checkpointDate?: string;
            checkpointHash?: string;
            /** Format: uuid */
            checkpointId?: string;
            /** Format: date-time */
            createdAt?: string;
            /** Format: date-time */
            firstEventAt?: string;
            /** Format: date-time */
            lastEventAt?: string;
            /** Format: int64 */
            recordCount?: number;
            rootHash?: string;
            signatureAlgorithm?: string;
            verificationStatus?: string;
            /** Format: date-time */
            verifiedAt?: string;
        };
        platform_InvestigationSummary: {
            /** Format: int32 */
            entityCount?: number;
            /** Format: int32 */
            evidenceCount?: number;
            /** Format: int32 */
            findingCount?: number;
            /** Format: int32 */
            maxRiskScore?: number;
            /** Format: int32 */
            openTasks?: number;
            /** Format: int32 */
            overdueTasks?: number;
        };
        platform_ItemPage: {
            content?: components["schemas"]["platform_ProductivityItem"][];
            /** Format: int32 */
            page?: number;
            /** Format: int32 */
            size?: number;
            /** Format: int64 */
            totalElements?: number;
        };
        platform_JsonNode: unknown;
        platform_Label: {
            description?: string;
            label: string;
            locale: string;
        };
        platform_LifecycleRequest: {
            /** Format: int64 */
            version: number;
        };
        platform_LocalizedCopy: {
            headline?: string;
            subheadline?: string;
        };
        platform_LocalizedLabelRequest: {
            description?: string;
            label: string;
            locale: string;
        };
        platform_ManagedPreferencePolicy: {
            contactUri?: string;
            managedPaths?: string[];
            ownerDisplayName?: string;
            ownerRef?: string;
            ownerType?: string;
            /** Format: uuid */
            policyId?: string;
            rules?: components["schemas"]["platform_ManagedPreferenceRule"][];
            scope?: string;
            source?: string;
            /** Format: int64 */
            version?: number;
        };
        platform_ManagedPreferenceRule: {
            displayKey?: string;
            exceptionAllowed?: boolean;
            managedValue?: components["schemas"]["platform_JsonNode"];
            preferencePath?: string;
            /** Format: uuid */
            ruleId?: string;
            /** Format: int64 */
            version?: number;
        };
        platform_OrphanedView: {
            name?: string;
            /** Format: uuid */
            ownerGroupRef?: string;
            /** Format: date-time */
            retentionUntil?: string;
            /** Format: uuid */
            savedViewId?: string;
            scope?: string;
            surfaceKey?: string;
            /** Format: date-time */
            updatedAt?: string;
        };
        platform_Overview: {
            /** Format: int64 */
            activeConnectors?: number;
            /** Format: int64 */
            connectedSubjects?: number;
            connectorHealth?: components["schemas"]["platform_Connector"][];
            /** Format: int64 */
            connectors?: number;
            /** Format: int64 */
            failedRuns24h?: number;
            /** Format: date-time */
            lastSuccessfulSyncAt?: string;
            recentRuns?: components["schemas"]["platform_SyncRun"][];
            /** Format: int64 */
            staleStreams?: number;
        };
        platform_OwnershipCandidate: {
            name?: string;
            /** Format: uuid */
            ownerGroupRef?: string;
            /** Format: uuid */
            savedViewId?: string;
            scope?: string;
            surfaceKey?: string;
            /** Format: date-time */
            updatedAt?: string;
            /** Format: int64 */
            version?: number;
        };
        platform_OwnershipPlanRequest: {
            disposition: string;
            reason: string;
            reasonCode: string;
            /** Format: date-time */
            retentionUntil?: string;
            /** Format: int64 */
            sourceOwnerUserId: number;
            sourceReference: string;
            /** Format: int64 */
            targetOwnerUserId?: number;
        };
        platform_OwnershipPreview: {
            /** Format: int32 */
            affectedCount?: number;
            disposition?: string;
            /** Format: date-time */
            evaluatedAt?: string;
            ownershipFingerprint?: string;
            /** Format: date-time */
            retentionUntil?: string;
            /** Format: int64 */
            sourceOwnerUserId?: number;
            /** Format: int64 */
            targetOwnerUserId?: number;
            views?: components["schemas"]["platform_OwnershipCandidate"][];
        };
        platform_OwnershipTransfer: {
            /** Format: date-time */
            createdAt?: string;
            /** Format: int64 */
            createdBy?: number;
            disposition?: string;
            idempotencyKey?: string;
            ownershipFingerprint?: string;
            reasonCode?: string;
            requestFingerprint?: string;
            /** Format: date-time */
            retentionUntil?: string;
            /** Format: int64 */
            sourceOwnerUserId?: number;
            sourceReference?: string;
            /** Format: int64 */
            targetOwnerUserId?: number;
            /** Format: uuid */
            transferBatchId?: string;
            /** Format: int32 */
            transferredCount?: number;
        };
        platform_OwnershipTransferRequest: {
            disposition: string;
            /** Format: int32 */
            expectedCount?: number;
            idempotencyKey: string;
            ownershipFingerprint: string;
            reason: string;
            reasonCode: string;
            /** Format: date-time */
            retentionUntil?: string;
            /** Format: int64 */
            sourceOwnerUserId: number;
            sourceReference: string;
            /** Format: int64 */
            targetOwnerUserId?: number;
        };
        platform_OwnershipTransferSummary: {
            /** Format: date-time */
            createdAt?: string;
            /** Format: int64 */
            createdBy?: number;
            disposition?: string;
            reasonCode?: string;
            /** Format: date-time */
            retentionUntil?: string;
            /** Format: int64 */
            sourceOwnerUserId?: number;
            sourceReference?: string;
            /** Format: int64 */
            targetOwnerUserId?: number;
            /** Format: uuid */
            transferBatchId?: string;
            /** Format: int32 */
            transferredCount?: number;
        };
        platform_PageResultReferenceSetSummary: {
            content?: components["schemas"]["platform_ReferenceSetSummary"][];
            /** Format: int32 */
            page?: number;
            /** Format: int32 */
            size?: number;
            /** Format: int64 */
            totalElements?: number;
            /** Format: int32 */
            totalPages?: number;
        };
        platform_PageResultRegistryEntryResponse: {
            content?: components["schemas"]["platform_RegistryEntryResponse"][];
            /** Format: int32 */
            page?: number;
            /** Format: int32 */
            size?: number;
            /** Format: int64 */
            totalElements?: number;
            /** Format: int32 */
            totalPages?: number;
        };
        platform_PatchPersonalPreferenceRequest: {
            patch: components["schemas"]["platform_JsonNode"];
            /** Format: int64 */
            version: number;
        };
        platform_PersonalPreferenceResponse: {
            customized?: boolean;
            managedPolicy?: components["schemas"]["platform_ManagedPreferencePolicy"];
            preferences?: components["schemas"]["platform_JsonNode"];
            /** Format: int32 */
            schemaVersion?: number;
            /** Format: date-time */
            updatedAt?: string;
            /** Format: int64 */
            version?: number;
        };
        platform_PinAppRequest: {
            pinned: boolean;
            /** Format: int64 */
            version: number;
        };
        platform_PlaceholderIssue: {
            actual?: string[];
            expected?: string[];
            key?: string;
        };
        platform_Policy: {
            allowExternalAttendees?: boolean;
            /** Format: int32 */
            dailyMeetingLimitMinutes?: number;
            /** Format: int32 */
            defaultBufferMinutes?: number;
            /** Format: int32 */
            defaultEventMinutes?: number;
            enforceMeetingAgenda?: boolean;
            /** Format: int32 */
            maximumAdvanceDays?: number;
            /** Format: int32 */
            maximumEventMinutes?: number;
            /** Format: int32 */
            minimumEventMinutes?: number;
            /** Format: int64 */
            version?: number;
            /** Format: int32 */
            weekStart?: number;
            /** Format: int32 */
            weeklyFocusTargetMinutes?: number;
            workingDayEnd?: string;
            workingDayStart?: string;
        };
        platform_PolicyApproval: {
            /** Format: uuid */
            approvalId?: string;
            /** Format: date-time */
            decidedAt?: string;
            decidedBy?: string;
            decisionReason?: string;
            /** Format: date-time */
            expiresAt?: string;
            lifecycleState?: string;
            /** Format: date-time */
            requestedAt?: string;
            requestedBy?: string;
            /** Format: int64 */
            version?: number;
        };
        platform_PolicyRequest: {
            allowExternalAttendees?: boolean;
            /** Format: int32 */
            dailyMeetingLimitMinutes?: number;
            /** Format: int32 */
            defaultBufferMinutes?: number;
            /** Format: int32 */
            defaultEventMinutes?: number;
            enforceMeetingAgenda?: boolean;
            /** Format: int32 */
            maximumAdvanceDays?: number;
            /** Format: int32 */
            maximumEventMinutes?: number;
            /** Format: int32 */
            minimumEventMinutes?: number;
            /** Format: int64 */
            version: number;
            /** Format: int32 */
            weekStart?: number;
            /** Format: int32 */
            weeklyFocusTargetMinutes?: number;
            workingDayEnd: string;
            workingDayStart: string;
        };
        platform_PolicyRevision: {
            approval?: components["schemas"]["platform_PolicyApproval"];
            /** Format: uuid */
            baselineRevisionId?: string;
            changeReason?: string;
            contentSha256?: string;
            /** Format: date-time */
            createdAt?: string;
            createdBy?: string;
            diff?: {
                [key: string]: unknown;
            };
            /** Format: int32 */
            exportLimitRows?: number;
            /** Format: int32 */
            extendedRetentionDays?: number;
            /** Format: int32 */
            highRiskThreshold?: number;
            /** Format: uuid */
            incidentCaseId?: string;
            integrityEnabled?: boolean;
            lifecycleState?: string;
            /** Format: date-time */
            publishedAt?: string;
            publishedBy?: string;
            requireExportReason?: boolean;
            /** Format: uuid */
            revisionId?: string;
            /** Format: int64 */
            revisionNumber?: number;
            /** Format: uuid */
            rollbackOfRevisionId?: string;
            /** Format: int32 */
            standardRetentionDays?: number;
            /** Format: date-time */
            submittedAt?: string;
            submittedBy?: string;
            /** Format: int64 */
            version?: number;
        };
        platform_PolicyRevisionCreate: {
            /** Format: int32 */
            exportLimitRows?: number;
            /** Format: int32 */
            extendedRetentionDays?: number;
            /** Format: int32 */
            highRiskThreshold?: number;
            /** Format: uuid */
            incidentCaseId?: string;
            integrityEnabled?: boolean;
            reason?: string;
            requireExportReason?: boolean;
            /** Format: int32 */
            standardRetentionDays?: number;
        };
        platform_PolicyRevisionDecision: {
            decision?: string;
            reason?: string;
            /** Format: int64 */
            version?: number;
        };
        platform_PolicyRevisionTransition: {
            reason?: string;
            /** Format: int64 */
            version?: number;
        };
        platform_PolicyRollbackRequest: {
            /** Format: uuid */
            incidentCaseId?: string;
            reason?: string;
        };
        platform_PreferenceExceptionRequest: {
            assignedOwnerRef?: string;
            businessImpact?: string;
            businessJustification?: string;
            /** Format: date-time */
            createdAt?: string;
            /** Format: date-time */
            decidedAt?: string;
            /** Format: int64 */
            decidedBy?: number;
            decisionEvidenceRef?: string;
            decisionReason?: string;
            preferencePath?: string;
            /** Format: uuid */
            requestId?: string;
            requestState?: string;
            /** Format: date-time */
            requestedUntil?: string;
            requestedValue?: components["schemas"]["platform_JsonNode"];
            /** Format: date-time */
            updatedAt?: string;
            /** Format: int64 */
            userId?: number;
            /** Format: int64 */
            version?: number;
        };
        platform_PreferenceRequest: {
            defaultView?: boolean;
            favorite?: boolean;
        };
        platform_Preview: {
            /** Format: double */
            completeness?: number;
            fallbackKeys?: string[];
            missingKeys?: string[];
            placeholderIssues?: components["schemas"]["platform_PlaceholderIssue"][];
            publishable?: boolean;
            resolvedEntries?: {
                [key: string]: string;
            };
            unknownKeys?: string[];
        };
        platform_ProductivityItem: {
            cancelled?: boolean;
            classification?: string;
            /** Format: date-time */
            endsAt?: string;
            importance?: string;
            /** Format: uuid */
            itemId?: string;
            /** Format: date-time */
            occurredAt?: string;
            read?: boolean;
            /** @enum {string} */
            resourceKind?: "MAIL" | "CALENDAR";
            sourceUrl?: string;
            title?: string;
        };
        platform_ProvisionTenantRequest: {
            dataRegion: string;
            defaultLocale: string;
            displayName: string;
            entitlementKeys: string[];
            isolationModel: string;
            /** Format: uuid */
            providerTenantId: string;
            /** Format: int64 */
            tenantId: number;
            tenantKey: string;
        };
        platform_ProvisionTenantResponse: {
            externalReference?: string;
            lifecycleState?: string;
            /** Format: uuid */
            providerTenantId?: string;
            /** Format: int32 */
            schemaVersion?: number;
            /** Format: int64 */
            tenantId?: number;
        };
        platform_ReactionRequest: {
            /** @enum {string} */
            reaction?: "CELEBRATE" | "INSIGHTFUL" | "SUPPORT";
        };
        platform_ReactionSummary: {
            counts?: {
                [key: string]: number;
            };
            /** Format: int64 */
            total?: number;
            /** @enum {string} */
            viewerReaction?: "CELEBRATE" | "INSIGHTFUL" | "SUPPORT";
        };
        platform_ReaderPreferenceRequest: {
            dismissed?: boolean;
            saved?: boolean;
        };
        platform_ReaderPreferenceResponse: {
            /** Format: int64 */
            communicationId: number;
            readerState: components["schemas"]["platform_ReaderState"];
        };
        platform_ReaderState: {
            acknowledged?: boolean;
            /** Format: date-time */
            acknowledgedAt?: string;
            dismissed?: boolean;
            /** Format: date-time */
            openedAt?: string;
            saved?: boolean;
            /** Format: date-time */
            savedAt?: string;
            unread?: boolean;
        };
        platform_Recommendation: {
            actionPath?: string;
            confidence?: string;
            description?: string;
            /** Format: int32 */
            evidenceCount?: number;
            key?: string;
            kind?: string;
            priority?: string;
            source?: string;
            title?: string;
        };
        platform_RecommendationFeedbackRequest: {
            feedbackType: string;
        };
        platform_RecommendationFeedbackResponse: {
            feedbackType?: string;
            recommendationKey?: string;
            /** Format: date-time */
            recordedAt?: string;
            ruleVersion?: string;
        };
        platform_ReferenceItemResponse: {
            code?: string;
            labels?: components["schemas"]["platform_ReferenceLabelResponse"][];
            /** @enum {string} */
            lifecycleState?: "DRAFT" | "ACTIVE" | "RETIRED";
            parentCode?: string;
            /** Format: int32 */
            sortOrder?: number;
            /** Format: date-time */
            updatedAt?: string;
            /** Format: int64 */
            updatedBy?: number;
            /** Format: date-time */
            validFrom?: string;
            /** Format: date-time */
            validTo?: string;
            /** Format: int64 */
            version?: number;
        };
        platform_ReferenceLabelResponse: {
            description?: string;
            label?: string;
            locale?: string;
        };
        platform_ReferenceSetDetail: {
            description?: string;
            items?: components["schemas"]["platform_ReferenceItemResponse"][];
            /** @enum {string} */
            lifecycleState?: "DRAFT" | "ACTIVE" | "RETIRED";
            name?: string;
            /** Format: int64 */
            revision?: number;
            setKey?: string;
            /** Format: date-time */
            updatedAt?: string;
            /** Format: int64 */
            updatedBy?: number;
            /** Format: int64 */
            version?: number;
        };
        platform_ReferenceSetSummary: {
            description?: string;
            /** Format: int64 */
            itemCount?: number;
            /** @enum {string} */
            lifecycleState?: "DRAFT" | "ACTIVE" | "RETIRED";
            name?: string;
            /** Format: int64 */
            revision?: number;
            setKey?: string;
            /** Format: date-time */
            updatedAt?: string;
            /** Format: int64 */
            updatedBy?: number;
            /** Format: int64 */
            version?: number;
        };
        platform_RegistryEntryDetail: {
            current?: components["schemas"]["platform_RegistryEntryResponse"];
            history?: components["schemas"]["platform_RegistryEntryResponse"][];
        };
        platform_RegistryEntryResponse: {
            artifactVersion?: string;
            description?: string;
            entryKey?: string;
            /** @enum {string} */
            lifecycleState?: "DRAFT" | "ACTIVE" | "RETIRED";
            name?: string;
            ownerRef?: string;
            /** @enum {string} */
            registryType?: "APP" | "CONNECTOR" | "AGENT" | "TOOL" | "POLICY" | "API" | "DATA_PRODUCT";
            /** Format: int32 */
            revision?: number;
            /** @enum {string} */
            riskTier?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
            /** Format: date-time */
            updatedAt?: string;
            /** Format: int64 */
            updatedBy?: number;
            /** Format: int64 */
            version?: number;
        };
        platform_Relation: {
            criticality?: string;
            evidenceRef?: string;
            lifecycleState?: string;
            metadata?: components["schemas"]["platform_JsonNode"];
            /** Format: uuid */
            relationId?: string;
            relationOrigin?: string;
            relationType?: string;
            sourceRef?: string;
            targetRef?: string;
            /** Format: int64 */
            version?: number;
        };
        platform_RelationVersionRequest: {
            /** Format: int64 */
            version: number;
        };
        platform_ReorderItem: {
            /** Format: int64 */
            navigationItemId: number;
            /** Format: int64 */
            parentNavigationItemId?: number;
            /** Format: int32 */
            sortOrder?: number;
            /** Format: int64 */
            version: number;
        };
        platform_ReorderRequest: {
            items: components["schemas"]["platform_ReorderItem"][];
        };
        platform_ReplaceEntitlementsRequest: {
            entitlementKeys: string[];
        };
        platform_RequestDetail: {
            /** @enum {string} */
            dataClassification?: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
            request?: components["schemas"]["platform_RequestSummary"];
            requestSchema?: components["schemas"]["platform_JsonNode"];
            /** Format: int32 */
            schemaVersion?: number;
            timeline?: components["schemas"]["platform_TimelineEvent"][];
            values?: {
                [key: string]: unknown;
            };
        };
        platform_RequestSummary: {
            assignedGroup?: string;
            assignedTo?: string;
            /** @enum {string} */
            priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
            /** Format: uuid */
            requestId?: string;
            requestNumber?: string;
            serviceKey?: string;
            serviceNameEn?: string;
            serviceNameKo?: string;
            /** Format: date-time */
            slaDueAt?: string;
            /** @enum {string} */
            status?: "DRAFT" | "SUBMITTED" | "TRIAGED" | "IN_PROGRESS" | "AWAITING_REQUESTER" | "RESOLVED" | "CLOSED" | "CANCELLED";
            /** Format: date-time */
            submittedAt?: string;
            summary?: string;
            /** Format: date-time */
            updatedAt?: string;
            /** Format: int64 */
            version?: number;
        };
        platform_ResourceRequest: {
            approvalRequired?: boolean;
            /** Format: int32 */
            capacity?: number;
            code: string;
            features: string[];
            floor?: string;
            nameEn: string;
            nameKo: string;
            site: string;
            /** @enum {string} */
            state: "AVAILABLE" | "MAINTENANCE" | "RETIRED";
            timeZone: string;
            /** @enum {string} */
            type: "ROOM" | "DESK" | "EQUIPMENT";
            /** Format: int64 */
            version?: number;
        };
        platform_ResourceSummary: {
            approvalRequired?: boolean;
            available?: boolean;
            /** Format: int32 */
            capacity?: number;
            code?: string;
            features?: string[];
            floor?: string;
            name?: string;
            nameEn?: string;
            nameKo?: string;
            /** Format: uuid */
            resourceId?: string;
            site?: string;
            /** @enum {string} */
            state?: "AVAILABLE" | "MAINTENANCE" | "RETIRED";
            timeZone?: string;
            /** @enum {string} */
            type?: "ROOM" | "DESK" | "EQUIPMENT";
            /** Format: int64 */
            version?: number;
        };
        platform_RespondRequest: {
            /** @enum {string} */
            response: "NEEDS_ACTION" | "ACCEPTED" | "TENTATIVE" | "DECLINED";
        };
        platform_RestoreRequest: {
            changeSummary: string;
        };
        platform_RetentionPolicy: {
            /** Format: uuid */
            activeRevisionId?: string;
            /** Format: int64 */
            activeRevisionNumber?: number;
            /** Format: int32 */
            exportLimitRows?: number;
            /** Format: int32 */
            extendedRetentionDays?: number;
            /** Format: int32 */
            highRiskThreshold?: number;
            integrityEnabled?: boolean;
            requireExportReason?: boolean;
            /** Format: int32 */
            standardRetentionDays?: number;
            /** Format: date-time */
            updatedAt?: string;
            updatedBy?: string;
        };
        platform_RetentionPolicyUpdate: {
            /** Format: int32 */
            exportLimitRows?: number;
            /** Format: int32 */
            extendedRetentionDays?: number;
            /** Format: int32 */
            highRiskThreshold?: number;
            integrityEnabled?: boolean;
            requireExportReason?: boolean;
            /** Format: int32 */
            standardRetentionDays?: number;
        };
        platform_Revision: {
            /** Format: uuid */
            baselineRevisionId?: string;
            baselineTreeHash?: string;
            changeSummary?: string;
            /** Format: date-time */
            createdAt?: string;
            /** Format: int64 */
            createdBy?: number;
            diff?: components["schemas"]["platform_DiffSummary"];
            lifecycleState?: string;
            /** Format: uuid */
            navigationRevisionId?: string;
            /** Format: date-time */
            publishedAt?: string;
            /** Format: int64 */
            publishedBy?: number;
            /** Format: int64 */
            revisionNumber?: number;
            tree?: components["schemas"]["platform_AdminNode"][];
            /** Format: date-time */
            updatedAt?: string;
            validation?: components["schemas"]["platform_ValidationReport"];
            /** Format: int64 */
            version?: number;
        };
        platform_RuntimeCodeSet: {
            codeSetKey?: string;
            /** Format: int32 */
            schemaVersion?: number;
            values?: components["schemas"]["platform_RuntimeCodeValue"][];
        };
        platform_RuntimeCodeValue: {
            code?: string;
            label?: string;
        };
        platform_RuntimeNode: {
            children?: components["schemas"]["platform_RuntimeNode"][];
            description?: string;
            iconKey?: string;
            itemType?: string;
            label?: string;
            navigationKey?: string;
            registryEntryKey?: string;
            requiredPermissionCode?: string;
            requiredResourceKey?: string;
            route?: string;
        };
        platform_RuntimeReferenceItem: {
            code?: string;
            description?: string;
            label?: string;
            parentCode?: string;
            /** Format: int32 */
            sortOrder?: number;
        };
        platform_RuntimeReferenceSet: {
            items?: components["schemas"]["platform_RuntimeReferenceItem"][];
            locale?: string;
            /** Format: int64 */
            revision?: number;
            setKey?: string;
        };
        platform_RuntimeRegistryEntry: {
            artifactVersion?: string;
            description?: string;
            entryKey?: string;
            name?: string;
            ownerRef?: string;
            /** @enum {string} */
            registryType?: "APP" | "CONNECTOR" | "AGENT" | "TOOL" | "POLICY" | "API" | "DATA_PRODUCT";
            /** Format: int32 */
            revision?: number;
            /** @enum {string} */
            riskTier?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
        };
        platform_SaveConnectorRequest: {
            /** @enum {string} */
            authMode: "DELEGATED";
            clientId: string;
            connectorKey: string;
            credentialReference: string;
            displayName: string;
            /** @enum {string} */
            policyState: "REVIEW_REQUIRED" | "APPROVED" | "BLOCKED";
            providerTenantId: string;
            /** @enum {string} */
            providerType: "MICROSOFT_GRAPH";
            redirectUri: string;
            requestedScopes: string[];
            /** Format: int64 */
            version?: number;
        };
        platform_SaveDraftRequest: {
            changeSummary?: string;
            tree: components["schemas"]["platform_AdminNode"][];
            /** Format: int64 */
            version: number;
        };
        platform_SavedSearch: {
            /** Format: date-time */
            createdAt?: string;
            criteria?: {
                [key: string]: unknown;
            };
            editable?: boolean;
            name?: string;
            ownerActorId?: string;
            /** Format: uuid */
            savedSearchId?: string;
            shared?: boolean;
            /** Format: date-time */
            updatedAt?: string;
        };
        platform_SavedSearchRequest: {
            actor?: string;
            category?: string;
            name?: string;
            outcome?: string;
            query?: string;
            severity?: string;
            shared?: boolean;
            sourceService?: string;
            /** @enum {string} */
            window?: "H24" | "D7" | "D30" | "D90";
        };
        platform_SavedView: {
            configuration?: {
                [key: string]: unknown;
            };
            /** Format: date-time */
            createdAt?: string;
            defaultView?: boolean;
            editable?: boolean;
            favorite?: boolean;
            /** Format: date-time */
            lastUsedAt?: string;
            lifecycleState?: string;
            name?: string;
            /** Format: uuid */
            ownerGroupRef?: string;
            /** Format: int64 */
            ownerUserId?: number;
            /** Format: date-time */
            retentionUntil?: string;
            /** Format: uuid */
            savedViewId?: string;
            scope?: string;
            surfaceKey?: string;
            /** Format: date-time */
            updatedAt?: string;
            /** Format: int64 */
            version?: number;
        };
        platform_SectionActivityFeed: {
            data?: components["schemas"]["platform_ActivityFeed"];
            /** Format: date-time */
            generatedAt?: string;
            reason?: string;
            source?: string;
            /** @enum {string} */
            status?: "AVAILABLE" | "FORBIDDEN" | "UNAVAILABLE";
        };
        platform_SectionFeedResponse: {
            data?: components["schemas"]["platform_FeedResponse"];
            /** Format: date-time */
            generatedAt?: string;
            reason?: string;
            source?: string;
            /** @enum {string} */
            status?: "AVAILABLE" | "FORBIDDEN" | "UNAVAILABLE";
        };
        platform_SectionHomeResponse: {
            data?: components["schemas"]["platform_HomeResponse"];
            /** Format: date-time */
            generatedAt?: string;
            reason?: string;
            source?: string;
            /** @enum {string} */
            status?: "AVAILABLE" | "FORBIDDEN" | "UNAVAILABLE";
        };
        platform_SectionWorkQueue: {
            data?: components["schemas"]["platform_WorkQueue"];
            /** Format: date-time */
            generatedAt?: string;
            reason?: string;
            source?: string;
            /** @enum {string} */
            status?: "AVAILABLE" | "FORBIDDEN" | "UNAVAILABLE";
        };
        platform_Subject: {
            /** Format: uuid */
            connectorId?: string;
            /** @enum {string} */
            consentState?: "NOT_CONNECTED" | "CONNECTED" | "REAUTHORIZATION_REQUIRED" | "REVOKED";
            grantedScopes?: string[];
            lastErrorCode?: string;
            /** Format: date-time */
            lastSuccessfulSyncAt?: string;
            /** Format: uuid */
            subjectId?: string;
            /** Format: date-time */
            tokenExpiresAt?: string;
            /** Format: int64 */
            userId?: number;
        };
        platform_SyncRequest: {
            reset?: boolean;
            /** @enum {string} */
            resourceKind: "MAIL" | "CALENDAR";
        };
        platform_SyncRun: {
            /** Format: date-time */
            completedAt?: string;
            /** Format: uuid */
            connectorId?: string;
            correlationId?: string;
            /** Format: int32 */
            deleteCount?: number;
            /** Format: int32 */
            errorCount?: number;
            partialResult?: boolean;
            /** @enum {string} */
            resourceKind?: "MAIL" | "CALENDAR";
            /** Format: date-time */
            retryAfterAt?: string;
            /** Format: uuid */
            runId?: string;
            /** @enum {string} */
            runState?: "RUNNING" | "SUCCEEDED" | "PARTIAL" | "FAILED" | "BLOCKED";
            safeErrorCode?: string;
            /** Format: int32 */
            skipCount?: number;
            /** Format: date-time */
            startedAt?: string;
            /** @enum {string} */
            syncMode?: "INITIAL" | "DELTA" | "RESET";
            /** Format: int32 */
            upsertCount?: number;
            /** Format: int64 */
            userId?: number;
        };
        platform_TenantBrandingResponse: {
            accentColor?: string;
            logoContentType?: string;
            /** Format: int32 */
            logoHeight?: number;
            logoOriginalName?: string;
            /** Format: int64 */
            logoSizeBytes?: number;
            logoUrl?: string;
            /** Format: int32 */
            logoWidth?: number;
            organizationName?: string;
            /** Format: date-time */
            updatedAt?: string;
            /** Format: int64 */
            updatedBy?: number;
            /** Format: int64 */
            version?: number;
        };
        platform_TimelineEvent: {
            /** Format: int64 */
            actorId?: number;
            actorType?: string;
            /** Format: uuid */
            eventId?: string;
            eventType?: string;
            note?: string;
            /** Format: date-time */
            occurredAt?: string;
            /** @enum {string} */
            status?: "DRAFT" | "SUBMITTED" | "TRIAGED" | "IN_PROGRESS" | "AWAITING_REQUESTER" | "RESOLVED" | "CLOSED" | "CANCELLED";
        };
        platform_TraceDetail: {
            selected?: components["schemas"]["platform_EventResponse"];
            trace?: components["schemas"]["platform_EventResponse"][];
        };
        platform_TransitionRequest: {
            assignedTo?: string;
            note?: string;
            /** @enum {string} */
            targetStatus: "DRAFT" | "SUBMITTED" | "TRIAGED" | "IN_PROGRESS" | "AWAITING_REQUESTER" | "RESOLVED" | "CLOSED" | "CANCELLED";
            /** Format: int64 */
            version: number;
        };
        platform_UpdateAnnouncementRequest: {
            definition: components["schemas"]["platform_AnnouncementDefinition"];
            /** Format: int64 */
            version: number;
        };
        platform_UpdateDraftRequest: {
            submit?: boolean;
            summary: string;
            values: {
                [key: string]: unknown;
            };
            /** Format: int64 */
            version: number;
        };
        platform_UpdateEventRequest: {
            allDay?: boolean;
            attendees: components["schemas"]["platform_AttendeeInput"][];
            conferenceUrl?: string;
            description?: string;
            /** Format: date-time */
            endsAt: string;
            location?: string;
            /** @enum {string} */
            recurrence: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
            /** Format: int32 */
            recurrenceInterval?: number;
            /** Format: date */
            recurrenceUntil?: string;
            /** Format: uuid */
            resourceId?: string;
            responseRequired?: boolean;
            /** Format: date-time */
            startsAt: string;
            timeZone: string;
            title: string;
            /** @enum {string} */
            type: "MEETING" | "FOCUS" | "TASK" | "OUT_OF_OFFICE" | "REMINDER";
            /** Format: int64 */
            version: number;
            /** @enum {string} */
            visibility: "DEFAULT" | "PUBLIC" | "PRIVATE" | "CONFIDENTIAL";
        };
        platform_UpdateHomeExperienceRequest: {
            backgroundPosition: string;
            defaultLocale?: string;
            headline?: string;
            localizedContent?: {
                [key: string]: components["schemas"]["platform_LocalizedCopy"];
            };
            /** Format: int32 */
            overlayOpacity: number;
            subheadline?: string;
            /** Format: int64 */
            version: number;
        };
        platform_UpdateHomePreferenceRequest: {
            layout: components["schemas"]["platform_HomeLayoutPayload"];
            /** Format: int64 */
            version: number;
        };
        platform_UpdateItemRequest: {
            labels: components["schemas"]["platform_LocalizedLabelRequest"][];
            parentCode?: string;
            /** Format: int32 */
            sortOrder: number;
            /** Format: date-time */
            validFrom?: string;
            /** Format: date-time */
            validTo?: string;
            /** Format: int64 */
            version: number;
        };
        platform_UpdateLaunchpadConfigurationRequest: {
            configuration: components["schemas"]["platform_HomeLaunchpadConfiguration"];
            /** Format: int64 */
            version: number;
        };
        platform_UpdateLifecycleRequest: {
            lifecycleState: string;
        };
        platform_UpdateRegistryRevisionRequest: {
            artifactVersion: string;
            description?: string;
            name: string;
            ownerRef: string;
            /** @enum {string} */
            riskTier: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
            /** Format: int64 */
            version: number;
        };
        platform_UpdateRequest: {
            configuration: {
                [key: string]: unknown;
            };
            name: string;
            /** Format: uuid */
            ownerGroupRef?: string;
            scope: string;
            /** Format: int64 */
            version?: number;
        };
        platform_UpdateSetRequest: {
            description?: string;
            name: string;
            /** Format: int64 */
            version: number;
        };
        platform_UpdateTenantBrandingRequest: {
            accentColor?: string;
            organizationName?: string;
            /** Format: int64 */
            version: number;
        };
        platform_UpdateWorkStatusRequest: {
            status: string;
            /** Format: int64 */
            version: number;
        };
        platform_ValidationIssue: {
            code?: string;
            message?: string;
            /** Format: int64 */
            navigationItemId?: number;
            navigationKey?: string;
            severity?: string;
        };
        platform_ValidationReport: {
            /** Format: date-time */
            checkedAt?: string;
            /** Format: int64 */
            errorCount?: number;
            issues?: components["schemas"]["platform_ValidationIssue"][];
            valid?: boolean;
            /** Format: int64 */
            warningCount?: number;
        };
        platform_VersionRequest: {
            /** Format: int64 */
            version: number;
        };
        platform_WebVitalRequest: {
            /** Format: double */
            delta: number;
            id: string;
            /** @enum {string} */
            name: "CLS" | "INP" | "LCP";
            navigationType: string;
            /** @enum {string} */
            rating: "good" | "needs-improvement" | "poor";
            routeGroup: string;
            /** Format: double */
            value: number;
        };
        platform_WidgetPreference: {
            size?: string;
            visible: boolean;
            widgetKey: string;
        };
        platform_WorkItem: {
            /** Format: date-time */
            dueAt?: string;
            id?: string;
            latestActivity?: string;
            owner?: string;
            priority?: string;
            reason?: string;
            recommendedNext?: string;
            sourceReference?: string;
            sourceRoute?: string;
            sourceSystem?: string;
            status?: string;
            summary?: string;
            title?: string;
            type?: string;
            /** Format: date-time */
            updatedAt?: string;
            /** Format: int64 */
            version?: number;
            /** Format: uuid */
            workItemId?: string;
        };
        platform_WorkQueue: {
            /** Format: date-time */
            generatedAt?: string;
            items?: components["schemas"]["platform_WorkItem"][];
            summary?: components["schemas"]["platform_WorkSummary"];
        };
        platform_WorkStatusChange: {
            /** Format: int64 */
            version: number;
            /** Format: uuid */
            workItemId: string;
        };
        platform_WorkSummary: {
            /** Format: int64 */
            completed?: number;
            /** Format: int64 */
            dueSoon?: number;
            /** Format: int64 */
            inProgress?: number;
            /** Format: int64 */
            total?: number;
            /** Format: int64 */
            waiting?: number;
        };
        platform_Workspace: {
            currentTree?: components["schemas"]["platform_AdminNode"][];
            currentValidation?: components["schemas"]["platform_ValidationReport"];
            draft?: components["schemas"]["platform_Revision"];
            history?: components["schemas"]["platform_Revision"][];
            published?: components["schemas"]["platform_Revision"];
        };
        platform_WorkspaceApp: {
            /** Format: uuid */
            accessRequestId?: string;
            accessRequestState?: string;
            /** Format: date-time */
            accessRequestUpdatedAt?: string;
            /** Format: int64 */
            accessRequestVersion?: number;
            accessState?: string;
            category?: string;
            description?: string;
            health?: string;
            iconKey?: string;
            id?: string;
            /** Format: date-time */
            lastUsedAt?: string;
            /** Format: int64 */
            launchCount?: number;
            launchMode?: string;
            launchTarget?: string;
            name?: string;
            owner?: string;
            pinned?: boolean;
            resourceKey?: string;
            /** Format: int64 */
            version?: number;
        };
        provider_ActionItem: {
            category?: string;
            /** Format: date-time */
            createdAt?: string;
            detail?: string;
            itemId?: string;
            route?: string;
            severity?: string;
            targetId?: string;
            /** Format: uuid */
            tenantId?: string;
            title?: string;
        };
        provider_ActivateSupportAccessRequest: {
            /** Format: int64 */
            version: number;
        };
        provider_AdministratorInvitation: {
            activationPath?: string;
            activationToken?: string;
            /** Format: int64 */
            authTenantId?: number;
            /** Format: int64 */
            authUserId?: number;
            email?: string;
            /** Format: date-time */
            expiresAt?: string;
            /** Format: uuid */
            tenantAdministratorId?: string;
        };
        provider_AdvanceRequest: {
            observedHealth: components["schemas"]["provider_JsonNode"];
            reason: string;
            /** Format: int64 */
            version?: number;
        };
        provider_ApiResponseAdministratorInvitation: {
            correlationId?: string;
            data?: components["schemas"]["provider_AdministratorInvitation"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseAuditInsights: {
            correlationId?: string;
            data?: components["schemas"]["provider_AuditInsights"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseCommandCenter: {
            correlationId?: string;
            data?: components["schemas"]["provider_CommandCenter"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseCommercialOverview: {
            correlationId?: string;
            data?: components["schemas"]["provider_CommercialOverview"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseDomainChallenge: {
            correlationId?: string;
            data?: components["schemas"]["provider_DomainChallenge"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseEstateOverview: {
            correlationId?: string;
            data?: components["schemas"]["provider_EstateOverview"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseEvaluation: {
            correlationId?: string;
            data?: components["schemas"]["provider_Evaluation"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseFeatureFlag: {
            correlationId?: string;
            data?: components["schemas"]["provider_FeatureFlag"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseJsonNode: {
            correlationId?: string;
            data?: components["schemas"]["provider_JsonNode"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseListAuditEventSummary: {
            correlationId?: string;
            data?: components["schemas"]["provider_AuditEventSummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseListEntitlementSummary: {
            correlationId?: string;
            data?: components["schemas"]["provider_EntitlementSummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseListFeatureFlag: {
            correlationId?: string;
            data?: components["schemas"]["provider_FeatureFlag"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseListOperationApprovalSummary: {
            correlationId?: string;
            data?: components["schemas"]["provider_OperationApprovalSummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseListPolicy: {
            correlationId?: string;
            data?: components["schemas"]["provider_Policy"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseListRegionSummary: {
            correlationId?: string;
            data?: components["schemas"]["provider_RegionSummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseListRollout: {
            correlationId?: string;
            data?: components["schemas"]["provider_Rollout"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseListSubscriptionRenewalRevision: {
            correlationId?: string;
            data?: components["schemas"]["provider_SubscriptionRenewalRevision"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseListSupportAccessRequestSummary: {
            correlationId?: string;
            data?: components["schemas"]["provider_SupportAccessRequestSummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseListSupportScopeSummary: {
            correlationId?: string;
            data?: components["schemas"]["provider_SupportScopeSummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseListSupportSessionSummary: {
            correlationId?: string;
            data?: components["schemas"]["provider_SupportSessionSummary"][];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseMaintenanceWindowSummary: {
            correlationId?: string;
            data?: components["schemas"]["provider_MaintenanceWindowSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseOperationApprovalSummary: {
            correlationId?: string;
            data?: components["schemas"]["provider_OperationApprovalSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseOperationSummary: {
            correlationId?: string;
            data?: components["schemas"]["provider_OperationSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseOperatorProfile: {
            correlationId?: string;
            data?: components["schemas"]["provider_OperatorProfile"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponsePageResultOperationSummary: {
            correlationId?: string;
            data?: components["schemas"]["provider_PageResultOperationSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponsePageResultTenantSummary: {
            correlationId?: string;
            data?: components["schemas"]["provider_PageResultTenantSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponsePolicy: {
            correlationId?: string;
            data?: components["schemas"]["provider_Policy"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseReliabilityControlOverview: {
            correlationId?: string;
            data?: components["schemas"]["provider_ReliabilityControlOverview"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseRevision: {
            correlationId?: string;
            data?: components["schemas"]["provider_Revision"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseRollout: {
            correlationId?: string;
            data?: components["schemas"]["provider_Rollout"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseServiceHealthOverview: {
            correlationId?: string;
            data?: components["schemas"]["provider_ServiceHealthOverview"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseServiceIncidentSummary: {
            correlationId?: string;
            data?: components["schemas"]["provider_ServiceIncidentSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseSnapshot: {
            correlationId?: string;
            data?: components["schemas"]["provider_Snapshot"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseSubscriptionRenewalRevision: {
            correlationId?: string;
            data?: components["schemas"]["provider_SubscriptionRenewalRevision"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseSupportAccessRequestSummary: {
            correlationId?: string;
            data?: components["schemas"]["provider_SupportAccessRequestSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseSupportSessionContext: {
            correlationId?: string;
            data?: components["schemas"]["provider_SupportSessionContext"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseSupportSessionSummary: {
            correlationId?: string;
            data?: components["schemas"]["provider_SupportSessionSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseTenantDomainSummary: {
            correlationId?: string;
            data?: components["schemas"]["provider_TenantDomainSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_ApiResponseTenantSummary: {
            correlationId?: string;
            data?: components["schemas"]["provider_TenantSummary"];
            errorCode?: string;
            message?: string;
            status?: string;
            success?: boolean;
            /** Format: date-time */
            timestamp?: string;
        };
        provider_Approval: {
            /** Format: uuid */
            approvalId?: string;
            /** Format: date-time */
            decidedAt?: string;
            /** Format: int64 */
            decidedBy?: number;
            decisionReason?: string;
            lifecycleState?: string;
            /** Format: date-time */
            requestedAt?: string;
            /** Format: int64 */
            requestedBy?: number;
        };
        provider_ApprovalDecisionRequest: {
            decision: string;
            reason: string;
            /** Format: int64 */
            version?: number;
        };
        provider_AuditEventSummary: {
            action?: string;
            /** Format: uuid */
            auditEventId?: string;
            correlationId?: string;
            eventCategory?: string;
            /** Format: date-time */
            occurredAt?: string;
            /** Format: int64 */
            operatorId?: number;
            operatorName?: string;
            outcome?: string;
            redactedSnapshot?: string;
            targetId?: string;
            targetType?: string;
            /** Format: uuid */
            tenantId?: string;
            tenantKey?: string;
        };
        provider_AuditInsights: {
            categories?: components["schemas"]["provider_Metric"][];
            /** Format: int64 */
            denied24Hours?: number;
            /** Format: int64 */
            events24Hours?: number;
            /** Format: int64 */
            failed24Hours?: number;
            /** Format: date-time */
            generatedAt?: string;
            outcomes?: components["schemas"]["provider_Metric"][];
            /** Format: int64 */
            privilegedAccess24Hours?: number;
        };
        provider_CancelSupportAccessRequest: {
            reason: string;
            /** Format: int64 */
            version: number;
        };
        provider_CellPosture: {
            cellKey?: string;
            /** Format: uuid */
            deploymentCellId?: string;
            displayName?: string;
            healthState?: string;
            /** Format: int64 */
            healthyInstances?: number;
            lifecycleState?: string;
            /** Format: int32 */
            placementCapacity?: number;
            regionKey?: string;
            /** Format: double */
            saturationPct?: number;
            /** Format: int64 */
            serviceInstances?: number;
            /** Format: int64 */
            tenantCount?: number;
        };
        provider_Column: {
            classification?: string;
            dataType?: string;
            defaultValue?: string;
            description?: string;
            foreignKey?: boolean;
            indexed?: boolean;
            name?: string;
            nullable?: boolean;
            primaryKey?: boolean;
        };
        provider_CommandCenter: {
            actionQueue?: components["schemas"]["provider_ActionItem"][];
            /** Format: int64 */
            activeIncidents?: number;
            cells?: components["schemas"]["provider_CellPosture"][];
            estate?: components["schemas"]["provider_EstateOverview"];
            /** Format: int64 */
            expiringSubscriptions?: number;
            /** Format: date-time */
            generatedAt?: string;
            operatingState?: string;
            recentActivity?: components["schemas"]["provider_RecentActivity"][];
            services?: components["schemas"]["provider_ServicePosture"][];
        };
        provider_CommercialOverview: {
            /** Format: int64 */
            activeSubscriptions?: number;
            entitlements?: components["schemas"]["provider_EntitlementAdoption"][];
            /** Format: int64 */
            expiringSubscriptions?: number;
            /** Format: date-time */
            generatedAt?: string;
            plans?: components["schemas"]["provider_ServicePlanPortfolio"][];
            subscriptions?: components["schemas"]["provider_SubscriptionPortfolio"][];
            /** Format: int64 */
            trialSubscriptions?: number;
            /** Format: int64 */
            uncontractedOrganizations?: number;
        };
        provider_CreateDomainRequest: {
            domainName: string;
            domainType: string;
            primaryDomain?: boolean;
        };
        provider_CreateFeatureFlagRequest: {
            configurationSchema: components["schemas"]["provider_JsonNode"];
            defaultValue: components["schemas"]["provider_JsonNode"];
            description: string;
            displayName: string;
            featureKey: string;
            ownerService: string;
            riskTier: string;
            valueType: string;
        };
        provider_CreateIncidentRequest: {
            customerImpact: string;
            /** Format: uuid */
            deploymentCellId?: string;
            impactScope: string;
            initialUpdate: string;
            publicSummary?: string;
            regionKey?: string;
            serviceKey?: string;
            severity: string;
            /** Format: uuid */
            tenantId?: string;
            title: string;
        };
        provider_CreateMaintenanceWindowRequest: {
            /** Format: date-time */
            customerNoticeAt: string;
            /** Format: uuid */
            deploymentCellId?: string;
            /** Format: date-time */
            endsAt: string;
            /** Format: int32 */
            expectedImpactSeconds: number;
            impactType: string;
            /** Format: int32 */
            minimumNoticeHours: number;
            regionKey?: string;
            scopeType: string;
            serviceKey?: string;
            /** Format: date-time */
            startsAt: string;
            summary: string;
            /** Format: uuid */
            tenantId?: string;
            title: string;
            trackingKey: string;
        };
        provider_CreatePolicyRequest: {
            description: string;
            displayName: string;
            /** Format: date-time */
            effectiveFrom?: string;
            /** Format: date-time */
            effectiveTo?: string;
            justification: string;
            ownerService: string;
            policyKey: string;
            policyRule: components["schemas"]["provider_JsonNode"];
            policyType: string;
            scopeRef?: string;
            scopeType: string;
        };
        provider_CreateRevisionRequest: {
            /** Format: date-time */
            effectiveFrom?: string;
            /** Format: date-time */
            effectiveTo?: string;
            justification: string;
            policyRule: components["schemas"]["provider_JsonNode"];
        };
        provider_CreateRolloutRequest: {
            justification: string;
            name: string;
            rolloutValue: components["schemas"]["provider_JsonNode"];
            stages: components["schemas"]["provider_StageRequest"][];
            strategy: string;
            targeting: components["schemas"]["provider_JsonNode"];
        };
        provider_CreateSubscriptionRenewalRequest: {
            proposedContractReference: string;
            /** Format: date-time */
            proposedEndsAt: string;
            reason: string;
            requestKey: string;
            /** Format: uuid */
            subscriptionId: string;
            /** Format: int64 */
            subscriptionVersion: number;
            targetPlanKey: string;
        };
        provider_CreateSupportAccessRequest: {
            approvalReference?: string;
            /** Format: int32 */
            durationMinutes: number;
            justification: string;
            requestKey: string;
            scopes: string[];
            /** Format: uuid */
            tenantId: string;
        };
        provider_CreateSupportSessionRequest: {
            approvalReference?: string;
            /** Format: int32 */
            durationMinutes: number;
            emergencyAccess?: boolean;
            justification: string;
            requestKey?: string;
            scopes: string[];
            /** Format: uuid */
            tenantId: string;
        };
        provider_DataAsset: {
            assetKey?: string;
            businessDomain?: string;
            columns?: components["schemas"]["provider_Column"][];
            /** Format: int32 */
            constraintCount?: number;
            criticality?: string;
            dataClassification?: string;
            databaseKey?: string;
            databaseName?: string;
            description?: string;
            /** Format: int64 */
            estimatedRows?: number;
            /** Format: int32 */
            inboundRelationships?: number;
            /** Format: int32 */
            indexCount?: number;
            lifecycleState?: string;
            objectName?: string;
            objectType?: string;
            /** Format: int32 */
            outboundRelationships?: number;
            ownerService?: string;
            parentObjectName?: string;
            primaryKey?: string[];
            reviewNote?: string;
            reviewState?: string;
            schemaName?: string;
            tenantScoped?: boolean;
            /** Format: int64 */
            totalBytes?: number;
        };
        provider_DatabaseSummary: {
            businessDomains?: string[];
            /** Format: int32 */
            columns?: number;
            databaseKey?: string;
            databaseName?: string;
            displayName?: string;
            /** Format: int32 */
            documentedAssets?: number;
            error?: string;
            /** Format: int32 */
            foreignKeys?: number;
            /** Format: int32 */
            logicalTables?: number;
            ownerService?: string;
            /** Format: int32 */
            partitions?: number;
            status?: string;
            /** Format: int32 */
            totalAssets?: number;
            /** Format: int64 */
            totalBytes?: number;
            /** Format: int32 */
            views?: number;
        };
        provider_DecideOperationApprovalRequest: {
            decision: string;
            reason: string;
            /** Format: int64 */
            version: number;
        };
        provider_DecideSubscriptionRenewalRequest: {
            decision: string;
            reason: string;
            /** Format: int64 */
            version: number;
        };
        provider_DecideSupportAccessRequest: {
            decision: string;
            reason: string;
            /** Format: int64 */
            version: number;
        };
        provider_DomainChallenge: {
            domain?: components["schemas"]["provider_TenantDomainSummary"];
            recordName?: string;
            recordType?: string;
            recordValue?: string;
        };
        provider_EntitlementAdoption: {
            /** Format: int64 */
            assignedTenants?: number;
            /** Format: int64 */
            eligibleTenants?: number;
            /** Format: int64 */
            entitlementId?: number;
            entitlementKey?: string;
            entitlementType?: string;
            name?: string;
        };
        provider_EntitlementSummary: {
            configuration?: string;
            /** Format: int64 */
            entitlementId?: number;
            entitlementKey?: string;
            entitlementType?: string;
            lifecycleState?: string;
            name?: string;
            /** Format: int64 */
            version?: number;
        };
        provider_EstateOverview: {
            /** Format: int64 */
            activeSupportSessions?: number;
            /** Format: int64 */
            activeTenants?: number;
            /** Format: int64 */
            failedTenants?: number;
            /** Format: int64 */
            openOperations?: number;
            /** Format: int64 */
            organizations?: number;
            /** Format: int64 */
            provisioningTenants?: number;
            regions?: components["schemas"]["provider_Metric"][];
            serviceTiers?: components["schemas"]["provider_Metric"][];
            /** Format: int64 */
            suspendedTenants?: number;
            /** Format: int64 */
            tenants?: number;
        };
        provider_Evaluation: {
            /** Format: int32 */
            deterministicBucket?: number;
            /** Format: date-time */
            evaluatedAt?: string;
            exposurePercentage?: number;
            externalExecutionEnabled?: boolean;
            featureKey?: string;
            /** Format: uuid */
            providerTenantId?: string;
            reasonCode?: string;
            /** Format: int32 */
            revisionNumber?: number;
            /** Format: uuid */
            rolloutRevisionId?: string;
            tenantKey?: string;
            value?: components["schemas"]["provider_JsonNode"];
        };
        provider_ExecuteOperationRequest: {
            planHash: string;
            /** Format: int64 */
            version: number;
        };
        provider_FeatureFlag: {
            configurationSchema?: components["schemas"]["provider_JsonNode"];
            defaultValue?: components["schemas"]["provider_JsonNode"];
            description?: string;
            displayName?: string;
            /** Format: uuid */
            featureFlagId?: string;
            featureKey?: string;
            lifecycleState?: string;
            ownerService?: string;
            riskTier?: string;
            valueType?: string;
            /** Format: int64 */
            version?: number;
        };
        provider_Finding: {
            assetKey?: string;
            category?: string;
            databaseKey?: string;
            detail?: string;
            evidence?: string;
            findingId?: string;
            recommendation?: string;
            severity?: string;
            title?: string;
        };
        provider_GovernanceDriftSummary: {
            controlBehavior?: string;
            controlCategory?: string;
            controlKey?: string;
            controlName?: string;
            /** Format: date-time */
            evaluatedAt?: string;
            /** Format: uuid */
            evaluationId?: string;
            evaluationResult?: string;
            expectedSnapshot?: string;
            guidanceLevel?: string;
            observedSnapshot?: string;
            remediationOperationType?: string;
            riskTier?: string;
            targetId?: string;
            targetType?: string;
            /** Format: uuid */
            tenantId?: string;
            tenantName?: string;
        };
        provider_ImpactPreview: {
            /** Format: int32 */
            affectedAssetCount?: number;
            affectedAssetKeys?: string[];
            blockers?: string[];
            /** Format: date-time */
            catalogGeneratedAt?: string;
            controls?: string[];
            impactHash?: string;
            /** Format: date-time */
            previewedAt?: string;
            publishable?: boolean;
            warnings?: string[];
        };
        provider_IncidentUpdateSummary: {
            /** Format: date-time */
            createdAt?: string;
            /** Format: uuid */
            incidentUpdateId?: string;
            lifecycleState?: string;
            message?: string;
            operatorName?: string;
            visibility?: string;
        };
        provider_IssueAdministratorInvitationRequest: {
            /** Format: int32 */
            expiresInMinutes: number;
            justification: string;
        };
        provider_JsonNode: unknown;
        provider_LifecycleRequest: {
            justification: string;
            state: string;
            /** Format: int64 */
            version: number;
        };
        provider_LineageEdge: {
            description?: string;
            edgeId?: string;
            edgeKey?: string;
            edgeType?: string;
            evidence?: string;
            metadata?: string;
            ownerService?: string;
            processKey?: string;
            sourceAssetKey?: string;
            targetAssetKey?: string;
        };
        provider_MaintenanceWindowSummary: {
            /** Format: date-time */
            customerNoticeAt?: string;
            /** Format: date-time */
            endsAt?: string;
            /** Format: int32 */
            expectedImpactSeconds?: number;
            impactType?: string;
            lifecycleState?: string;
            /** Format: uuid */
            maintenanceWindowId?: string;
            /** Format: int32 */
            minimumNoticeHours?: number;
            noticeCompliant?: boolean;
            /** Format: uuid */
            operationId?: string;
            scopeLabel?: string;
            scopeType?: string;
            /** Format: date-time */
            startsAt?: string;
            summary?: string;
            title?: string;
            trackingKey?: string;
            /** Format: int64 */
            version?: number;
        };
        provider_Metric: {
            /** Format: int64 */
            count?: number;
            key?: string;
        };
        provider_OnboardingPlanRequest: {
            customerReference?: string;
            dataRegion: string;
            defaultLocale: string;
            displayName: string;
            entitlementKeys: string[];
            environmentKey: string;
            initialAdminDisplayName: string;
            /** Format: email */
            initialAdminEmail: string;
            isolationModel: string;
            justification: string;
            legalName?: string;
            organizationKey: string;
            organizationName: string;
            primaryDomain?: string;
            serviceTier: string;
            tenantKey: string;
            timeZone: string;
        };
        provider_OperationApprovalSummary: {
            /** Format: date-time */
            decidedAt?: string;
            /** Format: int64 */
            decidedBy?: number;
            decidedByName?: string;
            decisionReason?: string;
            /** Format: date-time */
            expiresAt?: string;
            gateKey?: string;
            /** Format: int32 */
            gateOrder?: number;
            lifecycleState?: string;
            /** Format: uuid */
            operationApprovalId?: string;
            /** Format: uuid */
            operationId?: string;
            operationType?: string;
            requestReason?: string;
            /** Format: date-time */
            requestedAt?: string;
            /** Format: int64 */
            requestedBy?: number;
            requestedByName?: string;
            requiredRoleCode?: string;
            riskTier?: string;
            separationOfDuties?: boolean;
            /** Format: uuid */
            tenantId?: string;
            tenantName?: string;
            /** Format: int64 */
            version?: number;
        };
        provider_OperationStep: {
            /** Format: int32 */
            attemptCount?: number;
            attempts?: components["schemas"]["provider_OperationStepAttempt"][];
            /** Format: date-time */
            completedAt?: string;
            externalReference?: string;
            lastErrorCode?: string;
            lastErrorMessage?: string;
            lifecycleState?: string;
            /** Format: date-time */
            nextRetryAt?: string;
            /** Format: int32 */
            order?: number;
            redactedResult?: string;
            /** Format: date-time */
            startedAt?: string;
            /** Format: int64 */
            stepId?: number;
            stepKey?: string;
            targetService?: string;
        };
        provider_OperationStepAttempt: {
            /** Format: uuid */
            attemptId?: string;
            /** Format: int32 */
            attemptNumber?: number;
            /** Format: date-time */
            completedAt?: string;
            errorCode?: string;
            errorMessage?: string;
            lifecycleState?: string;
            redactedResult?: string;
            requestFingerprint?: string;
            /** Format: date-time */
            startedAt?: string;
        };
        provider_OperationSummary: {
            /** Format: date-time */
            completedAt?: string;
            /** Format: date-time */
            createdAt?: string;
            failureCode?: string;
            failureMessage?: string;
            lifecycleState?: string;
            /** Format: uuid */
            operationId?: string;
            operationType?: string;
            plan?: string;
            planHash?: string;
            riskTier?: string;
            /** Format: date-time */
            startedAt?: string;
            steps?: components["schemas"]["provider_OperationStep"][];
            /** Format: uuid */
            tenantId?: string;
            /** Format: int64 */
            version?: number;
        };
        provider_OperatorProfile: {
            /** Format: int64 */
            authUserId?: number;
            displayName?: string;
            /** Format: int64 */
            operatorId?: number;
            permissions?: string[];
            roles?: string[];
        };
        provider_PageResultOperationSummary: {
            content?: components["schemas"]["provider_OperationSummary"][];
            /** Format: int32 */
            page?: number;
            /** Format: int32 */
            size?: number;
            /** Format: int64 */
            totalElements?: number;
            /** Format: int32 */
            totalPages?: number;
        };
        provider_PageResultTenantSummary: {
            content?: components["schemas"]["provider_TenantSummary"][];
            /** Format: int32 */
            page?: number;
            /** Format: int32 */
            size?: number;
            /** Format: int64 */
            totalElements?: number;
            /** Format: int32 */
            totalPages?: number;
        };
        provider_Policy: {
            description?: string;
            displayName?: string;
            lifecycleState?: string;
            ownerService?: string;
            /** Format: uuid */
            policyId?: string;
            policyKey?: string;
            policyType?: string;
            revisions?: components["schemas"]["provider_Revision"][];
            scopeRef?: string;
            scopeType?: string;
            /** Format: int64 */
            version?: number;
        };
        provider_PublishSubscriptionRenewalRequest: {
            /** Format: int64 */
            version: number;
        };
        provider_RecentActivity: {
            action?: string;
            /** Format: uuid */
            auditEventId?: string;
            category?: string;
            /** Format: date-time */
            occurredAt?: string;
            operatorName?: string;
            outcome?: string;
            targetId?: string;
            targetType?: string;
            tenantKey?: string;
        };
        provider_RegionSummary: {
            displayName?: string;
            jurisdictionCode?: string;
            lifecycleState?: string;
            regionKey?: string;
            residencyClass?: string;
        };
        provider_Relationship: {
            constraintName?: string;
            databaseKey?: string;
            relationshipId?: string;
            sourceAssetKey?: string;
            sourceColumns?: string[];
            sourceIndexed?: boolean;
            targetAssetKey?: string;
            targetColumns?: string[];
        };
        provider_ReliabilityControlOverview: {
            /** Format: int64 */
            atRiskObjectives?: number;
            driftFindings?: components["schemas"]["provider_GovernanceDriftSummary"][];
            /** Format: int64 */
            exhaustedObjectives?: number;
            /** Format: date-time */
            generatedAt?: string;
            /** Format: int64 */
            healthyObjectives?: number;
            maintenanceWindows?: components["schemas"]["provider_MaintenanceWindowSummary"][];
            objectives?: components["schemas"]["provider_ServiceLevelObjectiveSummary"][];
            /** Format: int64 */
            openDriftFindings?: number;
            /** Format: int64 */
            upcomingMaintenance?: number;
        };
        provider_ReplaceEntitlementsRequest: {
            entitlementKeys: string[];
            justification: string;
            /** Format: int64 */
            version: number;
        };
        provider_RetryOperationRequest: {
            justification: string;
            /** Format: int64 */
            version: number;
        };
        provider_ReviewSupportAccessRequest: {
            summary: string;
            /** Format: int64 */
            version: number;
        };
        provider_Revision: {
            approval?: components["schemas"]["provider_Approval"];
            /** Format: date-time */
            approvedAt?: string;
            /** Format: int64 */
            approvedBy?: number;
            /** Format: date-time */
            effectiveFrom?: string;
            /** Format: date-time */
            effectiveTo?: string;
            impact?: components["schemas"]["provider_ImpactPreview"];
            justification?: string;
            lifecycleState?: string;
            policyRule?: components["schemas"]["provider_JsonNode"];
            /** Format: uuid */
            previousRevisionId?: string;
            /** Format: date-time */
            publishedAt?: string;
            /** Format: int64 */
            requestedBy?: number;
            /** Format: uuid */
            revisionId?: string;
            /** Format: int32 */
            revisionNumber?: number;
            /** Format: uuid */
            rollbackOfRevisionId?: string;
            /** Format: date-time */
            submittedAt?: string;
            /** Format: int64 */
            version?: number;
        };
        provider_RevokeSupportSessionRequest: {
            justification: string;
            /** Format: int64 */
            version: number;
        };
        provider_Rollout: {
            /** Format: date-time */
            activatedAt?: string;
            approval?: components["schemas"]["provider_Approval"];
            /** Format: date-time */
            approvedAt?: string;
            /** Format: int64 */
            approvedBy?: number;
            /** Format: date-time */
            completedAt?: string;
            /** Format: int32 */
            currentStageOrder?: number;
            externalExecutionEnabled?: boolean;
            /** Format: uuid */
            featureFlagId?: string;
            featureKey?: string;
            justification?: string;
            lifecycleState?: string;
            name?: string;
            /** Format: date-time */
            pausedAt?: string;
            /** Format: uuid */
            previousRevisionId?: string;
            /** Format: int64 */
            requestedBy?: number;
            /** Format: int32 */
            revisionNumber?: number;
            /** Format: uuid */
            rollbackOfRevisionId?: string;
            /** Format: uuid */
            rolloutRevisionId?: string;
            rolloutValue?: components["schemas"]["provider_JsonNode"];
            stages?: components["schemas"]["provider_Stage"][];
            strategy?: string;
            /** Format: date-time */
            submittedAt?: string;
            targeting?: components["schemas"]["provider_JsonNode"];
            /** Format: int64 */
            version?: number;
        };
        provider_ServiceHealthOverview: {
            cells?: components["schemas"]["provider_CellPosture"][];
            /** Format: int64 */
            degradedInstances?: number;
            /** Format: int64 */
            failedInstances?: number;
            /** Format: date-time */
            generatedAt?: string;
            /** Format: int64 */
            healthyInstances?: number;
            /** Format: int64 */
            impactedTenants?: number;
            incidents?: components["schemas"]["provider_ServiceIncidentSummary"][];
            operatingState?: string;
            /** Format: int64 */
            pendingInstances?: number;
            services?: components["schemas"]["provider_ServicePosture"][];
            /** Format: int64 */
            totalInstances?: number;
        };
        provider_ServiceIncidentSummary: {
            customerImpact?: string;
            /** Format: uuid */
            deploymentCellId?: string;
            /** Format: date-time */
            detectedAt?: string;
            impactScope?: string;
            /** Format: uuid */
            incidentId?: string;
            incidentKey?: string;
            lifecycleState?: string;
            ownerName?: string;
            publicSummary?: string;
            regionKey?: string;
            /** Format: date-time */
            resolvedAt?: string;
            serviceKey?: string;
            severity?: string;
            /** Format: date-time */
            startedAt?: string;
            /** Format: uuid */
            tenantId?: string;
            tenantName?: string;
            title?: string;
            updates?: components["schemas"]["provider_IncidentUpdateSummary"][];
            /** Format: int64 */
            version?: number;
        };
        provider_ServiceInstanceSummary: {
            /** Format: int32 */
            appliedSchemaVersion?: number;
            dataRegion?: string;
            deploymentCell?: string;
            externalResourceId?: string;
            healthSnapshot?: string;
            /** Format: date-time */
            lastReconciledAt?: string;
            lifecycleState?: string;
            /** Format: uuid */
            serviceInstanceId?: string;
            serviceKey?: string;
            serviceName?: string;
            /** Format: int64 */
            version?: number;
        };
        provider_ServiceLevelObjectiveSummary: {
            /** Format: double */
            achievedPct?: number;
            /** Format: double */
            burnRate?: number;
            complianceState?: string;
            /** Format: int32 */
            complianceWindowDays?: number;
            criticality?: string;
            displayName?: string;
            /** Format: double */
            errorBudgetRemainingPct?: number;
            indicatorType?: string;
            measurementSource?: string;
            /** Format: uuid */
            objectiveId?: string;
            objectiveKey?: string;
            /** Format: date-time */
            observedAt?: string;
            scopeLabel?: string;
            scopeType?: string;
            serviceKey?: string;
            serviceName?: string;
            /** Format: double */
            targetPct?: number;
        };
        provider_ServicePlanPortfolio: {
            lifecycleState?: string;
            /** Format: int64 */
            organizations?: number;
            planKey?: string;
            planName?: string;
            /** Format: int32 */
            planVersion?: number;
            serviceTier?: string;
            /** Format: int64 */
            tenants?: number;
        };
        provider_ServicePosture: {
            criticality?: string;
            /** Format: int64 */
            degradedInstances?: number;
            displayName?: string;
            /** Format: int64 */
            failedInstances?: number;
            /** Format: int64 */
            healthyInstances?: number;
            /** Format: int64 */
            impactedTenants?: number;
            /** Format: date-time */
            lastReconciledAt?: string;
            /** Format: int64 */
            pendingInstances?: number;
            serviceKey?: string;
            /** Format: int64 */
            totalInstances?: number;
        };
        provider_Snapshot: {
            assets?: components["schemas"]["provider_DataAsset"][];
            databases?: components["schemas"]["provider_DatabaseSummary"][];
            findings?: components["schemas"]["provider_Finding"][];
            /** Format: date-time */
            generatedAt?: string;
            lineage?: components["schemas"]["provider_LineageEdge"][];
            relationships?: components["schemas"]["provider_Relationship"][];
            summary?: components["schemas"]["provider_Summary"];
        };
        provider_Stage: {
            /** Format: date-time */
            completedAt?: string;
            exposurePercentage?: number;
            healthGate?: components["schemas"]["provider_JsonNode"];
            lifecycleState?: string;
            /** Format: int32 */
            minimumObservationMinutes?: number;
            /** Format: uuid */
            rolloutStageId?: string;
            stageName?: string;
            /** Format: int32 */
            stageOrder?: number;
            /** Format: date-time */
            startedAt?: string;
        };
        provider_StageRequest: {
            exposurePercentage: number;
            healthGate: components["schemas"]["provider_JsonNode"];
            /** Format: int32 */
            minimumObservationMinutes?: number;
            stageName: string;
        };
        provider_SubscriptionPortfolio: {
            /** Format: int64 */
            activeEntitlements?: number;
            contractReference?: string;
            /** Format: date-time */
            endsAt?: string;
            lifecycleState?: string;
            /** Format: uuid */
            organizationId?: string;
            organizationKey?: string;
            organizationName?: string;
            planKey?: string;
            planName?: string;
            serviceTier?: string;
            /** Format: date-time */
            startsAt?: string;
            /** Format: uuid */
            subscriptionId?: string;
            /** Format: int64 */
            tenants?: number;
            /** Format: int64 */
            version?: number;
        };
        provider_SubscriptionRenewalRevision: {
            addedEntitlements?: string[];
            /** Format: int64 */
            baselineSubscriptionVersion?: number;
            contentSha256?: string;
            currentContractReference?: string;
            /** Format: date-time */
            currentEndsAt?: string;
            /** Format: int64 */
            currentEntitlementCount?: number;
            currentPlanKey?: string;
            currentPlanName?: string;
            /** Format: date-time */
            decidedAt?: string;
            /** Format: int64 */
            decidedBy?: number;
            decidedByName?: string;
            /** Format: date-time */
            decisionDueAt?: string;
            decisionReason?: string;
            executionState?: string;
            /** Format: int64 */
            impactedTenants?: number;
            lifecycleState?: string;
            notificationState?: string;
            /** Format: uuid */
            organizationId?: string;
            organizationKey?: string;
            organizationName?: string;
            /** Format: int64 */
            projectedEntitlementCount?: number;
            proposedContractReference?: string;
            /** Format: date-time */
            proposedEndsAt?: string;
            /** Format: date-time */
            publishedAt?: string;
            /** Format: int64 */
            publishedBy?: number;
            publishedByName?: string;
            reason?: string;
            removedEntitlements?: string[];
            /** Format: uuid */
            renewalRevisionId?: string;
            requestKey?: string;
            /** Format: date-time */
            requestedAt?: string;
            /** Format: int64 */
            requestedBy?: number;
            requestedByName?: string;
            /** Format: int32 */
            revisionNumber?: number;
            /** Format: uuid */
            subscriptionId?: string;
            targetPlanKey?: string;
            targetPlanName?: string;
            targetServiceTier?: string;
            /** Format: int64 */
            version?: number;
        };
        provider_SubscriptionSummary: {
            contractReference?: string;
            /** Format: date-time */
            endsAt?: string;
            lifecycleState?: string;
            planKey?: string;
            planName?: string;
            /** Format: int32 */
            planVersion?: number;
            /** Format: date-time */
            startsAt?: string;
            /** Format: uuid */
            subscriptionId?: string;
            /** Format: int64 */
            version?: number;
        };
        provider_Summary: {
            /** Format: int32 */
            availableDatabases?: number;
            /** Format: int32 */
            columns?: number;
            /** Format: int32 */
            databases?: number;
            /** Format: int32 */
            documentedAssets?: number;
            /** Format: int32 */
            foreignKeys?: number;
            /** Format: int32 */
            logicalTables?: number;
            /** Format: int32 */
            partitions?: number;
            /** Format: int32 */
            reviewRequired?: number;
            /** Format: int64 */
            totalBytes?: number;
        };
        provider_SupportAccessRequestSummary: {
            accessMode?: string;
            /** Format: date-time */
            activatedAt?: string;
            approvalReference?: string;
            /** Format: date-time */
            completedAt?: string;
            customerApprovalRequired?: boolean;
            /** Format: date-time */
            decidedAt?: string;
            /** Format: int64 */
            decidedBy?: number;
            decidedByName?: string;
            /** Format: date-time */
            decisionDueAt?: string;
            decisionReason?: string;
            /** Format: int32 */
            durationMinutes?: number;
            justification?: string;
            lifecycleState?: string;
            postReviewState?: string;
            postReviewSummary?: string;
            /** Format: date-time */
            postReviewedAt?: string;
            /** Format: int64 */
            postReviewedBy?: number;
            postReviewedByName?: string;
            requestKey?: string;
            /** Format: date-time */
            requestedAt?: string;
            requesterName?: string;
            /** Format: int64 */
            requesterOperatorId?: number;
            riskTier?: string;
            scopes?: string[];
            /** Format: uuid */
            supportAccessRequestId?: string;
            /** Format: uuid */
            supportSessionId?: string;
            /** Format: uuid */
            tenantId?: string;
            tenantKey?: string;
            tenantName?: string;
            /** Format: int64 */
            version?: number;
        };
        provider_SupportScopeSummary: {
            displayName?: string;
            lifecycleState?: string;
            requiresCustomerApproval?: boolean;
            riskTier?: string;
            scopeCode?: string;
        };
        provider_SupportSessionContext: {
            accessMode?: string;
            /** Format: int64 */
            authTenantId?: number;
            /** Format: date-time */
            expiresAt?: string;
            scopes?: string[];
            /** Format: uuid */
            supportSessionId?: string;
            /** Format: uuid */
            tenantId?: string;
            tenantKey?: string;
            tenantName?: string;
            /** Format: int64 */
            version?: number;
        };
        provider_SupportSessionSummary: {
            accessMode?: string;
            approvalReference?: string;
            customerApprovalRequired?: boolean;
            /** Format: date-time */
            expiresAt?: string;
            justification?: string;
            /** Format: date-time */
            lastUsedAt?: string;
            lifecycleState?: string;
            /** Format: int64 */
            operatorId?: number;
            operatorName?: string;
            /** Format: date-time */
            revokedAt?: string;
            riskTier?: string;
            scopes?: string[];
            /** Format: date-time */
            startedAt?: string;
            /** Format: uuid */
            supportAccessRequestId?: string;
            /** Format: uuid */
            supportSessionId?: string;
            /** Format: uuid */
            tenantId?: string;
            tenantKey?: string;
            tenantName?: string;
            /** Format: int64 */
            version?: number;
        };
        provider_TenantAdministratorSummary: {
            /** Format: date-time */
            activatedAt?: string;
            /** Format: int64 */
            authUserId?: number;
            displayName?: string;
            email?: string;
            /** Format: date-time */
            lastInvitedAt?: string;
            lifecycleState?: string;
            primaryAdministrator?: boolean;
            roleCode?: string;
            /** Format: uuid */
            tenantAdministratorId?: string;
            /** Format: int64 */
            version?: number;
        };
        provider_TenantDomainSummary: {
            /** Format: uuid */
            domainId?: string;
            domainName?: string;
            domainType?: string;
            /** Format: date-time */
            lastCheckedAt?: string;
            primaryDomain?: boolean;
            verificationMethod?: string;
            verificationState?: string;
            /** Format: date-time */
            verifiedAt?: string;
            /** Format: int64 */
            version?: number;
        };
        provider_TenantSummary: {
            administrators?: components["schemas"]["provider_TenantAdministratorSummary"][];
            /** Format: int64 */
            authTenantId?: number;
            configuration?: string;
            /** Format: date-time */
            createdAt?: string;
            dataRegion?: string;
            defaultLocale?: string;
            displayName?: string;
            domains?: components["schemas"]["provider_TenantDomainSummary"][];
            entitlements?: components["schemas"]["provider_EntitlementSummary"][];
            environmentKey?: string;
            isolationModel?: string;
            lifecycleState?: string;
            onboardingState?: string;
            /** Format: uuid */
            organizationId?: string;
            organizationKey?: string;
            organizationName?: string;
            /** Format: int32 */
            schemaVersion?: number;
            serviceTier?: string;
            services?: components["schemas"]["provider_ServiceInstanceSummary"][];
            subscription?: components["schemas"]["provider_SubscriptionSummary"];
            /** Format: uuid */
            tenantId?: string;
            tenantKey?: string;
            timeZone?: string;
            /** Format: date-time */
            updatedAt?: string;
            /** Format: int64 */
            version?: number;
        };
        provider_UpdateIncidentRequest: {
            message: string;
            state: string;
            /** Format: int64 */
            version: number;
            visibility: string;
        };
        provider_VerifyDomainRequest: {
            justification: string;
            /** Format: int64 */
            version: number;
        };
        provider_VersionedReasonRequest: {
            reason: string;
            /** Format: int64 */
            version?: number;
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
    approval_forms: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["approval_ApiResponseListFormSummary"];
                };
            };
        };
    };
    approval_form: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                formId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["approval_ApiResponseFormDetail"];
                };
            };
        };
    };
    approval_updateFormDraft: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                formId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["approval_UpdateFormDraftRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["approval_ApiResponseFormDetail"];
                };
            };
        };
    };
    approval_operations: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["approval_ApiResponseOperationsResponse"];
                };
            };
        };
    };
    approval_overview: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["approval_ApiResponseAdminPulse"];
                };
            };
        };
    };
    approval_policies: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["approval_ApiResponseListPolicySummary"];
                };
            };
        };
    };
    approval_updatePolicy: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                policyId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["approval_UpdatePolicyRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["approval_ApiResponseListPolicySummary"];
                };
            };
        };
    };
    approval_signatures: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["approval_ApiResponseListSignatureProviderSummary"];
                };
            };
        };
    };
    approval_workflows: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["approval_ApiResponseListWorkflowSummary"];
                };
            };
        };
    };
    approval_createWorkflowDraft: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["approval_CreateWorkflowDraftRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["approval_ApiResponseWorkflowDetail"];
                };
            };
        };
    };
    approval_workflow: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                workflowId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["approval_ApiResponseWorkflowDetail"];
                };
            };
        };
    };
    approval_updateWorkflowDraft: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                workflowId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["approval_UpdateWorkflowDraftRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["approval_ApiResponseWorkflowDetail"];
                };
            };
        };
    };
    approval_publishWorkflow: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                workflowId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["approval_PublishWorkflowRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["approval_ApiResponseListWorkflowSummary"];
                };
            };
        };
    };
    approval_delegations: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["approval_ApiResponseListDelegationSummary"];
                };
            };
        };
    };
    approval_createDelegation: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["approval_CreateDelegationRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["approval_ApiResponseListDelegationSummary"];
                };
            };
        };
    };
    approval_home: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["approval_ApiResponseHomeResponse"];
                };
            };
        };
    };
    approval_requests: {
        parameters: {
            query?: {
                view?: string;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["approval_ApiResponseListRequestSummary"];
                };
            };
        };
    };
    approval_create: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["approval_CreateRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["approval_ApiResponseRequestSummary"];
                };
            };
        };
    };
    approval_request: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["approval_ApiResponseRequestSummary"];
                };
            };
        };
    };
    approval_requestDetail: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["approval_ApiResponseRequestDetail"];
                };
            };
        };
    };
    approval_updateDraft: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["approval_UpdateDraftRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["approval_ApiResponseRequestDetail"];
                };
            };
        };
    };
    approval_respondToInformationRequest: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["approval_InformationResponseRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["approval_ApiResponseRequestSummary"];
                };
            };
        };
    };
    approval_submit: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["approval_VersionedActionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["approval_ApiResponseRequestSummary"];
                };
            };
        };
    };
    approval_withdraw: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["approval_VersionedActionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["approval_ApiResponseRequestSummary"];
                };
            };
        };
    };
    approval_tasks: {
        parameters: {
            query?: {
                view?: string;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["approval_ApiResponseListTaskSummary"];
                };
            };
        };
    };
    approval_task: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                taskId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["approval_ApiResponseTaskDetail"];
                };
            };
        };
    };
    approval_claim: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                taskId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["approval_VersionedActionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["approval_ApiResponseTaskDetail"];
                };
            };
        };
    };
    approval_decide: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                taskId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["approval_DecisionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["approval_ApiResponseTaskDetail"];
                };
            };
        };
    };
    approval_workflows_1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["approval_ApiResponseListWorkflowSummary"];
                };
            };
        };
    };
    approval_workflowTemplate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                workflowId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["approval_ApiResponseRequestTemplate"];
                };
            };
        };
    };
    auth_activation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                token: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseActivationSummary"];
                };
            };
        };
    };
    auth_activate_1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                token: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_ActivateAccountRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseActivateAccountResponse"];
                };
            };
        };
    };
    auth_dashboard: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseDashboard"];
                };
            };
        };
    };
    auth_requestAssignment: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_CreateAssignmentRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseAssignment"];
                };
            };
        };
    };
    auth_decideAssignment: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                assignmentId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_AssignmentDecisionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseAssignment"];
                };
            };
        };
    };
    auth_revokeAssignment: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                assignmentId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_RevokeAssignmentRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseAssignment"];
                };
            };
        };
    };
    auth_createResourceSet: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_CreateResourceSetRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseResourceSet"];
                };
            };
        };
    };
    auth_updateResourceSet: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                resourceSetId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_UpdateResourceSetRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseResourceSet"];
                };
            };
        };
    };
    auth_groupAssignments: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseListGroupRoleAssignmentSummary"];
                };
            };
        };
    };
    auth_createGroupAssignment: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_CreateGroupRoleAssignmentRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseGroupRoleAssignmentSummary"];
                };
            };
        };
    };
    auth_revokeGroupAssignment: {
        parameters: {
            query: {
                version: number;
            };
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                assignmentId: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseGroupRoleAssignmentSummary"];
                };
            };
        };
    };
    auth_resources: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseListResourceSummary"];
                };
            };
        };
    };
    auth_createResource: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_CreateResourceRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseResourceSummary"];
                };
            };
        };
    };
    auth_roles: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseListRoleSummary"];
                };
            };
        };
    };
    auth_createRole: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_CreateRoleRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseRoleSummary"];
                };
            };
        };
    };
    auth_updateRole: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                roleId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_UpdateRoleRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseRoleSummary"];
                };
            };
        };
    };
    auth_replacePermissions: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                roleId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_ReplacePermissionsRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseRoleSummary"];
                };
            };
        };
    };
    auth_effectiveAccess: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
            };
            path: {
                userId: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseEffectiveAccess"];
                };
            };
        };
    };
    auth_delegatedScopes: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseListDelegatedScopeSummary"];
                };
            };
        };
    };
    auth_createDelegatedScope: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_CreateDelegatedScopeRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseDelegatedScopeSummary"];
                };
            };
        };
    };
    auth_revokeDelegatedScope: {
        parameters: {
            query: {
                version: number;
            };
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                scopeId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseDelegatedScopeSummary"];
                };
            };
        };
    };
    auth_eligibilities: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseListEligibilitySummary"];
                };
            };
        };
    };
    auth_createEligibility: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_CreateEligibilityRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseEligibilitySummary"];
                };
            };
        };
    };
    auth_revokeEligibility: {
        parameters: {
            query: {
                version: number;
            };
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                eligibilityId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseEligibilitySummary"];
                };
            };
        };
    };
    auth_emergencyPrincipals: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseListEmergencyPrincipalSummary"];
                };
            };
        };
    };
    auth_registerEmergencyPrincipal: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_RegisterEmergencyPrincipalRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseEmergencyPrincipalSummary"];
                };
            };
        };
    };
    auth_myEligibilities: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseListEligibilitySummary"];
                };
            };
        };
    };
    auth_myRequests: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseListRequestSummary"];
                };
            };
        };
    };
    auth_policies: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseListPolicySummary"];
                };
            };
        };
    };
    auth_updatePolicy: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                policyId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_UpdatePolicyRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponsePolicySummary"];
                };
            };
        };
    };
    auth_requests: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseListRequestSummary"];
                };
            };
        };
    };
    auth_requestActivation: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_ActivationRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseRequestSummary"];
                };
            };
        };
    };
    auth_decide_1: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_ApprovalDecisionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseRequestSummary"];
                };
            };
        };
    };
    auth_revoke: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_RevokeRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseRequestSummary"];
                };
            };
        };
    };
    auth_campaigns: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseListCampaignSummary"];
                };
            };
        };
    };
    auth_create_1: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_CreateCampaignRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseCampaignSummary"];
                };
            };
        };
    };
    auth_items: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
            };
            path: {
                campaignId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseCampaignItems"];
                };
            };
        };
    };
    auth_activate: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                campaignId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_VersionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseCampaignSummary"];
                };
            };
        };
    };
    auth_complete: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                campaignId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_VersionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseCampaignSummary"];
                };
            };
        };
    };
    auth_decide: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                campaignId: string;
                itemId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_DecisionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseItemSummary"];
                };
            };
        };
    };
    auth_groups_1: {
        parameters: {
            query?: {
                query?: string;
                status?: string;
                page?: number;
                size?: number;
            };
            header?: {
                "X-Tenant-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponsePageResultDirectoryGroupSummary"];
                };
            };
        };
    };
    auth_createGroup_1: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_CreateDirectoryGroupRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseDirectoryGroupSummary"];
                };
            };
        };
    };
    auth_group_1: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
            };
            path: {
                groupId: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseDirectoryGroupDetail"];
                };
            };
        };
    };
    auth_updateGroup: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                groupId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_UpdateDirectoryGroupRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseDirectoryGroupSummary"];
                };
            };
        };
    };
    auth_activateGroup: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                groupId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_LifecycleRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseDirectoryGroupSummary"];
                };
            };
        };
    };
    auth_deactivateGroup: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                groupId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_LifecycleRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseDirectoryGroupSummary"];
                };
            };
        };
    };
    auth_replaceGroupMembers: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                groupId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_ReplaceMembersRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseDirectoryGroupDetail"];
                };
            };
        };
    };
    auth_organizations: {
        parameters: {
            query?: {
                query?: string;
                status?: string;
                page?: number;
                size?: number;
            };
            header?: {
                "X-Tenant-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponsePageResultOrganizationUnitSummary"];
                };
            };
        };
    };
    auth_createOrganization: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_CreateOrganizationUnitRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseOrganizationUnitSummary"];
                };
            };
        };
    };
    auth_organization: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
            };
            path: {
                orgUnitId: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseOrganizationUnitDetail"];
                };
            };
        };
    };
    auth_updateOrganization: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                orgUnitId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_UpdateOrganizationUnitRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseOrganizationUnitSummary"];
                };
            };
        };
    };
    auth_activateOrganization: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                orgUnitId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_LifecycleRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseOrganizationUnitSummary"];
                };
            };
        };
    };
    auth_deactivateOrganization: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                orgUnitId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_LifecycleRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseOrganizationUnitSummary"];
                };
            };
        };
    };
    auth_replaceOrganizationMembers: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                orgUnitId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_ReplaceMembersRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseOrganizationUnitDetail"];
                };
            };
        };
    };
    auth_users_2: {
        parameters: {
            query?: {
                query?: string;
                status?: string;
                page?: number;
                size?: number;
            };
            header?: {
                "X-Tenant-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponsePageResultDirectoryMemberSummary"];
                };
            };
        };
    };
    auth_audit: {
        parameters: {
            query?: {
                page?: number;
                size?: number;
            };
            header?: {
                "X-Tenant-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponsePageResultIdentityAuditEventResponse"];
                };
            };
        };
    };
    auth_roles_1: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseListRoleSummary"];
                };
            };
        };
    };
    auth_users_1: {
        parameters: {
            query?: {
                query?: string;
                page?: number;
                size?: number;
            };
            header?: {
                "X-Tenant-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponsePageResultUserAccessSummary"];
                };
            };
        };
    };
    auth_replaceRoles: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                userId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_ReplaceUserRolesRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseUserAccessSummary"];
                };
            };
        };
    };
    auth_list: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseListConnectorSummary"];
                };
            };
        };
    };
    auth_create: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_CreateRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseCredentialIssued"];
                };
            };
        };
    };
    auth_events: {
        parameters: {
            query?: {
                connectorId?: string;
                limit?: number;
            };
            header?: {
                "X-Tenant-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseListProvisioningEvent"];
                };
            };
        };
    };
    auth_lifecycle_1: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                connectorId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_LifecycleRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseConnectorSummary"];
                };
            };
        };
    };
    auth_rotate: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                connectorId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseCredentialIssued"];
                };
            };
        };
    };
    auth_getCsrfToken: {
        parameters: {
            query: {
                csrfToken: components["schemas"]["auth_CsrfToken"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseCsrfTokenResponse"];
                };
            };
        };
    };
    auth_getIdentityProviders: {
        parameters: {
            query?: never;
            header: {
                "X-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseListIdentityProviderResponse"];
                };
            };
        };
    };
    auth_login: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_LoginRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseLoginResponse"];
                };
            };
        };
    };
    auth_logout: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseVoid"];
                };
            };
        };
    };
    auth_getMe: {
        parameters: {
            query?: {
                permissionPrefix?: string;
            };
            header?: {
                "X-Tenant-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseMeResponse"];
                };
            };
        };
    };
    auth_updatePreferredLocale: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_UpdatePreferredLocaleRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseMeResponse"];
                };
            };
        };
    };
    auth_oidcCallback: {
        parameters: {
            query: {
                code: string;
                state: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseLoginResponse"];
                };
            };
        };
    };
    auth_oidcLogin: {
        parameters: {
            query: {
                tenantId?: number;
                providerKey: string;
            };
            header?: {
                "X-Tenant-ID"?: number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_RedirectView"];
                };
            };
        };
    };
    auth_getPermissions: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseListPermissionDTO"];
                };
            };
        };
    };
    auth_getPolicy: {
        parameters: {
            query?: never;
            header: {
                "X-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseAuthPolicyResponse"];
                };
            };
        };
    };
    auth_refresh: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseSessionRotationResponse"];
                };
            };
        };
    };
    auth_getSessions: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseListAuthSessionResponse"];
                };
            };
        };
    };
    auth_logoutOthers: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseVoid"];
                };
            };
        };
    };
    auth_revoke_1: {
        parameters: {
            query?: never;
            header?: {
                "X-Tenant-ID"?: string;
            };
            path: {
                sessionId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ApiResponseVoid"];
                };
            };
        };
    };
    people_list_1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseListPolicy"];
                };
            };
        };
    };
    people_create_2: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["people_CreatePolicyRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponsePolicy"];
                };
            };
        };
    };
    people_organizations: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseListOrganizationOption"];
                };
            };
        };
    };
    people_revoke: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                policyId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["people_RevokePolicyRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponsePolicy"];
                };
            };
        };
    };
    people_absence: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseAbsenceWorkspace"];
                };
            };
        };
    };
    people_createLeaveRequest: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["people_CreateLeaveRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseLeaveRequest"];
                };
            };
        };
    };
    people_decideLeaveRequest: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["people_DecisionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseApprovalItem"];
                };
            };
        };
    };
    people_withdrawLeaveRequest: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["people_WithdrawLeaveRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseAbsenceWorkspace"];
                };
            };
        };
    };
    people_benefits: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseBenefitsWorkspace"];
                };
            };
        };
    };
    people_home: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseHomeOverview"];
                };
            };
        };
    };
    people_operations: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                domain: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseDomainOperations"];
                };
            };
        };
    };
    people_pay: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponsePayWorkspace"];
                };
            };
        };
    };
    people_talent: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseTalentWorkspace"];
                };
            };
        };
    };
    people_updateGoal: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                goalId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["people_UpdateGoalRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseTalentWorkspace"];
                };
            };
        };
    };
    people_time: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseTimeWorkspace"];
                };
            };
        };
    };
    people_decideTimeCard: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                cardId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["people_DecisionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseApprovalItem"];
                };
            };
        };
    };
    people_upsertTimeEntry: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                cardId: string;
                workDate: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["people_UpsertTimeEntryRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseTimeWorkspace"];
                };
            };
        };
    };
    people_submitTimeCard: {
        parameters: {
            query: {
                version: number;
            };
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                cardId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseTimeWorkspace"];
                };
            };
        };
    };
    people_get_2: {
        parameters: {
            query?: {
                asOf?: string;
                rootOrganizationId?: string;
                depth?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseOrganizationChart"];
                };
            };
        };
    };
    people_search_1: {
        parameters: {
            query?: {
                query?: string;
                status?: string;
                cursor?: string;
                size?: number;
                asOf?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseCursorPagePersonSummary"];
                };
            };
        };
    };
    people_get_1: {
        parameters: {
            query?: {
                asOf?: string;
            };
            header?: never;
            path: {
                publicId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponsePersonDetail"];
                };
            };
        };
    };
    people_connectors: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseListConnectorInstance"];
                };
            };
        };
    };
    people_createConnector: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["people_CreateConnectorRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseConnectorInstance"];
                };
            };
        };
    };
    people_updateConnector: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                connectorId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["people_UpdateConnectorRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseConnectorInstance"];
                };
            };
        };
    };
    people_checkConnector: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                connectorId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseConfigurationCheck"];
                };
            };
        };
    };
    people_execute: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                connectorId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["people_ExecuteConnectorRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseImportResult"];
                };
            };
        };
    };
    people_reconcile: {
        parameters: {
            query: {
                syncRunId: string;
            };
            header?: never;
            path: {
                connectorId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseReconciliationRun"];
                };
            };
        };
    };
    people_mappings: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseListMappingProfile"];
                };
            };
        };
    };
    people_createMapping: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["people_CreateMappingProfileRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseMappingProfile"];
                };
            };
        };
    };
    people_activateMapping: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                mappingId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["people_ActivateMappingRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseMappingProfile"];
                };
            };
        };
    };
    people_reconciliationIssues: {
        parameters: {
            query?: {
                state?: string;
                size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseListReconciliationIssue"];
                };
            };
        };
    };
    people_resolveIssue: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                issueId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["people_ResolveIssueRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseVoid"];
                };
            };
        };
    };
    people_reconciliations: {
        parameters: {
            query?: {
                size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseListReconciliationRun"];
                };
            };
        };
    };
    people_importSample: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseImportResult"];
                };
            };
        };
    };
    people_sources: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseListSourceSystem"];
                };
            };
        };
    };
    people_runs: {
        parameters: {
            query?: {
                size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseListSyncRun"];
                };
            };
        };
    };
    people_retry: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                syncRunId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseImportResult"];
                };
            };
        };
    };
    people_list: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseListRequestSummary"];
                };
            };
        };
    };
    people_create_1: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["people_CreateRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseRequestSummary"];
                };
            };
        };
    };
    people_datasets: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseListDatasetSummary"];
                };
            };
        };
    };
    people_preview: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["people_PreviewRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponsePreview"];
                };
            };
        };
    };
    people_attempts: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseListAttemptEvent"];
                };
            };
        };
    };
    people_cancel_1: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["people_DecisionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseRequestSummary"];
                };
            };
        };
    };
    people_retry_1: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["people_DecisionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseRequestSummary"];
                };
            };
        };
    };
    people_chart: {
        parameters: {
            query?: {
                asOf?: string;
                rootOrganizationId?: string;
                scenarioId?: string;
                depth?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseOrganizationChart"];
                };
            };
        };
    };
    people_intelligence: {
        parameters: {
            query?: {
                asOf?: string;
                compareTo?: string;
                rootOrganizationId?: string;
                scenarioId?: string;
                depth?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseIntelligence"];
                };
            };
        };
    };
    people_scenarios: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseListScenario"];
                };
            };
        };
    };
    people_create: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["people_CreateScenarioRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseScenario"];
                };
            };
        };
    };
    people_decide: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                scenarioId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["people_DecideScenarioRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseScenario"];
                };
            };
        };
    };
    people_cancel: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                scenarioId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["people_CancelScenarioRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseScenario"];
                };
            };
        };
    };
    people_removeChange: {
        parameters: {
            query: {
                version: number;
            };
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                scenarioId: string;
                changeId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseScenario"];
                };
            };
        };
    };
    people_cloneScenario: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                scenarioId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["people_CloneScenarioRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseScenario"];
                };
            };
        };
    };
    people_decisionPack: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                scenarioId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseDecisionPack"];
                };
            };
        };
    };
    people_decisionPackHistory: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                scenarioId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseListValidationRunSummary"];
                };
            };
        };
    };
    people_validateDecisionPack: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                scenarioId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["people_ValidateScenarioRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseDecisionPack"];
                };
            };
        };
    };
    people_addMove: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                scenarioId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["people_AddOrganizationMoveRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseScenario"];
                };
            };
        };
    };
    people_addPositionMove: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                scenarioId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["people_AddPositionMoveRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseScenario"];
                };
            };
        };
    };
    people_createPosition: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                scenarioId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["people_CreatePositionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseScenario"];
                };
            };
        };
    };
    people_closePosition: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                scenarioId: string;
                positionId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["people_ClosePositionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseScenario"];
                };
            };
        };
    };
    people_publish: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                scenarioId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["people_PublishScenarioRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseScenario"];
                };
            };
        };
    };
    people_submit: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                scenarioId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["people_SubmitScenarioRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseScenario"];
                };
            };
        };
    };
    people_search: {
        parameters: {
            query?: {
                query?: string;
                status?: string;
                cursor?: string;
                size?: number;
                asOf?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseCursorPagePersonSummary"];
                };
            };
        };
    };
    people_get: {
        parameters: {
            query?: {
                asOf?: string;
            };
            header?: never;
            path: {
                publicId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponsePersonDetail"];
                };
            };
        };
    };
    people_catalogs: {
        parameters: {
            query?: {
                locale?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseListReferenceCatalog"];
                };
            };
        };
    };
    people_update: {
        parameters: {
            query?: {
                locale?: string;
            };
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                catalogKey: string;
                code: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["people_UpdateReferenceValueRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["people_ApiResponseReferenceValue"];
                };
            };
        };
    };
    platform_list_4: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListAnnouncementResponse"];
                };
            };
        };
    };
    platform_create_7: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_CreateAnnouncementRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseAnnouncementResponse"];
                };
            };
        };
    };
    platform_update_7: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                announcementId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_UpdateAnnouncementRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseAnnouncementResponse"];
                };
            };
        };
    };
    platform_archive: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                announcementId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_VersionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseAnnouncementResponse"];
                };
            };
        };
    };
    platform_publish_2: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                announcementId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_VersionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseAnnouncementResponse"];
                };
            };
        };
    };
    platform_events_2: {
        parameters: {
            query?: {
                window?: "H1" | "H6" | "H24" | "D7" | "D30";
                observationPoint?: string;
                serviceName?: string;
                httpMethod?: string;
                outcome?: string;
                query?: string;
                cursor?: string;
                size?: number;
            };
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseEventPage"];
                };
            };
        };
    };
    platform_detail_5: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path: {
                historyId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseTraceDetail"];
                };
            };
        };
    };
    platform_overview_5: {
        parameters: {
            query?: {
                window?: "H1" | "H6" | "H24" | "D7" | "D30";
                observationPoint?: string;
                serviceName?: string;
                httpMethod?: string;
                outcome?: string;
                query?: string;
            };
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseOverview"];
                };
            };
        };
    };
    platform_requests_4: {
        parameters: {
            query?: {
                state?: string;
            };
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-Roles"?: string;
                "X-DWP-Resource-Roles"?: string;
                "Accept-Language"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListAppAccessRequest"];
                };
            };
        };
    };
    platform_decide_2: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Resource-Roles"?: string;
                "Accept-Language"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_AppAccessDecisionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseAppAccessRequest"];
                };
            };
        };
    };
    platform_fulfill: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Resource-Roles"?: string;
                "Accept-Language"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_AppAccessFulfillmentRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseAppAccessRequest"];
                };
            };
        };
    };
    platform_revoke: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Resource-Roles"?: string;
                "Accept-Language"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_AppAccessFulfillmentRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseAppAccessRequest"];
                };
            };
        };
    };
    platform_cases: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-Permissions": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListAuditCase"];
                };
            };
        };
    };
    platform_createCase: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": string;
                "X-DWP-Permissions": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_CaseCreate"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseAuditCase"];
                };
            };
        };
    };
    platform_updateCase: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": string;
                "X-DWP-Permissions": string;
            };
            path: {
                caseId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_CaseUpdate"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseAuditCase"];
                };
            };
        };
    };
    platform_caseClosureReport: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-Permissions": string;
            };
            path: {
                caseId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseCaseClosureReport"];
                };
            };
        };
    };
    platform_ensureCaseClosureReport: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": string;
                "X-DWP-Permissions": string;
            };
            path: {
                caseId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseCaseClosureReport"];
                };
            };
        };
    };
    platform_linkEvent: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": string;
                "X-DWP-Permissions": string;
            };
            path: {
                caseId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_CaseEventLink"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseAuditCase"];
                };
            };
        };
    };
    platform_addCaseNote: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": string;
                "X-DWP-Permissions": string;
            };
            path: {
                caseId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_CaseNoteCreate"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseCaseWorkspace"];
                };
            };
        };
    };
    platform_createCaseTask: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": string;
                "X-DWP-Permissions": string;
            };
            path: {
                caseId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_CaseTaskCreate"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseCaseTask"];
                };
            };
        };
    };
    platform_updateCaseTask: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": string;
                "X-DWP-Permissions": string;
            };
            path: {
                caseId: string;
                taskId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_CaseTaskUpdate"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseCaseTask"];
                };
            };
        };
    };
    platform_caseWorkspace: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-Permissions": string;
            };
            path: {
                caseId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseCaseWorkspace"];
                };
            };
        };
    };
    platform_correlations: {
        parameters: {
            query?: {
                window?: "H24" | "D7" | "D30" | "D90";
                domain?: string;
                classification?: string;
                query?: string;
                page?: number;
                size?: number;
            };
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-Permissions": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseCorrelationPage"];
                };
            };
        };
    };
    platform_detail_4: {
        parameters: {
            query: {
                correlationId: string;
            };
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-Permissions": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseCorrelationDetail"];
                };
            };
        };
    };
    platform_events_1: {
        parameters: {
            query?: {
                window?: "H24" | "D7" | "D30" | "D90";
                category?: string;
                severity?: string;
                outcome?: string;
                sourceService?: string;
                actor?: string;
                query?: string;
                page?: number;
                size?: number;
            };
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-Permissions": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseEventPage"];
                };
            };
        };
    };
    platform_event: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-Permissions": string;
            };
            path: {
                eventId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseEvent"];
                };
            };
        };
    };
    platform_export: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": string;
                "X-DWP-Permissions": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_ExportRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseExportJob"];
                };
            };
        };
    };
    platform_exportContent: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-Permissions": string;
            };
            path: {
                exportId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": string;
                };
            };
        };
    };
    platform_findings: {
        parameters: {
            query?: {
                status?: string;
            };
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-Permissions": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListFinding"];
                };
            };
        };
    };
    platform_updateFinding: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": string;
                "X-DWP-Permissions": string;
            };
            path: {
                findingId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_FindingUpdate"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseFinding"];
                };
            };
        };
    };
    platform_findingContext: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-Permissions": string;
            };
            path: {
                findingId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseFindingContext"];
                };
            };
        };
    };
    platform_integrity: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-Permissions": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListIntegrityCheckpoint"];
                };
            };
        };
    };
    platform_checkpoint: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": string;
                "X-DWP-Permissions": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListIntegrityCheckpoint"];
                };
            };
        };
    };
    platform_overview_4: {
        parameters: {
            query?: {
                window?: "H24" | "D7" | "D30" | "D90";
            };
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-Permissions": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseOverview"];
                };
            };
        };
    };
    platform_policy_1: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-Permissions": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRetentionPolicy"];
                };
            };
        };
    };
    platform_updatePolicy_1: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": string;
                "X-DWP-Permissions": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_RetentionPolicyUpdate"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRetentionPolicy"];
                };
            };
        };
    };
    platform_policyRevisions: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-Permissions": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListPolicyRevision"];
                };
            };
        };
    };
    platform_createPolicyRevision: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": string;
                "X-DWP-Permissions": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_PolicyRevisionCreate"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponsePolicyRevision"];
                };
            };
        };
    };
    platform_decidePolicyRevision: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": string;
                "X-DWP-Permissions": string;
            };
            path: {
                revisionId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_PolicyRevisionDecision"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponsePolicyRevision"];
                };
            };
        };
    };
    platform_publishPolicyRevision: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": string;
                "X-DWP-Permissions": string;
            };
            path: {
                revisionId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_PolicyRevisionTransition"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRetentionPolicy"];
                };
            };
        };
    };
    platform_rollbackPolicyRevision: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": string;
                "X-DWP-Permissions": string;
            };
            path: {
                revisionId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_PolicyRollbackRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponsePolicyRevision"];
                };
            };
        };
    };
    platform_submitPolicyRevision: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": string;
                "X-DWP-Permissions": string;
            };
            path: {
                revisionId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_PolicyRevisionTransition"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponsePolicyRevision"];
                };
            };
        };
    };
    platform_savedSearches: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": string;
                "X-DWP-Permissions": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListSavedSearch"];
                };
            };
        };
    };
    platform_saveSearch: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": string;
                "X-DWP-Permissions": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_SavedSearchRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseSavedSearch"];
                };
            };
        };
    };
    platform_deleteSavedSearch: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": string;
                "X-DWP-Permissions": string;
            };
            path: {
                savedSearchId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseVoid"];
                };
            };
        };
    };
    platform_list_8: {
        parameters: {
            query?: {
                page?: number;
                size?: number;
            };
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseAuditPage"];
                };
            };
        };
    };
    platform_pendingBookings: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "Accept-Language"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListBookingSummary"];
                };
            };
        };
    };
    platform_decideBooking: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "Accept-Language"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                bookingId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_BookingDecisionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseBookingSummary"];
                };
            };
        };
    };
    platform_overview_3: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "Accept-Language"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseAdminOverview"];
                };
            };
        };
    };
    platform_policy: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponsePolicy"];
                };
            };
        };
    };
    platform_updatePolicy: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_PolicyRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponsePolicy"];
                };
            };
        };
    };
    platform_createResource: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "Accept-Language"?: string;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_ResourceRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseResourceSummary"];
                };
            };
        };
    };
    platform_updateResource: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "Accept-Language"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                resourceId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_ResourceRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseResourceSummary"];
                };
            };
        };
    };
    platform_overview_2: {
        parameters: {
            query?: {
                query?: string;
                kind?: string;
                lifecycle?: string;
            };
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseOverview"];
                };
            };
        };
    };
    platform_assurance: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseAssuranceSummary"];
                };
            };
        };
    };
    platform_evaluateAssurance: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseAssuranceSummary"];
                };
            };
        };
    };
    platform_dispositionFinding: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                findingId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_DispositionFindingRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseAssuranceFinding"];
                };
            };
        };
    };
    platform_graph: {
        parameters: {
            query?: {
                focusRef?: string;
                depth?: number;
            };
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseGraph"];
                };
            };
        };
    };
    platform_impact: {
        parameters: {
            query: {
                ref: string;
                operation?: string;
            };
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseImpactAnalysis"];
                };
            };
        };
    };
    platform_declare: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_DeclareRelationRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRelation"];
                };
            };
        };
    };
    platform_retire_2: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                relationId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_RelationVersionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRelation"];
                };
            };
        };
    };
    platform_get_2: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseHomeExperienceResponse"];
                };
            };
        };
    };
    platform_update_6: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_UpdateHomeExperienceRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseHomeExperienceResponse"];
                };
            };
        };
    };
    platform_background: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": string;
                };
            };
        };
    };
    platform_uploadBackground: {
        parameters: {
            query: {
                version: number;
            };
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "multipart/form-data": {
                    /** Format: binary */
                    file: string;
                };
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseHomeExperienceResponse"];
                };
            };
        };
    };
    platform_resetBackground: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_VersionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseHomeExperienceResponse"];
                };
            };
        };
    };
    platform_updateLaunchpad: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_UpdateLaunchpadConfigurationRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseHomeExperienceResponse"];
                };
            };
        };
    };
    platform_history_1: {
        parameters: {
            query?: {
                limit?: number;
            };
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListHomeExperienceRevisionResponse"];
                };
            };
        };
    };
    platform_rollback_1: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                revisionId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_VersionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseHomeExperienceResponse"];
                };
            };
        };
    };
    platform_connectors: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-Permissions": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListConnector"];
                };
            };
        };
    };
    platform_create_6: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Permissions": string;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_SaveConnectorRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseConnector"];
                };
            };
        };
    };
    platform_update_5: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Permissions": string;
                "X-Correlation-ID"?: string;
            };
            path: {
                connectorId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_SaveConnectorRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseConnector"];
                };
            };
        };
    };
    platform_activate_2: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Permissions": string;
                "X-Correlation-ID"?: string;
            };
            path: {
                connectorId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_LifecycleRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseConnector"];
                };
            };
        };
    };
    platform_configurationCheck: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-Permissions": string;
            };
            path: {
                connectorId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseConfigurationCheck"];
                };
            };
        };
    };
    platform_suspend: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Permissions": string;
                "X-Correlation-ID"?: string;
            };
            path: {
                connectorId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_LifecycleRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseConnector"];
                };
            };
        };
    };
    platform_overview_1: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-Permissions": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseOverview"];
                };
            };
        };
    };
    platform_runs: {
        parameters: {
            query?: {
                limit?: number;
            };
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-Permissions": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListSyncRun"];
                };
            };
        };
    };
    platform_subjects: {
        parameters: {
            query?: {
                limit?: number;
            };
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-Permissions": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListSubject"];
                };
            };
        };
    };
    platform_workspace_1: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseWorkspace"];
                };
            };
        };
    };
    platform_createBundle: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_CreateBundleRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRevision"];
                };
            };
        };
    };
    platform_createDraft_1: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                bundleId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_RestoreRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRevision"];
                };
            };
        };
    };
    platform_revisions: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path: {
                bundleId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListRevision"];
                };
            };
        };
    };
    platform_revision: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path: {
                revisionId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRevision"];
                };
            };
        };
    };
    platform_saveDraft_1: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                revisionId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_SaveDraftRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRevision"];
                };
            };
        };
    };
    platform_decide_1: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                revisionId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_DecisionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRevision"];
                };
            };
        };
    };
    platform_diff: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path: {
                revisionId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseDiff"];
                };
            };
        };
    };
    platform_preview_1: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path: {
                revisionId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponsePreview"];
                };
            };
        };
    };
    platform_publish_1: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                revisionId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_TransitionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRevision"];
                };
            };
        };
    };
    platform_restore_1: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                revisionId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_RestoreRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRevision"];
                };
            };
        };
    };
    platform_submit_1: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                revisionId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_TransitionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRevision"];
                };
            };
        };
    };
    platform_list_3: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListAdminNode"];
                };
            };
        };
    };
    platform_create_5: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_CreateRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseAdminNode"];
                };
            };
        };
    };
    platform_reorder: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_ReorderRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListAdminNode"];
                };
            };
        };
    };
    platform_workspace: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseWorkspace"];
                };
            };
        };
    };
    platform_createDraft: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_CreateDraftRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRevision"];
                };
            };
        };
    };
    platform_saveDraft: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                revisionId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_SaveDraftRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRevision"];
                };
            };
        };
    };
    platform_cancel_3: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                revisionId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_VersionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRevision"];
                };
            };
        };
    };
    platform_publish: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                revisionId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_VersionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRevision"];
                };
            };
        };
    };
    platform_restore: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                revisionId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_CreateDraftRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRevision"];
                };
            };
        };
    };
    platform_update_4: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                itemId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_UpdateRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseAdminNode"];
                };
            };
        };
    };
    platform_activate_1: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                itemId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_VersionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseAdminNode"];
                };
            };
        };
    };
    platform_retire_1: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                itemId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_VersionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseAdminNode"];
                };
            };
        };
    };
    platform_requests_3: {
        parameters: {
            query?: {
                state?: string;
            };
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListPreferenceExceptionRequest"];
                };
            };
        };
    };
    platform_decide: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_DecideExceptionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponsePreferenceExceptionRequest"];
                };
            };
        };
    };
    platform_list_2: {
        parameters: {
            query?: {
                query?: string;
                lifecycle?: "DRAFT" | "ACTIVE" | "RETIRED";
                page?: number;
                size?: number;
            };
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponsePageResultReferenceSetSummary"];
                };
            };
        };
    };
    platform_create_4: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_CreateSetRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseReferenceSetDetail"];
                };
            };
        };
    };
    platform_detail: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path: {
                setKey: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseReferenceSetDetail"];
                };
            };
        };
    };
    platform_update_8: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                setKey: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_UpdateSetRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseReferenceSetDetail"];
                };
            };
        };
    };
    platform_activate: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                setKey: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_VersionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseReferenceSetDetail"];
                };
            };
        };
    };
    platform_activity_1: {
        parameters: {
            query?: {
                page?: number;
                size?: number;
            };
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path: {
                setKey: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseAuditPage"];
                };
            };
        };
    };
    platform_createItem: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                setKey: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_CreateItemRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseReferenceSetDetail"];
                };
            };
        };
    };
    platform_updateItem: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                setKey: string;
                code: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_UpdateItemRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseReferenceSetDetail"];
                };
            };
        };
    };
    platform_activateItem: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                setKey: string;
                code: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_VersionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseReferenceSetDetail"];
                };
            };
        };
    };
    platform_retireItem: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                setKey: string;
                code: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_VersionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseReferenceSetDetail"];
                };
            };
        };
    };
    platform_retire: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                setKey: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_VersionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseReferenceSetDetail"];
                };
            };
        };
    };
    platform_list_1: {
        parameters: {
            query?: {
                registryType?: "APP" | "CONNECTOR" | "AGENT" | "TOOL" | "POLICY" | "API" | "DATA_PRODUCT";
                lifecycle?: "DRAFT" | "ACTIVE" | "RETIRED";
                query?: string;
                page?: number;
                size?: number;
            };
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponsePageResultRegistryEntryResponse"];
                };
            };
        };
    };
    platform_create_3: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_CreateRegistryEntryRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRegistryEntryResponse"];
                };
            };
        };
    };
    platform_detail_3: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path: {
                registryType: "APP" | "CONNECTOR" | "AGENT" | "TOOL" | "POLICY" | "API" | "DATA_PRODUCT";
                entryKey: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRegistryEntryDetail"];
                };
            };
        };
    };
    platform_createRevision: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                registryType: "APP" | "CONNECTOR" | "AGENT" | "TOOL" | "POLICY" | "API" | "DATA_PRODUCT";
                entryKey: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_CreateRegistryRevisionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRegistryEntryResponse"];
                };
            };
        };
    };
    platform_updateRevision: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                registryType: "APP" | "CONNECTOR" | "AGENT" | "TOOL" | "POLICY" | "API" | "DATA_PRODUCT";
                entryKey: string;
                revision: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_UpdateRegistryRevisionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRegistryEntryResponse"];
                };
            };
        };
    };
    platform_activateRevision: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                registryType: "APP" | "CONNECTOR" | "AGENT" | "TOOL" | "POLICY" | "API" | "DATA_PRODUCT";
                entryKey: string;
                revision: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_VersionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRegistryEntryResponse"];
                };
            };
        };
    };
    platform_retireRevision: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                registryType: "APP" | "CONNECTOR" | "AGENT" | "TOOL" | "POLICY" | "API" | "DATA_PRODUCT";
                entryKey: string;
                revision: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_VersionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRegistryEntryResponse"];
                };
            };
        };
    };
    platform_orphaned: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-Permissions": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListOrphanedView"];
                };
            };
        };
    };
    platform_preview: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-Permissions": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_OwnershipPlanRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseOwnershipPreview"];
                };
            };
        };
    };
    platform_transfers: {
        parameters: {
            query?: {
                limit?: number;
            };
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-Permissions": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListOwnershipTransferSummary"];
                };
            };
        };
    };
    platform_transfer: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Permissions": string;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_OwnershipTransferRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseOwnershipTransfer"];
                };
            };
        };
    };
    platform_catalog: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListAdminCatalogItem"];
                };
            };
        };
    };
    platform_createCatalog: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_CatalogDefinitionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseAdminCatalogItem"];
                };
            };
        };
    };
    platform_saveCatalog: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                serviceKey: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_CatalogDefinitionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseAdminCatalogItem"];
                };
            };
        };
    };
    platform_requests_2: {
        parameters: {
            query?: {
                status?: "DRAFT" | "SUBMITTED" | "TRIAGED" | "IN_PROGRESS" | "AWAITING_REQUESTER" | "RESOLVED" | "CLOSED" | "CANCELLED";
            };
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListRequestSummary"];
                };
            };
        };
    };
    platform_request_2: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRequestDetail"];
                };
            };
        };
    };
    platform_transition: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_TransitionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRequestDetail"];
                };
            };
        };
    };
    platform_get_1: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseTenantBrandingResponse"];
                };
            };
        };
    };
    platform_update_3: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_UpdateTenantBrandingRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseTenantBrandingResponse"];
                };
            };
        };
    };
    platform_logo: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": string;
                };
            };
        };
    };
    platform_uploadLogo: {
        parameters: {
            query: {
                version: number;
            };
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "multipart/form-data": {
                    /** Format: binary */
                    file: string;
                };
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseTenantBrandingResponse"];
                };
            };
        };
    };
    platform_resetLogo: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_VersionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseTenantBrandingResponse"];
                };
            };
        };
    };
    platform_history: {
        parameters: {
            query?: {
                limit?: number;
            };
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListBrandingRevisionResponse"];
                };
            };
        };
    };
    platform_rollback: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                revisionId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_VersionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseTenantBrandingResponse"];
                };
            };
        };
    };
    platform_list_7: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-Roles"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListAnnouncementResponse"];
                };
            };
        };
    };
    platform_recordAction: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Roles"?: string;
            };
            path: {
                announcementId: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseVoid"];
                };
            };
        };
    };
    platform_recordView: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Roles"?: string;
            };
            path: {
                announcementId: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseVoid"];
                };
            };
        };
    };
    platform_availability: {
        parameters: {
            query: {
                personIds?: string[];
                from: string;
                to: string;
                durationMinutes?: number;
                timeZone?: string;
            };
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Person-Public-ID"?: string;
                "Accept-Language"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseAvailabilityResponse"];
                };
            };
        };
    };
    platform_calendars: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Person-Public-ID"?: string;
                "Accept-Language"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListCalendarSummary"];
                };
            };
        };
    };
    platform_events: {
        parameters: {
            query: {
                from: string;
                to: string;
            };
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Person-Public-ID"?: string;
                "Accept-Language"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListEventSummary"];
                };
            };
        };
    };
    platform_create_2: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Person-Public-ID"?: string;
                "X-DWP-Display-Name-B64"?: string;
                "Accept-Language"?: string;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_CreateEventRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseEventSummary"];
                };
            };
        };
    };
    platform_update_2: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Person-Public-ID"?: string;
                "Accept-Language"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                eventId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_UpdateEventRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseEventSummary"];
                };
            };
        };
    };
    platform_cancel_2: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Person-Public-ID"?: string;
                "Accept-Language"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                eventId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_VersionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseVoid"];
                };
            };
        };
    };
    platform_respond: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Person-Public-ID"?: string;
                "Accept-Language"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                eventId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_RespondRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseEventSummary"];
                };
            };
        };
    };
    platform_home: {
        parameters: {
            query?: {
                timeZone?: string;
            };
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Person-Public-ID"?: string;
                "Accept-Language"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseHomeResponse"];
                };
            };
        };
    };
    platform_resources: {
        parameters: {
            query: {
                from: string;
                to: string;
            };
            header: {
                "X-DWP-Tenant-ID": number;
                "Accept-Language"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListResourceSummary"];
                };
            };
        };
    };
    platform_get_7: {
        parameters: {
            query?: {
                locale?: string;
            };
            header?: never;
            path: {
                codeSetKey: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRuntimeCodeSet"];
                };
            };
        };
    };
    platform_list_6: {
        parameters: {
            query?: {
                registryType?: "APP" | "CONNECTOR" | "AGENT" | "TOOL" | "POLICY" | "API" | "DATA_PRODUCT";
            };
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListRuntimeRegistryEntry"];
                };
            };
        };
    };
    platform_detail_2: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path: {
                registryType: "APP" | "CONNECTOR" | "AGENT" | "TOOL" | "POLICY" | "API" | "DATA_PRODUCT";
                entryKey: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRuntimeRegistryEntry"];
                };
            };
        };
    };
    platform_feed: {
        parameters: {
            query?: {
                scope?: string;
                query?: string;
                type?: string;
                size?: number;
            };
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Roles"?: string;
                "Accept-Language"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseFeedResponse"];
                };
            };
        };
    };
    platform_detail_1: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Roles"?: string;
                "Accept-Language"?: string;
            };
            path: {
                communicationId: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseCommunicationItem"];
                };
            };
        };
    };
    platform_acknowledge: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Roles"?: string;
            };
            path: {
                communicationId: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseReaderPreferenceResponse"];
                };
            };
        };
    };
    platform_recordInteraction: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Roles"?: string;
            };
            path: {
                communicationId: number;
                eventType: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseVoid"];
                };
            };
        };
    };
    platform_updateReaction: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Roles"?: string;
            };
            path: {
                communicationId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_ReactionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseReactionSummary"];
                };
            };
        };
    };
    platform_updatePreference: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Roles"?: string;
            };
            path: {
                communicationId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_ReaderPreferenceRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseReaderPreferenceResponse"];
                };
            };
        };
    };
    platform_get_6: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseHomeExperienceResponse"];
                };
            };
        };
    };
    platform_background_1: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": string;
                };
            };
        };
    };
    platform_get: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseHomePreferenceResponse"];
                };
            };
        };
    };
    platform_update_1: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_UpdateHomePreferenceRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseHomePreferenceResponse"];
                };
            };
        };
    };
    platform_reset_1: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_VersionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseHomePreferenceResponse"];
                };
            };
        };
    };
    platform_getSurface: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
            };
            path: {
                surfaceKey: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseHomePreferenceResponse"];
                };
            };
        };
    };
    platform_updateSurface: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                surfaceKey: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_UpdateHomePreferenceRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseHomePreferenceResponse"];
                };
            };
        };
    };
    platform_resetSurface: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                surfaceKey: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_VersionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseHomePreferenceResponse"];
                };
            };
        };
    };
    platform_overview: {
        parameters: {
            query?: {
                timeZone?: string;
            };
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Person-Public-ID"?: string;
                "X-DWP-Permissions"?: string;
                "X-DWP-Roles"?: string;
                "Accept-Language"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseHomeOverviewResponse"];
                };
            };
        };
    };
    platform_recordFeedback: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                recommendationKey: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_RecommendationFeedbackRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRecommendationFeedbackResponse"];
                };
            };
        };
    };
    platform_list_5: {
        parameters: {
            query?: {
                locale?: string;
            };
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListRuntimeNode"];
                };
            };
        };
    };
    platform_ingest: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_WebVitalRequest"];
            };
        };
        responses: {
            /** @description Metric accepted */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Unsupported metric or rating */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    platform_get_3: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponsePersonalPreferenceResponse"];
                };
            };
        };
    };
    platform_patch: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_PatchPersonalPreferenceRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponsePersonalPreferenceResponse"];
                };
            };
        };
    };
    platform_requests_1: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListPreferenceExceptionRequest"];
                };
            };
        };
    };
    platform_request: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_CreateExceptionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponsePreferenceExceptionRequest"];
                };
            };
        };
    };
    platform_cancel_1: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_VersionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponsePreferenceExceptionRequest"];
                };
            };
        };
    };
    platform_policy_2: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseManagedPreferencePolicy"];
                };
            };
        };
    };
    platform_reset: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_VersionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponsePersonalPreferenceResponse"];
                };
            };
        };
    };
    platform_get_5: {
        parameters: {
            query?: {
                locale?: string;
            };
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path: {
                setKey: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRuntimeReferenceSet"];
                };
            };
        };
    };
    platform_record: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Roles"?: string;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_AuditRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseAuditReceipt"];
                };
            };
        };
    };
    platform_catalog_1: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "Accept-Language"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseCatalogResponse"];
                };
            };
        };
    };
    platform_requests: {
        parameters: {
            query?: {
                status?: "DRAFT" | "SUBMITTED" | "TRIAGED" | "IN_PROGRESS" | "AWAITING_REQUESTER" | "RESOLVED" | "CLOSED" | "CANCELLED";
            };
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListRequestSummary"];
                };
            };
        };
    };
    platform_create_1: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_CreateRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRequestDetail"];
                };
            };
        };
    };
    platform_request_1: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRequestDetail"];
                };
            };
        };
    };
    platform_cancel: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_VersionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRequestDetail"];
                };
            };
        };
    };
    platform_updateDraft: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_UpdateDraftRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRequestDetail"];
                };
            };
        };
    };
    platform_submit: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-Correlation-ID"?: string;
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_VersionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseRequestDetail"];
                };
            };
        };
    };
    platform_get_4: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseTenantBrandingResponse"];
                };
            };
        };
    };
    platform_logo_1: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": string;
                };
            };
        };
    };
    platform_activity: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Permissions": string;
                "Accept-Language"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseActivityFeed"];
                };
            };
        };
    };
    platform_cancelAccessRequest: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Permissions": string;
                "Accept-Language"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_VersionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseAppAccessRequest"];
                };
            };
        };
    };
    platform_apps: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Permissions": string;
                "Accept-Language"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListWorkspaceApp"];
                };
            };
        };
    };
    platform_requestAccess: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Permissions": string;
                "Accept-Language"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                appId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_CreateAppAccessRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseAppAccessRequest"];
                };
            };
        };
    };
    platform_launch: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Permissions": string;
                "Accept-Language"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                appId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseAppLaunch"];
                };
            };
        };
    };
    platform_setPinned: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Permissions": string;
                "Accept-Language"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                appId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_PinAppRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseWorkspaceApp"];
                };
            };
        };
    };
    platform_completeAuthorization: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Permissions": string;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_AuthorizationCallbackRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseConnection"];
                };
            };
        };
    };
    platform_connections: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Permissions": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListConnection"];
                };
            };
        };
    };
    platform_beginAuthorization: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Permissions": string;
            };
            path: {
                connectorId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseAuthorizationStart"];
                };
            };
        };
    };
    platform_sync: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Permissions": string;
                "X-Correlation-ID"?: string;
            };
            path: {
                connectorId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_SyncRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseSyncRun"];
                };
            };
        };
    };
    platform_items: {
        parameters: {
            query?: {
                resourceKind?: "MAIL" | "CALENDAR";
                page?: number;
                size?: number;
            };
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Permissions": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseItemPage"];
                };
            };
        };
    };
    platform_list: {
        parameters: {
            query: {
                surfaceKey: string;
            };
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Roles"?: string;
                "X-DWP-Group-Refs"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListSavedView"];
                };
            };
        };
    };
    platform_create: {
        parameters: {
            query: {
                surfaceKey: string;
            };
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Roles"?: string;
                "X-DWP-Group-Refs"?: string;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_CreateRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseSavedView"];
                };
            };
        };
    };
    platform_update: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Roles"?: string;
                "X-DWP-Group-Refs"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                savedViewId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_UpdateRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseSavedView"];
                };
            };
        };
    };
    platform_delete: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Roles"?: string;
                "X-DWP-Group-Refs"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                savedViewId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseVoid"];
                };
            };
        };
    };
    platform_preference: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Roles"?: string;
                "X-DWP-Group-Refs"?: string;
            };
            path: {
                savedViewId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_PreferenceRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseSavedView"];
                };
            };
        };
    };
    platform_markUsed: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Group-Refs"?: string;
            };
            path: {
                savedViewId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseVoid"];
                };
            };
        };
    };
    platform_workItems: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Permissions": string;
                "Accept-Language"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseWorkQueue"];
                };
            };
        };
    };
    platform_updateWorkStatuses: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Permissions": string;
                "Accept-Language"?: string;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_BatchUpdateWorkStatusRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseListWorkItem"];
                };
            };
        };
    };
    platform_updateWorkStatus: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Tenant-ID": number;
                "X-DWP-User-ID": number;
                "X-DWP-Permissions": string;
                "Accept-Language"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                workItemId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["platform_UpdateWorkStatusRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["platform_ApiResponseWorkItem"];
                };
            };
        };
    };
    provider_auditEvents: {
        parameters: {
            query?: {
                tenantId?: string;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseListAuditEventSummary"];
                };
            };
        };
    };
    provider_auditInsights: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseAuditInsights"];
                };
            };
        };
    };
    provider_catalog: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseJsonNode"];
                };
            };
        };
    };
    provider_get: {
        parameters: {
            query?: {
                locale?: string;
            };
            header?: never;
            path: {
                codeSetKey: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseJsonNode"];
                };
            };
        };
    };
    provider_commandCenter: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseCommandCenter"];
                };
            };
        };
    };
    provider_commercial: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseCommercialOverview"];
                };
            };
        };
    };
    provider_snapshot: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseSnapshot"];
                };
            };
        };
    };
    provider_policies: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseListPolicy"];
                };
            };
        };
    };
    provider_create: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_CreatePolicyRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponsePolicy"];
                };
            };
        };
    };
    provider_decide_1: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                revisionId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_ApprovalDecisionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseRevision"];
                };
            };
        };
    };
    provider_preview: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                revisionId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_VersionedReasonRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseRevision"];
                };
            };
        };
    };
    provider_publish: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                revisionId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_VersionedReasonRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseRevision"];
                };
            };
        };
    };
    provider_requestRollback: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                revisionId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_VersionedReasonRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseRevision"];
                };
            };
        };
    };
    provider_submit_1: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                revisionId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_VersionedReasonRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseRevision"];
                };
            };
        };
    };
    provider_createRevision: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                policyId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_CreateRevisionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseRevision"];
                };
            };
        };
    };
    provider_refresh: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseSnapshot"];
                };
            };
        };
    };
    provider_entitlements: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseListEntitlementSummary"];
                };
            };
        };
    };
    provider_rollouts: {
        parameters: {
            query?: {
                featureKey?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseListRollout"];
                };
            };
        };
    };
    provider_flags: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseListFeatureFlag"];
                };
            };
        };
    };
    provider_createFlag: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_CreateFeatureFlagRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseFeatureFlag"];
                };
            };
        };
    };
    provider_evaluate: {
        parameters: {
            query: {
                tenantId: string;
            };
            header?: never;
            path: {
                featureKey: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseEvaluation"];
                };
            };
        };
    };
    provider_createRollout: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                featureKey: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_CreateRolloutRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseRollout"];
                };
            };
        };
    };
    provider_rollout: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                rolloutId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseRollout"];
                };
            };
        };
    };
    provider_activate: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                rolloutId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_VersionedReasonRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseRollout"];
                };
            };
        };
    };
    provider_advance: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                rolloutId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_AdvanceRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseRollout"];
                };
            };
        };
    };
    provider_decide: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                rolloutId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_ApprovalDecisionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseRollout"];
                };
            };
        };
    };
    provider_pause: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                rolloutId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_VersionedReasonRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseRollout"];
                };
            };
        };
    };
    provider_resume: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                rolloutId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_VersionedReasonRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseRollout"];
                };
            };
        };
    };
    provider_rollback: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                rolloutId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_VersionedReasonRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseRollout"];
                };
            };
        };
    };
    provider_submit: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                rolloutId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_VersionedReasonRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseRollout"];
                };
            };
        };
    };
    provider_createIncident: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_CreateIncidentRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseServiceIncidentSummary"];
                };
            };
        };
    };
    provider_updateIncident: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                incidentId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_UpdateIncidentRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseServiceIncidentSummary"];
                };
            };
        };
    };
    provider_createMaintenanceWindow: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_CreateMaintenanceWindowRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseMaintenanceWindowSummary"];
                };
            };
        };
    };
    provider_me: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseOperatorProfile"];
                };
            };
        };
    };
    provider_previewOnboarding: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_OnboardingPlanRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseOperationSummary"];
                };
            };
        };
    };
    provider_operationApprovals: {
        parameters: {
            query?: {
                state?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseListOperationApprovalSummary"];
                };
            };
        };
    };
    provider_decideOperationApproval: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                approvalId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_DecideOperationApprovalRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseOperationApprovalSummary"];
                };
            };
        };
    };
    provider_operations: {
        parameters: {
            query?: {
                page?: number;
                size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponsePageResultOperationSummary"];
                };
            };
        };
    };
    provider_execute: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                operationId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_ExecuteOperationRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseOperationSummary"];
                };
            };
        };
    };
    provider_retry: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                operationId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_RetryOperationRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseOperationSummary"];
                };
            };
        };
    };
    provider_overview: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseEstateOverview"];
                };
            };
        };
    };
    provider_regions: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseListRegionSummary"];
                };
            };
        };
    };
    provider_reliabilityControl: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseReliabilityControlOverview"];
                };
            };
        };
    };
    provider_serviceHealth: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseServiceHealthOverview"];
                };
            };
        };
    };
    provider_subscriptionRenewals: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseListSubscriptionRenewalRevision"];
                };
            };
        };
    };
    provider_createSubscriptionRenewal: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_CreateSubscriptionRenewalRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseSubscriptionRenewalRevision"];
                };
            };
        };
    };
    provider_decideSubscriptionRenewal: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                revisionId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_DecideSubscriptionRenewalRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseSubscriptionRenewalRevision"];
                };
            };
        };
    };
    provider_publishSubscriptionRenewal: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                revisionId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_PublishSubscriptionRenewalRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseSubscriptionRenewalRevision"];
                };
            };
        };
    };
    provider_supportAccessRequests: {
        parameters: {
            query?: {
                tenantId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseListSupportAccessRequestSummary"];
                };
            };
        };
    };
    provider_createSupportAccessRequest: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_CreateSupportAccessRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseSupportAccessRequestSummary"];
                };
            };
        };
    };
    provider_activateSupportAccessRequest: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_ActivateSupportAccessRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseSupportAccessRequestSummary"];
                };
            };
        };
    };
    provider_cancelSupportAccessRequest: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_CancelSupportAccessRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseSupportAccessRequestSummary"];
                };
            };
        };
    };
    provider_decideSupportAccessRequest: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_DecideSupportAccessRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseSupportAccessRequestSummary"];
                };
            };
        };
    };
    provider_reviewSupportAccessRequest: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                requestId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_ReviewSupportAccessRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseSupportAccessRequestSummary"];
                };
            };
        };
    };
    provider_supportScopes: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseListSupportScopeSummary"];
                };
            };
        };
    };
    provider_supportSessionContext: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: {
                DWP_SUPPORT_SESSION?: string;
            };
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseSupportSessionContext"];
                };
            };
        };
    };
    provider_supportSessions: {
        parameters: {
            query?: {
                tenantId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseListSupportSessionSummary"];
                };
            };
        };
    };
    provider_createSupportSession: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_CreateSupportSessionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseSupportSessionSummary"];
                };
            };
        };
    };
    provider_revokeSupportSession: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                sessionId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_RevokeSupportSessionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseSupportSessionSummary"];
                };
            };
        };
    };
    provider_tenants: {
        parameters: {
            query?: {
                query?: string;
                state?: string;
                region?: string;
                serviceTier?: string;
                isolationModel?: string;
                page?: number;
                size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponsePageResultTenantSummary"];
                };
            };
        };
    };
    provider_tenant: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                tenantId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseTenantSummary"];
                };
            };
        };
    };
    provider_issueAdministratorInvitation: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                tenantId: string;
                administratorId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_IssueAdministratorInvitationRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseAdministratorInvitation"];
                };
            };
        };
    };
    provider_createDomain: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                tenantId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_CreateDomainRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseDomainChallenge"];
                };
            };
        };
    };
    provider_domainChallenge: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                tenantId: string;
                domainId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseDomainChallenge"];
                };
            };
        };
    };
    provider_verifyDomain: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                tenantId: string;
                domainId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_VerifyDomainRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseTenantDomainSummary"];
                };
            };
        };
    };
    provider_replaceEntitlements: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                tenantId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_ReplaceEntitlementsRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseTenantSummary"];
                };
            };
        };
    };
    provider_lifecycle: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path: {
                tenantId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["provider_LifecycleRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseTenantSummary"];
                };
            };
        };
    };
    provider_resolve: {
        parameters: {
            query?: never;
            header: {
                "X-DWP-Support-Validation-Token"?: string;
                "X-DWP-Support-Resource-Method": string;
                "X-DWP-Support-Resource-Path": string;
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie: {
                DWP_SUPPORT_SESSION: string;
            };
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["provider_ApiResponseSupportSessionContext"];
                };
            };
        };
    };
    auth_groups: {
        parameters: {
            query?: {
                filter?: string;
                startIndex?: number;
                count?: number;
                cursor?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ListResponseGroupResponse"];
                };
            };
        };
    };
    auth_createGroup: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_GroupRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_GroupResponse"];
                };
            };
        };
    };
    auth_group: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_GroupResponse"];
                };
            };
        };
    };
    auth_replaceGroup: {
        parameters: {
            query?: never;
            header?: {
                "If-Match"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_GroupRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_GroupResponse"];
                };
            };
        };
    };
    auth_deleteGroup: {
        parameters: {
            query?: never;
            header?: {
                "If-Match"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    auth_patchGroup: {
        parameters: {
            query?: never;
            header?: {
                "If-Match"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_PatchRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_GroupResponse"];
                };
            };
        };
    };
    auth_resourceTypes: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": {
                        [key: string]: unknown;
                    };
                };
            };
        };
    };
    auth_schemas: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": {
                        [key: string]: unknown;
                    };
                };
            };
        };
    };
    auth_serviceProviderConfig: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": {
                        [key: string]: unknown;
                    };
                };
            };
        };
    };
    auth_users: {
        parameters: {
            query?: {
                filter?: string;
                startIndex?: number;
                count?: number;
                cursor?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_ListResponseUserResponse"];
                };
            };
        };
    };
    auth_createUser: {
        parameters: {
            query?: never;
            header?: {
                "X-Correlation-ID"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_UserRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_UserResponse"];
                };
            };
        };
    };
    auth_user: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_UserResponse"];
                };
            };
        };
    };
    auth_replaceUser: {
        parameters: {
            query?: never;
            header?: {
                "If-Match"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_UserRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_UserResponse"];
                };
            };
        };
    };
    auth_deleteUser: {
        parameters: {
            query?: never;
            header?: {
                "If-Match"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    auth_patchUser: {
        parameters: {
            query?: never;
            header?: {
                "If-Match"?: string;
                "X-Correlation-ID"?: string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["auth_PatchRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["auth_UserResponse"];
                };
            };
        };
    };
}
