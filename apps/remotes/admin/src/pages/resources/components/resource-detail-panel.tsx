// ----------------------------------------------------------------------

import type { ResourceNode } from '@dwp-frontend/shared-utils';

import { EmptyState } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

type ResourceDetailPanelProps = {
  resource: ResourceNode | null;
};

export const ResourceDetailPanel = ({ resource }: ResourceDetailPanelProps) => {
  if (!resource) {
    return (
      <Card
        sx={{
          width: 1,
          height: '100%',
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <EmptyState
          icon="material-symbols:folder-off-outline"
          title="리소스를 선택하세요"
          description="좌측 목록에서 리소스를 선택하면 상세 정보가 표시됩니다."
        />
      </Card>
    );
  }

  return (
    <Card
      sx={{
        width: 1,
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
      }}
    >
      <Box sx={{ p: 3 }}>
        <Stack spacing={3}>
          {/* Header */}
          <Stack spacing={1}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="h5">{resource.resourceName}</Typography>
              <Chip
                label={resource.resourceType}
                size="small"
                color={resource.resourceType === 'MENU' ? 'primary' : 'secondary'}
              />
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {resource.resourceKey}
            </Typography>
          </Stack>

          <Divider />

          {/* Details */}
          <Stack spacing={2}>
            <DetailRow label="리소스 키" value={resource.resourceKey} />
            <DetailRow label="리소스 이름" value={resource.resourceName} />
            <DetailRow label="리소스 타입" value={resource.resourceType} />
            {resource.path && (
              <DetailRow label="경로" value={resource.path} />
            )}
            {resource.parentId && (
              <DetailRow label="부모 ID" value={resource.parentId} />
            )}
            <DetailRow 
              label="정렬 순서" 
              value={resource.sortOrder !== undefined && resource.sortOrder !== null ? String(resource.sortOrder) : '-'} 
            />
            <DetailRow 
              label="상태" 
              value={resource.enabled ? '활성' : '비활성'} 
              valueColor={resource.enabled ? 'success.main' : 'text.disabled'}
            />
            {resource.trackingEnabled !== undefined && (
              <DetailRow 
                label="이벤트 추적" 
                value={resource.trackingEnabled ? '활성' : '비활성'} 
              />
            )}
            {resource.eventActions && resource.eventActions.length > 0 && (
              <Stack direction="row" spacing={2}>
                <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 100 }}>
                  이벤트 액션
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                  {resource.eventActions.map((action) => (
                    <Chip key={action} label={action} size="small" variant="outlined" />
                  ))}
                </Stack>
              </Stack>
            )}
            <DetailRow label="생성일" value={new Date(resource.createdAt).toLocaleString('ko-KR')} />
          </Stack>

          {/* Children */}
          {resource.children && resource.children.length > 0 && (
            <>
              <Divider />
              <Stack spacing={1}>
                <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
                  하위 리소스 ({resource.children.length}개)
                </Typography>
                <Stack spacing={0.5}>
                  {resource.children.map((child) => (
                    <Chip
                      key={child.id}
                      label={child.resourceName}
                      size="small"
                      variant="outlined"
                      sx={{ width: 'fit-content' }}
                    />
                  ))}
                </Stack>
              </Stack>
            </>
          )}
        </Stack>
      </Box>
    </Card>
  );
};

// ----------------------------------------------------------------------

type DetailRowProps = {
  label: string;
  value: string;
  valueColor?: string;
};

const DetailRow = ({ label, value, valueColor }: DetailRowProps) => (
  <Stack direction="row" spacing={2}>
    <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 100 }}>
      {label}
    </Typography>
    <Typography variant="body2" sx={{ color: valueColor || 'text.primary', wordBreak: 'break-all' }}>
      {value}
    </Typography>
  </Stack>
);
