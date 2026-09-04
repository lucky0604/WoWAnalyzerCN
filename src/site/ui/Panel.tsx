import type { HTMLAttributes } from 'react';

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  /** 角饰：仅重要面板使用（左上 / 右下 金色托架） */
  corners?: boolean;
  sunken?: boolean;
}

export function Panel({ corners, sunken, className, ...rest }: PanelProps) {
  const cls = ['panel', corners && 'panel--corners', sunken && 'panel--sunken', className]
    .filter(Boolean)
    .join(' ');
  return <div className={cls} {...rest} />;
}
