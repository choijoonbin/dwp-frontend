import Avatar from '@mui/material/Avatar';

const avatarColors = [
  { background: '#E8F0FE', foreground: '#1D4ED8' },
  { background: '#E4F4EF', foreground: '#087A68' },
  { background: '#FCE8EC', foreground: '#B42345' },
  { background: '#F5ECD9', foreground: '#8A5A00' },
  { background: '#EEE9FA', foreground: '#6842A8' },
  { background: '#E8EEF2', foreground: '#35546A' },
] as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts.at(-1)?.[0] ?? ''}`.toUpperCase();
}

function colorIndex(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash % avatarColors.length;
}

export function PersonAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const colors = avatarColors[colorIndex(name)];
  return (
    <Avatar
      aria-hidden="true"
      sx={{
        width: size,
        height: size,
        bgcolor: colors.background,
        color: colors.foreground,
        fontSize: size <= 32 ? 11 : 13,
        fontWeight: 750,
        border: '1px solid',
        borderColor: 'rgba(15, 23, 42, 0.08)',
      }}
    >
      {initials(name)}
    </Avatar>
  );
}
