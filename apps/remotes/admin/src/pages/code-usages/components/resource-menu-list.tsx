// ----------------------------------------------------------------------

import { memo } from 'react';
import { ApiErrorAlert } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';
import ListItem from '@mui/material/ListItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';

// ----------------------------------------------------------------------

type ResourceMenuListProps = {
  resourceKeyOptions: string[];
  selectedResourceKey: string;
  keyword: string;
  isLoading: boolean;
  error: Error | null;
  usagesByResource: Map<string, unknown[]>;
  onResourceSelect: (resourceKey: string) => void;
  onKeywordChange: (keyword: string) => void;
};

export const ResourceMenuList = memo(({
  resourceKeyOptions,
  selectedResourceKey,
  keyword,
  isLoading,
  error,
  usagesByResource,
  onResourceSelect,
  onKeywordChange,
}: ResourceMenuListProps) => {
  // Filter resource keys by keyword
  const filteredResourceKeys = resourceKeyOptions.filter((key) =>
    key.toLowerCase().includes(keyword.toLowerCase())
  );

  if (error) {
    return (
      <Card sx={{ p: 2 }}>
        <ApiErrorAlert error={error} />
      </Card>
    );
  }

  return (
    <Card>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          label="메뉴 검색"
          size="small"
          fullWidth
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          placeholder="resourceKey로 검색..."
        />
      </Box>
      {isLoading ? (
        <Box sx={{ p: 2 }}>
          {Array.from({ length: 5 }).map((_, idx) => (
            <Skeleton key={idx} variant="rectangular" height={60} sx={{ mb: 1, borderRadius: 1 }} />
          ))}
        </Box>
      ) : filteredResourceKeys.length === 0 ? (
        <Box sx={{ p: 3 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            검색 결과가 없습니다.
          </Typography>
        </Box>
      ) : (
        <List sx={{ p: 0 }}>
          {filteredResourceKeys.map((resourceKey) => {
            const groupCount = usagesByResource.get(resourceKey)?.length || 0;
            return (
              <ListItem key={resourceKey} disablePadding>
                <ListItemButton
                  selected={selectedResourceKey === resourceKey}
                  onClick={() => onResourceSelect(resourceKey)}
                >
                  <ListItemText
                    primary={resourceKey}
                    secondary={
                      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                        <Chip label={`${groupCount}개 그룹`} size="small" />
                      </Stack>
                    }
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      )}
    </Card>
  );
});

ResourceMenuList.displayName = 'ResourceMenuList';
