import React, { useRef, useEffect } from 'react';

interface TooltipProps {
  content: string;
  position: { x: number; y: number };
  onClose: () => void;
}

const Tooltip: React.FC<TooltipProps> = ({ content, position, onClose }) => {
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  useEffect(() => {
    // 替换 wow.zamimg.com 为 wsrv.nl 代理，确保图片国内可访问
    const processedContent = content
      .replaceAll(
        'https://wow.zamimg.com',
        'https://wsrv.nl/?url=https://wow.zamimg.com',
      )
      .replaceAll(
        'https://images.wowhead.com',
        'https://wsrv.nl/?url=https://images.wowhead.com',
      );

    if (tooltipRef.current) {
      tooltipRef.current.innerHTML = processedContent;
    }
  }, [content]);

  return (
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 99999,
        background: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '4px',
        padding: '10px',
        maxWidth: '400px',
        color: '#fff',
        fontSize: '12px',
        lineHeight: '1.4',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      }}
    />
  );
};

export default Tooltip;
