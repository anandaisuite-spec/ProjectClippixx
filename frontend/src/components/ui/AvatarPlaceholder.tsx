interface AvatarPlaceholderProps {
  name: string;
  /** Optional avatar image URL. When present (and it loads) the image is shown;
   *  otherwise a generated initials circle is rendered. Uploads are currently
   *  disabled, so this is usually empty — but keeping it makes the component a
   *  drop-in replacement and future-proof if Storage is re-enabled. */
  src?: string | null;
  size?: number;
  /** Extra classes applied to the outer element (e.g. ring, shadow, margin). */
  className?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getColorFromName(name: string): string {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function AvatarPlaceholder({ name, src, size = 40, className = '' }: AvatarPlaceholderProps) {
  const safeName = name || 'User';

  if (src) {
    return (
      <img
        src={src}
        alt={safeName}
        className={className}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
      />
    );
  }

  const initials = getInitials(safeName);
  const bgColor = getColorFromName(safeName);

  return (
    <div
      className={className}
      aria-label={safeName}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: bgColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: 600,
        fontSize: size * 0.4,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}
