import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Filter, X, RotateCcw, Check } from 'lucide-react';

export type DeviceTier =
  | 'large-desktop'     // 1440px+
  | 'desktop'           // 1024-1439px
  | 'tablet-landscape'  // 768-1023px (or landscape tablet)
  | 'tablet-portrait'   // 600-767px
  | 'mobile'            // 360-599px
  | 'small-mobile';     // < 360px

export interface ViewportOrientationState {
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
  deviceTier: DeviceTier;
  isDesktop: boolean;
  isTablet: boolean;
  isMobile: boolean;
  isMobileLandscape: boolean;
  isTabletLandscape: boolean;
}

function computeViewportState(): ViewportOrientationState {
  if (typeof window === 'undefined') {
    return {
      width: 1440,
      height: 900,
      orientation: 'landscape',
      deviceTier: 'large-desktop',
      isDesktop: true,
      isTablet: false,
      isMobile: false,
      isMobileLandscape: false,
      isTabletLandscape: false,
    };
  }

  const width = window.innerWidth || document.documentElement.clientWidth || 1440;
  const height = window.innerHeight || document.documentElement.clientHeight || 900;
  const orientation: 'portrait' | 'landscape' = width >= height ? 'landscape' : 'portrait';

  // Detect mobile landscape (e.g. 844x390, 932x430) where width is 600..960 but height is compact (< 520px)
  const isMobileLandscape = orientation === 'landscape' && height <= 520 && width < 1024;

  let deviceTier: DeviceTier;
  if (width >= 1440) {
    deviceTier = 'large-desktop';
  } else if (width >= 1024) {
    deviceTier = 'desktop';
  } else if (isMobileLandscape) {
    deviceTier = 'mobile';
  } else if (width >= 768) {
    deviceTier = 'tablet-landscape';
  } else if (width >= 600) {
    deviceTier = 'tablet-portrait';
  } else if (width >= 360) {
    deviceTier = 'mobile';
  } else {
    deviceTier = 'small-mobile';
  }

  const isDesktop = width >= 1024;
  const isMobile = width < 768 || isMobileLandscape;
  const isTablet = !isDesktop && !isMobile;
  const isTabletLandscape = isTablet && orientation === 'landscape';

  return {
    width,
    height,
    orientation,
    deviceTier,
    isDesktop,
    isTablet,
    isMobile,
    isMobileLandscape,
    isTabletLandscape,
  };
}

/**
 * Automatic viewport & device orientation adaptation hook.
 * Listens to window resize, matchMedia orientation changes, and Screen Orientation API
 * without reloading the page or losing component state.
 */
export function useViewportAndOrientation(): ViewportOrientationState {
  const [state, setState] = useState<ViewportOrientationState>(() => computeViewportState());

  useEffect(() => {
    let rafId: number | null = null;
    const handleUpdate = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setState(computeViewportState());
      });
    };

    window.addEventListener('resize', handleUpdate);
    window.addEventListener('orientationchange', handleUpdate);

    let mql: MediaQueryList | null = null;
    if (typeof window.matchMedia === 'function') {
      mql = window.matchMedia('(orientation: landscape)');
      if (mql.addEventListener) {
        mql.addEventListener('change', handleUpdate);
      }
    }

    if (typeof window.screen !== 'undefined' && window.screen.orientation?.addEventListener) {
      window.screen.orientation.addEventListener('change', handleUpdate);
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('orientationchange', handleUpdate);
      if (mql?.removeEventListener) {
        mql.removeEventListener('change', handleUpdate);
      }
      if (typeof window.screen !== 'undefined' && window.screen.orientation?.removeEventListener) {
        window.screen.orientation.removeEventListener('change', handleUpdate);
      }
    };
  }, []);

  return state;
}

/**
 * Full-width enterprise page container with zero horizontal overflow.
 */
export const ResponsivePageContainer: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <div className={`w-full max-w-none min-w-0 m-0 space-y-4 ${className}`}>
      {children}
    </div>
  );
};

/**
 * Orientation-aware KPI Grid:
 * - Desktop: 4 columns
 * - Tablet Landscape / Mobile Landscape: 2-4 columns
 * - Tablet Portrait / Mobile Portrait: 1-2 columns
 */
