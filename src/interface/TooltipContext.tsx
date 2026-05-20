import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import CustomTooltip from './CustomTooltip';

interface TooltipContextType {
  showTooltip: (content: string, x: number, y: number) => void;
  hideTooltip: () => void;
}

const TooltipContext = createContext<TooltipContextType | undefined>(
  undefined,
);

interface TooltipProviderProps {
  children: ReactNode;
}

export const TooltipProvider: React.FC<TooltipProviderProps> = ({
  children,
}) => {
  const [tooltip, setTooltip] = useState<{
    content: string;
    x: number;
    y: number;
  } | null>(null);

  const showTooltip = useCallback((content: string, x: number, y: number) => {
    setTooltip({ content, x, y });
  }, []);

  const hideTooltip = useCallback(() => {
    setTooltip(null);
  }, []);

  return (
    <TooltipContext.Provider value={{ showTooltip, hideTooltip }}>
      {children}
      {tooltip && (
        <CustomTooltip
          content={tooltip.content}
          position={{ x: tooltip.x, y: tooltip.y }}
          onClose={hideTooltip}
        />
      )}
    </TooltipContext.Provider>
  );
};

export const useTooltipContext = () => {
  const context = useContext(TooltipContext);
  if (!context) {
    throw new Error(
      'useTooltipContext must be used within a TooltipProvider',
    );
  }
  return context;
};
