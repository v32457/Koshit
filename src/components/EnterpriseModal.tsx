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
      <div className={`${isMaximized ? `fixed inset-0 ${zIndexClass} w-full h-full` : `fixed inset-0 bg-slate-900/70 backdrop-blur-xs ${zIndexClass} flex items-center justify-center p-3 sm:p-5 overflow-y-auto`} ${isMinimized ? 'hidden' : ''}`}>
        <div className={`bg-white rounded-2xl border border-slate-200 shadow-2xl ${isMaximized ? 'w-full h-full rounded-none' : 'max-w-7xl w-full max-h-[94vh]'} flex flex-col overflow-hidden`}>
          {/* Header */}
          <div className="p-4 bg-[#0B192C] text-white flex items-center justify-between border-b border-slate-800 shrink-0">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Box className="w-4 h-4 text-indigo-400" />
                {title}
              </h3>
              {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2">
              {onToggleMinimize && (
                <button
                  onClick={onToggleMinimize}
                  title="Minimize Modal"
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer transition"
                >
                  <Minus className="w-4 h-4" />
                </button>
              )}
              {onToggleMaximize && (
                <button
                  onClick={onToggleMaximize}
                  title={isMaximized ? 'Restore Modal' : 'Maximize Modal'}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer transition"
                >
                  {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              )}
              <button
                onClick={onClose}
                title="Close Modal"
                className="text-slate-400 hover:text-rose-400 p-1 rounded-lg hover:bg-slate-800 cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          {/* Content */}
          <div className="p-5 overflow-y-auto flex-1 text-xs">
            {children}
          </div>
        </div>
      </div>
      {isMinimized && (
        <div className="fixed bottom-4 right-4 z-50 bg-[#0B192C] text-white p-3 rounded-lg shadow-2xl flex items-center gap-3 border border-slate-700 animate-bounce-short">
          <span className="text-xs font-bold">{title} (Minimized)</span>
          <button onClick={onToggleMinimize} className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-bold cursor-pointer transition">
            Restore
          </button>
        </div>
      )}
    </>
  );
};
