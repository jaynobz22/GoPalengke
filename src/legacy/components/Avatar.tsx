// @ts-nocheck
interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}

export function Avatar({ src, name, size = 40, className = '' }: AvatarProps) {
  const initial = name?.[0]?.toUpperCase() || '?';
  const dimensionClass = `w-[${size}px] h-[${size}px]`;

  if (src) {
    return (
      <img
        src={src}
        alt={name || 'Avatar'}
        className={`rounded-full object-cover flex-shrink-0 ${dimensionClass} ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-600 flex-shrink-0 ${dimensionClass} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </div>
  );
}
