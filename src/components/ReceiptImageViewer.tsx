import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  X,
  Maximize2,
  Copy,
  Check,
  Image as ImageIcon,
  Move,
  RefreshCw,
} from 'lucide-react';
import { copyToClipboard } from '../lib/utils';

interface ReceiptImageViewerProps {
  src: string;
  alt?: string;
  trackingNumber?: string;
  invoiceNumber?: string;
  className?: string;
}

/**
 * Standard Full-Screen Lightbox Modal for receipts.
 * Renders via createPortal to document.body with z-[100] so it NEVER gets trapped behind parent modals.
 * Supports touch pinch-to-zoom, pan drag, double-tap zoom, rotation, and desktop mouse controls.
 */
export const ReceiptLightboxModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  src: string;
  alt?: string;
  trackingNumber?: string;
  invoiceNumber?: string;
}> = ({ isOpen, onClose, src, alt = 'فیش واریز', trackingNumber, invoiceNumber }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [copiedCode, setCopiedCode] = useState(false);

  // Touch gesture state
  const touchStartDist = useRef<number | null>(null);
  const initialTouchScale = useRef<number>(1);
  const lastTapRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setRotation(0);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      } else if (e.key === '0' || e.key.toLowerCase() === 'r') {
        handleReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, scale]);

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setScale((prev) => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    setScale((prev) => {
      const next = Math.min(Math.max(prev + delta, 1), 4);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  // Mouse drag to pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch Pinch & Pan Gestures (Standard mobile behavior)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 2 fingers pinch
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDist.current = dist;
      initialTouchScale.current = scale;
    } else if (e.touches.length === 1) {
      // Double-tap detection
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        // Double tap toggle
        if (scale > 1) {
          handleReset();
        } else {
          setScale(2.5);
        }
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;

      // 1 finger pan when zoomed
      if (scale > 1) {
        setIsDragging(true);
        setDragStart({
          x: e.touches[0].clientX - position.x,
          y: e.touches[0].clientY - position.y,
        });
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDist.current !== null) {
      // Pinch to zoom
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = currentDist / touchStartDist.current;
      const newScale = Math.min(Math.max(initialTouchScale.current * factor, 1), 4);
      setScale(newScale);
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      // Touch pan
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    touchStartDist.current = null;
    setIsDragging(false);
  };

  const handleCopyCode = async () => {
    if (!trackingNumber) return;
    const ok = await copyToClipboard(trackingNumber);
    if (ok) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  if (!isOpen) return null;

  if (typeof document === 'undefined' || !document.body) {
    return null;
  }

  return createPortal(
    <div
      style={{ zIndex: 99999 }}
      className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-md flex flex-col select-none overflow-hidden touch-none animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Top Header Bar */}
      <div
        className="p-3 sm:p-4 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between text-white z-10 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30 shadow-xs">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-xs sm:text-sm text-white">
                تصویر رسید / فیش بانکی
              </h3>
              {invoiceNumber && (
                <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md hidden sm:inline-block">
                  فاکتور: {invoiceNumber}
                </span>
              )}
            </div>
            {trackingNumber && trackingNumber !== 'ثبت نشده' && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[11px] text-slate-400">کد پیگیری:</span>
                <span className="font-mono text-amber-300 font-bold text-xs dir-ltr" dir="ltr">
                  {trackingNumber}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="text-slate-400 hover:text-amber-300 text-[10px] flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-1.5 py-0.5 rounded-md transition-colors"
                >
                  {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCode ? 'کپی شد' : 'کپی'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <a
            href={src}
            download={`receipt-${invoiceNumber || 'payment'}.jpg`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 sm:px-3.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5 text-xs font-semibold border border-slate-700"
            title="دانلود تصویر با کیفیت اصلی"
          >
            <Download className="w-4 h-4 text-teal-400" />
            <span className="hidden sm:inline">دانلود فیش</span>
          </a>

          <button
            type="button"
            onClick={onClose}
            className="p-2 sm:p-2.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition-colors border border-slate-700 cursor-pointer"
            title="بستن (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div
        ref={containerRef}
        className="flex-1 relative flex items-center justify-center overflow-hidden p-2 sm:p-6"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        <div
          className="relative transition-transform duration-75 ease-out max-w-full max-h-full flex items-center justify-center"
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale}) rotate(${rotation}deg)`,
            transformOrigin: 'center center',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={src}
            alt={alt}
            draggable={false}
            className="max-h-[72vh] sm:max-h-[78vh] max-w-[94vw] sm:max-w-[88vw] object-contain rounded-xl shadow-2xl pointer-events-none ring-1 ring-white/10"
          />
        </div>

        {/* Mobile touch hint when 1x */}
        {scale === 1 && (
          <div className="absolute bottom-20 sm:bottom-24 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-700 text-slate-200 text-[11px] backdrop-blur-md pointer-events-none flex items-center gap-1.5 shadow-xl">
            <Maximize2 className="w-3.5 h-3.5 text-teal-400" />
            <span>با دو انگشت زوم کنید یا دوبار ضربه بزنید</span>
          </div>
        )}
      </div>

      {/* Floating Bottom Control Bar */}
      <div
        className="p-3 bg-slate-900/95 border-t border-slate-800 flex items-center justify-center gap-2 sm:gap-3 z-10 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1 bg-slate-800/95 p-1 rounded-2xl border border-slate-700 shadow-2xl">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= 1}
            className="p-2 sm:px-3 rounded-xl hover:bg-slate-700 text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors flex items-center gap-1 text-xs font-semibold"
            title="کوچک‌نمایی (-)"
          >
            <ZoomOut className="w-4 h-4" />
            <span className="hidden sm:inline">کوچک‌تر</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-700 text-teal-400 font-mono font-bold text-xs transition-colors min-w-[58px] text-center"
            title="بازنشانی زوم"
          >
            {Math.round(scale * 100)}%
          </button>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= 4}
            className="p-2 sm:px-3 rounded-xl hover:bg-slate-700 text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors flex items-center gap-1 text-xs font-semibold"
            title="بزرگ‌نمایی (+)"
          >
            <ZoomIn className="w-4 h-4" />
            <span className="hidden sm:inline">بزرگ‌تر</span>
          </button>

          <div className="w-[1px] h-6 bg-slate-700 mx-1" />

          <button
            type="button"
            onClick={handleRotate}
            className="p-2 sm:px-3 rounded-xl hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1 text-xs font-semibold"
            title="چرخش ۹۰ درجه"
          >
            <RotateCw className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">چرخش</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="p-2 rounded-xl hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            title="بازنشانی اندازه و زاویه"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

/**
 * Interactive Receipt Image with Hover Magnifier on Desktop
 * and Standard Tap-to-Zoom Lightbox on Mobile.
 */
export const ReceiptImageHoverZoom: React.FC<ReceiptImageViewerProps> = ({
  src,
  alt = 'تصویر فیش واریزی',
  trackingNumber,
  invoiceNumber,
  className = '',
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [zoomLevel, setZoomLevel] = useState(2.6);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Detect touch device
  useEffect(() => {
    const checkTouch = () => {
      setIsTouchDevice(
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches
      );
    };
    checkTouch();
    window.addEventListener('resize', checkTouch);
    return () => window.removeEventListener('resize', checkTouch);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isTouchDevice || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
  };

  const handleMouseEnter = () => {
    if (!isTouchDevice) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setMousePos({ x: 50, y: 50 });
  };

  // Allow scrolling wheel to adjust zoom factor while hovering preview on desktop
  const handlePreviewWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (isTouchDevice || !isHovered) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.3 : -0.3;
    setZoomLevel((prev) => Math.min(Math.max(1.6, prev + delta), 4.0));
  };

  return (
    <>
      <div
        ref={containerRef}
        onClick={() => setIsLightboxOpen(true)}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onWheel={handlePreviewWheel}
        className={`group relative overflow-hidden rounded-2xl border-2 border-teal-500/40 hover:border-teal-500 bg-slate-950/5 dark:bg-black/40 cursor-zoom-in transition-all duration-200 hover:shadow-xl ${className}`}
        title={isTouchDevice ? 'برای مشاهده و زوم لمس کنید' : 'برای بزرگ‌نمایی ماوس را روی تصویر حرکت دهید | کلیک برای اندازه کامل'}
      >
        {/* Receipt Image */}
        <div className="w-full h-60 sm:h-64 flex items-center justify-center overflow-hidden bg-slate-900/10 dark:bg-black/30 relative">
          <img
            src={src}
            alt={alt}
            className="w-full h-full object-contain select-none transition-transform duration-100 ease-out"
            style={
              !isTouchDevice && isHovered
                ? {
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: `${mousePos.x}% ${mousePos.y}%`,
                  }
                : {
                    transform: 'scale(1)',
                    transformOrigin: 'center center',
                  }
            }
          />

          {/* Precision Magnifier Reticle / Lens Guide (Desktop only on hover) */}
          {!isTouchDevice && isHovered && (
            <div
              className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-teal-400 bg-teal-400/10 shadow-lg shadow-teal-500/20 backdrop-contrast-125 transition-all duration-75"
              style={{
                left: `${mousePos.x}%`,
                top: `${mousePos.y}%`,
                width: '72px',
                height: '72px',
              }}
            >
              {/* Reticle center point */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
              </div>
            </div>
          )}
        </div>

        {/* Live Hover Zoom Badge Indicator (Desktop) */}
        {!isTouchDevice && isHovered && (
          <div className="absolute top-2.5 right-2.5 bg-slate-900/90 text-teal-300 px-2.5 py-1 rounded-lg text-[10px] font-bold backdrop-blur-xs flex items-center gap-1.5 shadow-md border border-teal-500/40 pointer-events-none animate-in fade-in duration-100">
            <ZoomIn className="w-3.5 h-3.5 text-teal-400" />
            <span>زوم زنده {zoomLevel.toFixed(1)}× با پوینتر ماوس</span>
          </div>
        )}

        {/* Action / Hint Bar (Always visible) */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-900/70 to-transparent p-2.5 sm:p-3 flex items-center justify-between text-white text-xs font-semibold">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-200">
            <Maximize2 className="w-3.5 h-3.5 text-teal-400" />
            <span>
              {isTouchDevice
                ? 'لمس کنید جهت باز شدن و زوم لمسی'
                : 'حرکت ماوس = زوم خودکار | کلیک = تمام‌صفحه'}
            </span>
          </div>

          <span className="px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-300 text-[10px] font-bold border border-teal-500/30 whitespace-nowrap">
            {isTouchDevice ? 'مشاهده لمسی' : 'زوم با نشانگر'}
          </span>
        </div>
      </div>

      {/* Standard Full-Screen Lightbox with zIndex 99999 */}
      <ReceiptLightboxModal
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        src={src}
        alt={alt}
        trackingNumber={trackingNumber}
        invoiceNumber={invoiceNumber}
      />
    </>
  );
};
