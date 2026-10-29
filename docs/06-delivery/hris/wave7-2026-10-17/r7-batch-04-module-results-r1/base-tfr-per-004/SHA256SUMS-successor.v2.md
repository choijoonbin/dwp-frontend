# BASE-TFR-PER-004 successor v2 SHA-256 manifest

This append-only manifest supersedes `SHA256SUMS.md` for the source/test carriers below. Hashes are SHA-256 of file bytes, not Git object IDs. Repository-relative paths are qualified by the BE or FE column. The prior manifest remains historical.

BE source/test commit `e709c080661e1ffcdba5e1e89c28ea49557cf50d`, tree `7076a081410fcf10cd4c6d5ece9ed3a882de1af4`; FE source/test commit `cb07c4b922fd5376b3b19aa9d880976c2991aa2e`, tree `acf070553a455eb2e3cb7c5c325b01c41d265965`. Both source/test branch heads were checked against `origin` and locally clean before this evidence-only successor.

## BE — `dwp-people-server/src/main/java/com/dwp/services/people/hris/performance/per004/`

| SHA-256                                                            | File                                |
| ------------------------------------------------------------------ | ----------------------------------- |
| `a3c76af569fe56c5428f5df6846ddbcae69900a2723d9a25ea481c0f15cc700f` | `JdbcPer004ProofReplayStore.java`   |
| `2281b03726da1af317a435c19cdb776161503f7e845fb392e75cf628b3d8aa93` | `Per004ActionSelector.java`         |
| `860648138fee9afd2e49864d8e0910893699e3c0c77d872b8e9c9bcda5e6274c` | `Per004ArtifactProtection.java`     |
| `2e600986d09d422bd90c077a66f53c6551e28f0d6067574685692e58d96e91aa` | `Per004OwnerService.java`           |
| `dcf80cc831ef225adf900739c5677a13d3ec17168809d7a5cecdc6eefcf76a63` | `Per004PayloadCodec.java`           |
| `e00866aed679b3972b6bbc7ec3990fa8d47f862b13c7f2b391c3f21bb23ac68d` | `Per004PlatformInternalClient.java` |
| `d79d7ff378929f27338142cc65a7dbf983c17ea5b175e924ed85a7c5a6b36c95` | `Per004PreparationRecovery.java`    |
| `4a1ca8c69ad498c8628255178b41cb24ecdf815372ab035796d68280d0a51a71` | `Per004WorkbenchController.java`    |
| `65e4d74782346dd6ed3aacb11150aebafdee87609a2d0f18f9fe7fa7cb2f1ff3` | `Per004WorkbenchProjection.java`    |
| `8bae877fd42c4953b57b8ae9ddb8d1d1577fc4a94c50f23ab41dfef70df661cd` | `Per004WorkloadEndpoints.java`      |

## BE — `dwp-people-server/src/test/java/com/dwp/services/people/hris/performance/per004/`

| SHA-256                                                            | File                                          |
| ------------------------------------------------------------------ | --------------------------------------------- |
| `ab1433454c57966068ce2d08216689d2e7dcda647e69d3e8f8dbc7a9e189a6f1` | `JdbcPer004ProofReplayStorePostgresTest.java` |
| `f5cbbc3cf9867480e6aa67350bab33c9b96977513efc3b85a705fde860a612bc` | `Per004ActionSelectorTest.java`               |
| `1e6977b35773a8bf4acc32429d0987343dd54ff79b2074288637372a6bf5faf6` | `Per004MigrationContractTest.java`            |
| `f3915120dc49d3f3f2480bb1458ec63660a383da0f2fc57dfe4c93670edff167` | `Per004OwnerPostgresTest.java`                |
| `8d6616bd9cca777cf469f682951b16416a5346e1a7fe12c784e2533b0198a700` | `Per004PayloadCodecTest.java`                 |
| `b3cf1b68a348b30e8aaa44d19da2da7a608a5b7359eaf48e11f446e391fc464a` | `Per004PlatformInternalClientTest.java`       |
| `d788e313a244c69e8f1a7aebbefc66fc4cf1a9ebff9e4b559103780f6fa446b3` | `Per004TransactionProxyTest.java`             |
| `ca8078e5400aeed6b2ae68b27a2426aaa8c58ec4a78b4033a03829e58ece3054` | `Per004WorkbenchProjectionTest.java`          |
| `61ddbb768ceecca8a68dc50b96a9cde8aa2d8dca01382abae851e6b17c0d6ad6` | `Per004WorkloadEndpointsTest.java`            |

## BE migration

| SHA-256                                                            | File                                                                                          |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `b6ceb78d2446adabebd6a204b10552bd1cd3252df80f4172733e2df156550156` | `dwp-people-server/src/main/resources/db/performance-migration/V19__per_base_tfr_per_004.sql` |

## FE — `apps/dwp/src/features/hris/performance/configuration/` unless noted

| SHA-256                                                            | File                                                                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `15963d92e075a24d1f57dbc29bd45d90db281e2646288c2e6c6fe9769060c3c3` | `apps/dwp/src/features/hris/performance/__tests__/g3-slices/base-tfr-per-004.slice.test.tsx` |
| `8bf42efebf3cccf08af09f3d5be49097adda99c57cd9e7b6274136a30abf3287` | `per004-browser-client.test.ts`                                                              |
| `e18ef289edb4fcd0082c14872319db2fa84af2ebcd10e6e2514dd8f7bab6ba79` | `per004-browser-client.ts`                                                                   |
| `cfff008e623b3e84e890ec0b71b3a3b4c4179ffcac1143651a1b2d77758c595a` | `per004-contract.test.ts`                                                                    |
| `592bab8764b19d1e1da28acf36a1f3e2eda26a52d7b91ba43dec7ff7913a8dc5` | `per004-contract.ts`                                                                         |
| `161a6719b828bf693571f20a4c311c2bc5e5defa90b4b0ba462be15349daec30` | `per004-visual-qa.test.tsx`                                                                  |
| `25295576dfc710b0f8f76067cc15d9b0e72b6b0412d2d25fce9564b94c40fa16` | `per004-workspace.css`                                                                       |
| `0c80f439a006395c39656bdac37ec11edb0213f2cacb57d9efc75052dd62dec5` | `per004-workspace.tsx`                                                                       |

## Existing visual audit (not rerun for successor)

| SHA-256                                                            | Artifact                                                                                                                                                        |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `453e8ed1707ece9d62a179f86a8a320dd3480a44dfc37e1031dd63468d1a94f4` | FE `docs/06-delivery/hris/wave7-2026-10-17/r7-batch-04-module-results-r1/base-tfr-per-004/visual/viewport-audit.json`                                           |
| `4546289e908a52ffb259729950c85da14e673f1593d3160b38705fd6d9576d53` | Aggregate SHA-256 of 23 sorted screenshot-hash lines as one newline-terminated stream, as recorded by the previous evidence; no PNG was changed or regenerated. |
