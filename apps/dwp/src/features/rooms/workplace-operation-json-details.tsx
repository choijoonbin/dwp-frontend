import Box from '@mui/material/Box';

export function WorkplaceOperationJsonDetails({
  snapshot,
  label,
}: {
  snapshot: Record<string, unknown>;
  label: string;
}) {
  return (
    <Box component="details" sx={{ mt: 0.75, maxWidth: 520 }}>
      <Box component="summary" sx={{ cursor: 'pointer', color: 'text.secondary', fontSize: 12 }}>
        {label}
      </Box>
      <Box
        component="pre"
        sx={{ m: 0, mt: 1, p: 1, overflow: 'auto', bgcolor: 'action.hover', fontSize: 11 }}
      >
        {JSON.stringify(snapshot, null, 2)}
      </Box>
    </Box>
  );
}
