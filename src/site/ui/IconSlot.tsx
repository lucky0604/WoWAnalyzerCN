import { iconUrl } from 'interface/Icon';
import sparkleUrl from 'site/ui/sparkle.svg';

interface IconSlotProps {
  /** WoW 图标名（iconUrl 语义）；缺省时渲染占位星芒，等待素材补充 */
  icon?: string;
  size?: 32 | 40 | 48;
  alt?: string;
  className?: string;
}

/** 32–48px 方形游戏图标槽（4px 圆角 + 金描边暗底） */
export function IconSlot({ icon, size = 40, alt = '', className }: IconSlotProps) {
  return (
    <span className={`icon-slot icon-slot--${size} ${className ?? ''}`} title={alt || undefined}>
      {icon ? (
        <img src={iconUrl(icon)} alt={alt} loading="lazy" />
      ) : (
        <img src={sparkleUrl} alt="" style={{ opacity: 0.45 }} />
      )}
    </span>
  );
}
