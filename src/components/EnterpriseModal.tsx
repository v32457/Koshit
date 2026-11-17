import React from 'react';
import { X, Box, Minus, Square, Maximize2, Minimize2 } from 'lucide-react';

interface EnterpriseModalProps {
  title: string;
  subtitle?: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
  zIndexClass?: string;
}

export const EnterpriseModal: React.FC<EnterpriseModalProps> = ({
  title,
  subtitle,
  isOpen,
  onClose,
  children,
  isMaximized,
  onToggleMaximize,
  isMinimized,
  onToggleMinimize,
  zIndexClass = 'z-50',
}) => {
  if (!isOpen) return null;

  return (
    <>
      <div
        className={`${
          isMaximized
            ? `fixed inset-0 ${zIndexClass} w-full h-full`
            : `fixed inset-0 bg-slate-900/70 backdrop-blur-xs ${zIndexClass} flex items-center justify-center p-0 sm:p-3 lg:p-5 overflow-y-auto overflow-x-hidden`
        } ${isMinimized ? 'hidden' : ''}`}
      >
        <div
          className={`bg-white border border-slate-200 shadow-2xl ${
            isMaximized
              ? 'w-full h-full rounded-none'
              : 'w-full h-full sm:h-auto sm:max-h-[94vh] sm:max-w-[96vw] xl:max-w-[92vw] rounded-none sm:rounded-2xl'
          } flex flex-col overflow-hidden min-w-0 max-w-full`}
        >
          {/* Header */}
          <div className="p-3 sm:p-4 bg-[#0B192C] text-white flex items-center justify-between gap-2 border-b border-slate-800 shrink-0 min-w-0">
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-bold flex items-center gap-2 truncate">
                <Box className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="truncate">{title}</span>
              </h3>
              {subtitle && (
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {onToggleMinimize && (
                <button
                  type="button"
                  onClick={onToggleMinimize}
                  title="Minimize Modal"
                  className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer transition"
                >
                  <Minus className="w-4 h-4" />
                </button>
              )}
              {onToggleMaximize && (
                <button
                  type="button"
                  onClick={onToggleMaximize}
                  title={isMaximized ? 'Restore Modal' : 'Maximize Modal'}
                  className="hidden sm:inline-flex text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer transition"
                >
                  {isMaximized ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                title="Close Modal"
                aria-label="Close Modal"
                className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          {/* Content */}
          <div className="p-3 sm:p-5 overflow-y-auto overflow-x-hidden flex-1 text-xs min-w-0">
            {children}
          </div>
        </div>
      </div>
      {isMinimized && (
        <div className="fixed bottom-4 right-4 z-50 bg-[#0B192C] text-white p-3 rounded-lg shadow-2xl flex items-center gap-3 border border-slate-700 animate-bounce-short">
          <span className="text-xs font-bold">{title} (Minimized)</span>
          <button
            type="button"
            onClick={onToggleMinimize}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-bold cursor-pointer transition"
          >
            Restore
          </button>
        </div>
      )}
    </>
  );
};
