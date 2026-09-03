import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  /** CTA 解析中：金→紫扫描态（motion.css） */
  analyzing?: boolean;
  small?: boolean;
}

export function Button({
  variant = 'primary',
  analyzing = false,
  small = false,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const cls = ['btn', `btn-${variant}`, analyzing && 'is-analyzing', small && 'btn-sm', className]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={cls} {...rest} />;
}