export const ResponsiveKPIGrid: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  const { isMobileLandscape, width } = useViewportAndOrientation();
  const gridColsClass = isMobileLandscape
    ? 'grid-cols-2 sm:grid-cols-4'
    : width < 380
    ? 'grid-cols-1'
    : 'grid-cols-2 lg:grid-cols-4';

  return (
    <div className={`grid ${gridColsClass} gap-3 w-full min-w-0 ${className}`}>
      {children}
    </div>
  );
};

export interface MobileRecordCardField {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}

export interface MobileRecordCardProps {
  id: string;
  primaryTitle: React.ReactNode;
  subtitle?: React.ReactNode;
  statusBadge?: React.ReactNode;
  selected?: boolean;
  onToggleSelect?: () => void;
  onClick?: () => void;
  primaryFields: MobileRecordCardField[];
  secondaryFields?: MobileRecordCardField[];
  actions?: React.ReactNode;
}

/**
 * Reusable Mobile Record Card for transforming wide enterprise tables on Mobile & Tablet.
 */
export const MobileRecordCard: React.FC<MobileRecordCardProps> = ({
  primaryTitle,
  subtitle,
  statusBadge,
  selected,
  onToggleSelect,
  onClick,
  primaryFields,
  secondaryFields = [],
  actions,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`bg-white rounded-xl border transition shadow-2xs p-3.5 space-y-2.5 min-w-0 max-w-full ${
        selected ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/15' : 'border-slate-200'
      }`}
    >
      {/* Top Row: Checkbox + Record Identifier + Status Badge */}
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={!!selected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelect();
              }}
              className="mt-1 w-4 h-4 accent-indigo-600 rounded shrink-0 cursor-pointer"
            />
          )}
          <div
            onClick={onClick}
            className={`min-w-0 flex-1 ${onClick ? 'cursor-pointer' : ''}`}
          >
            <div className="font-mono font-bold text-indigo-700 text-xs sm:text-sm break-words">
              {primaryTitle}
            </div>
            {subtitle && (
              <div className="text-xs font-semibold text-slate-800 mt-0.5 break-words">
                {subtitle}
              </div>
            )}
          </div>
        </div>
        {statusBadge && <div className="shrink-0">{statusBadge}</div>}
      </div>

      {/* Primary Key-Value Grid */}
      <div
        onClick={onClick}
        className={`grid grid-cols-2 gap-x-3 gap-y-1.5 pt-2 border-t border-slate-100 text-xs ${
          onClick ? 'cursor-pointer' : ''
        }`}
      >
        {primaryFields.map((f, i) => (
          <div key={i} className="min-w-0">
            <span className="text-[10px] font-bold uppercase text-slate-400 block truncate">
              {f.label}
            </span>
            <div
              className={`truncate ${
                f.highlight ? 'font-mono font-bold text-slate-900' : 'text-slate-700 font-medium'
              }`}
            >
              {f.value}
            </div>
          </div>
        ))}
      </div>

      {/* Expandable Secondary Details */}
      {secondaryFields.length > 0 && expanded && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-2 border-t border-dashed border-slate-200 text-xs bg-slate-50/70 p-2.5 rounded-lg">
          {secondaryFields.map((f, i) => (
            <div key={i} className="min-w-0">
              <span className="text-[10px] font-bold uppercase text-slate-400 block truncate">
                {f.label}
              </span>
              <div className="text-slate-700 font-medium break-words">{f.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Card Footer: Expand Toggle & Contextual Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
        {secondaryFields.length > 0 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 py-1 cursor-pointer"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" /> Less Details
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" /> More Details ({secondaryFields.length})
              </>
            )}
          </button>
        ) : (
          <span />
        )}

        {actions && (
          <div
            className="flex flex-wrap items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Responsive Filter Panel / Drawer for Mobile & Tablet.
 */
export const ResponsiveFilterPanel: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onClearAll: () => void;
  activeFilterCount: number;
  title?: string;
  children: React.ReactNode;
}> = ({ isOpen, onClose, onClearAll, activeFilterCount, title = 'Filter & Sort Records', children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl max-h-[88vh] flex flex-col overflow-hidden">
        <div className="p-4 bg-[#0B192C] text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold">{title}</h3>
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 bg-indigo-600 text-white rounded-full text-[10px] font-bold">
                {activeFilterCount} Active
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
            aria-label="Close Filter Panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-3 text-xs">{children}</div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClearAll}
            className="px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear All</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Check className="w-4 h-4" />
            <span>Apply Filters</span>
          </button>
        </div>
      </div>
    </div>
  );
};
