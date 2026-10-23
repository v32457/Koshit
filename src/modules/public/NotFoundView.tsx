import React from 'react';
import { AlertTriangle, Home, ArrowLeft } from 'lucide-react';
import { BrandLogo } from '../../components/BrandLogo';

interface NotFoundViewProps {
  onNavigateHome: () => void;
  onNavigateDashboard: () => void;
  isAuthenticated: boolean;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({
  onNavigateHome,
  onNavigateDashboard,
  isAuthenticated,
}) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-[#0B192C] border border-slate-800 p-8 rounded-3xl max-w-md w-full space-y-5 shadow-2xl">
        <div className="p-3 bg-rose-950 border border-rose-800 text-rose-400 rounded-2xl w-fit mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div>
          <span className="text-3xl font-extrabold text-white font-mono">404</span>
          <h1 className="text-lg font-bold text-white mt-1">Page Not Found</h1>
          <p className="text-xs text-slate-400 mt-2">
            The requested application route does not exist or has been moved.
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          {isAuthenticated ? (
            <button
              onClick={onNavigateDashboard}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              <span>Return to Corporate Dashboard</span>
            </button>
          ) : (
            <button
              onClick={onNavigateHome}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Public Landing Page</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
