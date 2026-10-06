# Frontend Approval committed-baseline remediation — final independent report

Evaluated: 2026-09-14T14:34:08Z  
Verdict: **PASS for the four assigned Approval baseline defects only**  
Gate / READY / G4 / G6 authority: **none**

## Fixed revision

- Required committed source: `4e1333c66dfd9563ecbf321cfcda3b3f6b7f9778`
- Independent branch: `codex/hris-approval-gate-prep-20260914`
- Clean remediation commit: `31b42a6311296c4a4fcf28212f076658dce7b19e`
- Result tree: `168e7bcd176606032b4ee294bc3624bc7df09ae4`
- Worktree: `/Users/a10697/Work/DWP/.codex-worktrees/hris/prep/approval-gate/frontend`

The user’s dirty main frontend was not read, copied, or modified. The integration frontend was read-only. No allowlist, Gate, READY, G4, G6, backend runtime, or frontend authority source was changed.

## Decisions and close evidence

### 1. Product-action shortcut contract — closed

`approval-admin-overview.tsx` had duplicated workflow/operation route strings instead of the canonical shortcut objects. It now consumes `PRODUCT_PAGE_SHORTCUT_TARGETS.approvalWorkflows` and `.approvalOperations` as the complete product/surface/route target. Current-authority revalidation, disclosure filtering, guarded navigation, and scoped-link construction remain unchanged.

Close evidence: the product-action disclosure contract and Approval overview tests pass; there is no shortcut bypass or stale-authority fallback.

### 2. Approval form V2 byte golden — closed by cross-runtime provenance

The former frontend file was 6,621 bytes with SHA-256 `ce823a73199ff6db4fc3d6eb53cc6a33c2b18be137dc337f36469cbfac25ac24`. The expected frontend pin was `5867525b45e2eee0d90f9f36d6903f8a03c74561c639a6c5169104b43e55a9a4`.

The committed Java fixture at backend commit `fc8fbfd38103f7fb2b47adaea861e5327450a74e` is 5,101 bytes and has exactly the expected SHA. It was introduced at backend commit `315e1b27708ebee0d9a94deb568d614520094262`. The frontend resource and its expected pin were introduced together at `495b6192605545587685b08fd3c4c716078048e2`; parsed JSON values and schema SHA `0326a781da96bba19de66643543402efd3258b56e90e6ad81c9f57b38a046b7f` already agreed, so the mismatch was formatting bytes rather than schema meaning.

The frontend now contains the exact committed Java bytes and `.prettierignore` protects the byte-pinned fixture from formatter drift. Final frontend and backend SHA-256 values both equal `5867525b45e2eee0d90f9f36d6903f8a03c74561c639a6c5169104b43e55a9a4`.

### 3. Late planning cancellation — closed on typed abort semantics

The stale assertion expected the legacy word `changed`. The hardened HTTP layer intentionally emits `HttpTransportError` with `reason: 'ABORT'`. The planning test now asserts that typed contract and still verifies `busy === false`. No HTTP timeout, response-body, cancellation, retry, or dispatch behavior was weakened.

Close evidence includes `axios-instance`, response-lifecycle, cancellation-race, and the Approval planning controller tests.

### 4. Thirteen unreachable production modules — closed by non-promotion

There was no valid installed production composition for these modules:

- Eight signature-diagnostics UI/model/provider files only referenced one another and had no production route/composition root.
- The backend `SignatureProviderOperation.java` explicitly marks its vocabulary as proposed, not an installed registry or authorization grant. Promoting the UI would therefore fabricate a source/authority claim.
- The proposed retention-receipt client depended on four DATA route keys that were absent from the committed frontend route/auth registry at the required base.
- The separately installed `route.approvals.work.signature-command-receipt.data` client and its real `ApprovalSignatureController` consumer remain intact; they are not the removed proposal.

The exact thirteen production-unreachable files and their eight exclusive test/fixture artifacts were deleted. Git history retains them for a future owner-approved installation. No dummy import, invented route, or reachability allowlist exception was used.

Change size: 25 files, 57 insertions, 4,398 deletions.

## Verification

All material verification ran under the shared `hris-verification` host semaphore.

| Check | Result |
|---|---:|
| Immutable dependency install | PASS |
| Focused Vitest | 7 files, 162/162 PASS |
| Changed TypeScript ESLint | PASS |
| Prettier, including explicit byte-golden protection | PASS |
| Production reachability | 1,703/1,720 reachable; remaining 17 are governed verification roots; 0 production errors |
| Reachability validator unit tests | 5/5 PASS |
| TypeScript `--noEmit` | PASS |
| `architecture:check` | PASS, exit 0 |
| Full Vitest | 692 files, 6,256/6,256 PASS in 147.30s |
| `git diff --check` and post-commit worktree | PASS / clean |

The full suite emitted existing React `act(...)` test-harness warnings on stderr. No test failed; the warnings are disclosed rather than suppressed or counted as positive evidence. An initial combined formatting invocation used an unsupported selector and made no source change; it was discarded as evidence and replaced with direct passing checks.

## Residual boundary

There is no remaining defect in the four assigned Approval baseline items. However, `architecture:check` still reports the pre-existing production-readiness evidence registry as `BLOCKED 0/37` and explicitly treats that stage as schema/integrity-only. External evidence, cross-repository provenance, canonical Gate state, and whole-HRIS module-session START authority remain outside this commit.

Root integration may review and merge `31b42a6311296c4a4fcf28212f076658dce7b19e`, then rerun canonical cross-repository and Gate validation. This report itself does not authorize that transition.
