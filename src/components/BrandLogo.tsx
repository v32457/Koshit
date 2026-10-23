import React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  size = 'md',
  showWordmark = true,
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
  };

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Precision Industrial Emblem */}
      <div className={`relative flex items-center justify-center rounded-lg bg-gradient-to-br from-[#0B192C] to-[#1E3E62] p-1.5 shadow-sm border border-[#005691]/40 ${iconSizes[size]}`}>
        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          {/* Outer Precision Ring */}
          <circle cx="20" cy="20" r="17" stroke="#005691" strokeWidth="2" strokeDasharray="3 2" opacity="0.8" />
          
          {/* Interlocking K Shape & Manufacturing Hex Core */}
          <path
            d="M13 10V30M13 20L25 10M17 17L27 30"
            stroke="#FFFFFF"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Flame Orange Energy Accent (Kosh Precision & Automotive Tubing) */}
          <circle cx="27" cy="11" r="3.2" fill="#E85C0D" />
          <path d="M22 28L28 28" stroke="#E85C0D" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>

      {showWordmark && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-black tracking-wider text-white uppercase">KOSH</span>
            <span className="text-xs font-bold tracking-widest text-[#E85C0D] uppercase px-1.5 py-0.5 rounded bg-orange-50 border border-orange-200">
              INNOVATIONS
            </span>
          </div>
          <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase mt-0.5">
            Global Master Governance
          </span>
        </div>
      )}
    </div>
  );
};
