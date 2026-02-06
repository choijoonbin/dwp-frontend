/**
 * CodeSelectCombobox — 검색형 코드 Select (케이스 상태 등)
 *
 * - 검색 필터링
 * - Pinned(자주 쓰는) 옵션 상단 고정
 * - maxHeight 제한으로 드롭다운 높이 고정
 * - 키보드 네비게이션 (MUI Autocomplete 기본 지원)
 *
 * @see docs/job/CASE_STATUS_SELECT_UX_SPEC_AND_FE_PROMPT.txt
 */

import type { SyntheticEvent } from 'react';
import type { AutocompleteRenderGroupParams } from '@mui/material/Autocomplete';

import TextField from '@mui/material/TextField';
import { useTheme } from '@mui/material/styles';
import Autocomplete from '@mui/material/Autocomplete';
import ListSubheader from '@mui/material/ListSubheader';

// ----------------------------------------------------------------------

export type CodeSelectOption = {
  value: string;
  label: string;
  pinned?: boolean;
};

export type CodeSelectComboboxProps = {
  options: CodeSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  /** 상단 고정할 옵션 수 (pinned=true인 것) */
  maxPinned?: number;
  /** 드롭다운 최대 높이 (px) */
  maxListHeight?: number;
  /** 검색 비활성화 시 일반 Select처럼 동작 */
  disableSearch?: boolean;
  /** 빈 값 라벨 (전체 등) */
  emptyLabel?: string;
  /** Pinned 섹션 헤더 (예: "자주 쓰는 상태") */
  pinnedGroupLabel?: string;
  /** 전체 옵션 섹션 헤더 (예: "All statuses") */
  allGroupLabel?: string;
  size?: 'small' | 'medium';
  disabled?: boolean;
  sx?: object;
};

const GROUP_PINNED = '\u0000pinned';
const GROUP_ALL = '\u0000all';
const GROUP_EMPTY = '\u0000empty';

// ----------------------------------------------------------------------

export const CodeSelectCombobox = ({
  options,
  value,
  onChange,
  placeholder = '검색...',
  label,
  maxPinned = 7,
  maxListHeight = 300,
  disableSearch = false,
  emptyLabel,
  pinnedGroupLabel,
  allGroupLabel,
  size = 'small',
  disabled = false,
  sx,
}: CodeSelectComboboxProps) => {
  const theme = useTheme();

  const pinnedSet = new Set(
    options
      .filter((o) => o.pinned)
      .slice(0, maxPinned)
      .map((o) => o.value)
  );

  const withPinned: CodeSelectOption[] = options.map((opt) => ({
    ...opt,
    pinned: pinnedSet.has(opt.value),
  }));

  const sortedOptions: CodeSelectOption[] = [
    ...(emptyLabel ? [{ value: '', label: emptyLabel, pinned: false }] : []),
    ...withPinned.filter((o) => o.pinned),
    ...withPinned.filter((o) => !o.pinned),
  ];

  const selectedOption = value
    ? sortedOptions.find((o) => o.value === value) ?? { value, label: value, pinned: false }
    : emptyLabel
      ? { value: '', label: emptyLabel, pinned: false }
      : null;

  const handleChange = (_event: SyntheticEvent, newValue: CodeSelectOption | null) => {
    onChange(newValue?.value ?? '');
  };

  const filterOptions = (opts: CodeSelectOption[], state: { inputValue: string }) => {
    if (disableSearch || !state.inputValue.trim()) return opts;
    const q = state.inputValue.trim().toLowerCase();
    const filtered = opts.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
    const pinned = filtered.filter((o) => o.pinned);
    const rest = filtered.filter((o) => !o.pinned);
    return [...pinned, ...rest];
  };

  const groupBy = (option: CodeSelectOption) => {
    if (option.value === '') return GROUP_EMPTY;
    return option.pinned ? GROUP_PINNED : GROUP_ALL;
  };

  const renderGroup = (params: AutocompleteRenderGroupParams) => {
    const { group, key, children } = params;
    const header =
      group === GROUP_PINNED && pinnedGroupLabel
        ? pinnedGroupLabel
        : group === GROUP_ALL && allGroupLabel
          ? allGroupLabel
          : null;

    return (
      <li key={key}>
        {header && (
          <ListSubheader
            component="div"
            sx={{
              lineHeight: 2,
              fontSize: '0.75rem',
              color: 'text.secondary',
              bgcolor: theme.palette.mode === 'dark' ? 'action.hover' : 'grey.100',
            }}
          >
            {header}
          </ListSubheader>
        )}
        <ul style={{ padding: 0, listStyle: 'none' }}>{children}</ul>
      </li>
    );
  };

  return (
    <Autocomplete<CodeSelectOption>
      value={selectedOption}
      onChange={handleChange}
      options={sortedOptions}
      groupBy={groupBy}
      getOptionLabel={(option) => (typeof option === 'string' ? option : option.label)}
      isOptionEqualToValue={(option, val) => option.value === val?.value}
      disabled={disabled}
      size={size}
      sx={{ minWidth: 140, ...sx }}
      ListboxProps={{
        sx: { maxHeight: maxListHeight },
      }}
      filterOptions={filterOptions}
      filterSelectedOptions={false}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={disableSearch ? undefined : placeholder}
          size={size}
        />
      )}
      renderGroup={renderGroup}
      blurOnSelect
      handleHomeEndKeys
    />
  );
};
