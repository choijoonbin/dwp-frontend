// ----------------------------------------------------------------------

import { memo } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { ApiErrorAlert } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Skeleton from '@mui/material/Skeleton';
import ListItem from '@mui/material/ListItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ListItemButton from '@mui/material/ListItemButton';
import InputAdornment from '@mui/material/InputAdornment';

// ----------------------------------------------------------------------

export type ResourceOption = {
  resourceKey: string;
  resourceName: string;
  resourceType: 'MENU' | 'UI';
};

type ResourceMenuListProps = {
  resourceOptions: ResourceOption[];
  selectedResourceKey: string;
  keyword: string;
  isLoading: boolean;
  error: Error | null;
  usagesByResource: Map<string, unknown[]>;
  onResourceSelect: (resourceKey: string) => void;
  onKeywordChange: (keyword: string) => void;
};

export const ResourceMenuList = memo(({
  resourceOptions,
  selectedResourceKey,
  keyword,
  isLoading,
  error,
  usagesByResource,
  onResourceSelect,
  onKeywordChange,
}: ResourceMenuListProps) => {
  // Filter resources by keyword (name or key)
  const filteredResources = resourceOptions.filter(
    (r) =>
      !keyword ||
      r.resourceName.toLowerCase().includes(keyword.toLowerCase()) ||
      r.resourceKey.toLowerCase().includes(keyword.toLowerCase())
  );

  if (error) {
    return (
      <Card sx={{ p: 2, height: '100%' }}>
        <ApiErrorAlert error={error} />
      </Card>
    );
  }

  return (
    <Card sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Stack spacing={1}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            리소스 선택
          </Typography>
          <TextField
            label="리소스 검색"
            size="small"
            fullWidth
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            placeholder="리소스 키 또는 이름 검색"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Iconify icon="solar:magnifer-bold" width={16} />
                </InputAdornment>
              ),
            }}
          />
        </Stack>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {isLoading ? (
          <Box sx={{ p: 2 }}>
            {Array.from({ length: 5 }).map((_, idx) => (
              <Skeleton key={idx} variant="rectangular" height={60} sx={{ mb: 1, borderRadius: 1 }} />
            ))}
          </Box>
        ) : filteredResources.length === 0 ? (
          <Box sx={{ p: 3 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              검색 결과가 없습니다.
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {filteredResources.map((resource) => {
              const mappingCount = usagesByResource.get(resource.resourceKey)?.length || 0;
              const isSelected = selectedResourceKey === resource.resourceKey;
              const isMenu = resource.resourceType === 'MENU';
              return (
                <ListItem key={resource.resourceKey} disablePadding>
                  <ListItemButton
                    selected={isSelected}
                    onClick={() => onResourceSelect(resource.resourceKey)}
                    sx={{
                      py: 1.5,
                      px: 2,
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 0.5,
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ width: 1 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: (theme) =>
                            isMenu
                              ? alpha(theme.palette.primary.main, 0.12)
                              : alpha(theme.palette.warning.main, 0.12),
                          color: isMenu ? 'primary.main' : 'warning.main',
                          flexShrink: 0,
                        }}
                      >
                        <Iconify
                          icon={isMenu ? 'solar:hamburger-menu-bold' : 'solar:widget-bold'}
                          width={18}
                        />
                      </Box>
                      <Stack sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              color: isSelected ? 'primary.main' : 'text.primary',
                            }}
                            noWrap
                          >
                            {resource.resourceName}
                          </Typography>
                          <Chip
                            label={resource.resourceType}
                            size="small"
                            variant="outlined"
                            sx={{
                              height: 20,
                              fontSize: 10,
                              borderColor: isMenu ? 'primary.main' : 'warning.main',
                              color: isMenu ? 'primary.main' : 'warning.main',
                            }}
                          />
                        </Stack>
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'text.secondary',
                            fontFamily: 'monospace',
                            mt: 0.25,
                          }}
                          noWrap
                        >
                          {resource.resourceKey}
                        </Typography>
                        <Chip
                          label={`${mappingCount}개 매핑`}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: 10,
                            mt: 0.5,
                            alignSelf: 'flex-start',
                            bgcolor: 'action.hover',
                          }}
                        />
                      </Stack>
                    </Stack>
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        )}
      </Box>
    </Card>
  );
});

ResourceMenuList.displayName = 'ResourceMenuList';
