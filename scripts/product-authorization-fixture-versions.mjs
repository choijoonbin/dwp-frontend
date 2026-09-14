export const EXPECTED_REGISTRY_VERSIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const PRESERVED_AUTHORIZATION_CHECKSUMS = Object.freeze({
  1: 'bc34f47b0ad783d27aa7979f25f75e2fdf29506a12a23c0088f94837abad0b67',
  2: '5b634a35472ef98ecdd5ca9efe7a716020d8f3ae0d8f5025d76bbf072692c12c',
  3: 'f90c4e3a734204a4619ae77d3476ebc7cc802c43ed8574fcf4f3fc85def67a8e',
  4: 'a9cd08260fd9a11dd7c612f2db6f03bb312f1e7843a2eb10b4082660da151137',
  5: 'c69816a06349fcbd45a0d946debfbce1d67e09b3ed87a8b056ec8a43f852109f',
  6: '7cf8602aa2da5f7a0464b23cfd84a8f381e2d3eb85333ed8a8e483865b2b0abe',
  7: 'fe9721ef01164c64e03f8798f89765bdf35e55993cf98ad1f6f9c3611dd8d61a',
  8: '9449a516a2dbd96106e71963cbda764b80d83f0f61fa861d110d85517adac942',
  9: '02b19c4119e560b63d4054ec317fe7e4d694e402a5af03960c63b20db4b41ab7',
  10: '1f97638c95a192f0ec7f01053c3965f79b7a3ee4eb9781ea56e3cf8eccc6889b',
});

const authorizationCounts = (
  capabilities,
  accessPolicies,
  entitlementExpressions,
  predicates,
  routes
) => ({
  capabilities,
  accessPolicies,
  entitlementExpressions,
  predicatePolicies: predicates,
  routes,
});
export const EXPECTED_AUTHORIZATION_COUNTS = Object.freeze({
  1: authorizationCounts(10, 5, 2, 6, 35),
  2: authorizationCounts(34, 6, 3, 13, 76),
  3: authorizationCounts(62, 14, 8, 25, 129),
  4: authorizationCounts(71, 22, 16, 33, 155),
  5: authorizationCounts(72, 22, 16, 33, 160),
  6: authorizationCounts(119, 22, 16, 34, 250),
  7: authorizationCounts(119, 22, 16, 35, 258),
  8: authorizationCounts(123, 22, 16, 38, 275),
  9: authorizationCounts(127, 22, 16, 41, 302),
  10: authorizationCounts(132, 22, 16, 44, 318),
});
