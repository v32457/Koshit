/**
 * KOSH INNOVATIONS — PRIVACY-FIRST LOCAL WEBCAM AI MONITOR WIDGET
 * Runs TensorFlow.js COCO-SSD locally inside the browser ONLY when enabled by effective policy
 * and consented to by the user. Displays explicit Camera Active indicator and performance telemetry.
 * ZERO frames uploaded, ZERO video saved, ZERO facial recognition.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, ShieldCheck, AlertTriangle, Activity } from 'lucide-react';
import type { WebcamAiDetectionConfig, WebcamDetectionTelemetry } from '../../types/zeroTrustSecurity';
import { DetectionOutcome, sharedWebcamAiEngine } from '../../services/webcamAiDetectionEngine';

interface WebcamSecurityMonitorWidgetProps {
  enabled: boolean;
  config: WebcamAiDetectionConfig;
  onEscalatedDetection: (outcome: DetectionOutcome) => void;
  onPermissionDenied: (reason: string) => void;
  onModelFailure: (reason: string) => void;
  onTelemetryChange?: (telemetry: WebcamDetectionTelemetry) => void;
}

export const WebcamSecurityMonitorWidget: React.FC<WebcamSecurityMonitorWidgetProps> = ({
  enabled,
  config,
  onEscalatedDetection,
  onPermissionDenied,
  onModelFailure,
  onTelemetryChange,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [telemetry, setTelemetry] = useState<WebcamDetectionTelemetry>(() =>
    sharedWebcamAiEngine.getTelemetry()
  );
  const [consentGiven, setConsentGiven] = useState(false);
  const [starting, setStarting] = useState(false);

  const refreshTelemetry = () => {
    const snap = sharedWebcamAiEngine.getTelemetry();
    setTelemetry(snap);
    onTelemetryChange?.(snap);
  };

  useEffect(() => {
    if (!enabled) {
      sharedWebcamAiEngine.stopMonitoring();
      setConsentGiven(false);
      refreshTelemetry();
    }
    return () => {
      sharedWebcamAiEngine.stopMonitoring();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const handleStartMonitoring = async () => {
    setStarting(true);
    try {
      await sharedWebcamAiEngine.initializeRuntime(config.preferredBackend);
    } catch (err: any) {
      refreshTelemetry();
      onModelFailure(err?.message || 'Local AI model failed to load');
      setStarting(false);
      return;
    }

    const perm = await sharedWebcamAiEngine.requestCameraPermission();
    refreshTelemetry();
    if (!perm.granted || !perm.stream) {
      onPermissionDenied(perm.error || 'Camera permission denied by user or browser');
      setStarting(false);
      return;
    }

    setConsentGiven(true);
    if (videoRef.current) {
      videoRef.current.srcObject = perm.stream;
      await videoRef.current.play().catch(() => {});
      sharedWebcamAiEngine.startVideoLoop(
        videoRef.current,
        config,
        (outcome) => {
          refreshTelemetry();
          if (outcome.escalated) {
            onEscalatedDetection(outcome);
          }
        },
        (err) => {
          refreshTelemetry();
          onModelFailure(err.message);
        }
      );
    }
    refreshTelemetry();
    setStarting(false);
  };

  const handleStopMonitoring = () => {
    sharedWebcamAiEngine.stopMonitoring();
    setConsentGiven(false);
    refreshTelemetry();
  };

  if (!enabled) return null;

  return (
    <div
      data-testid="webcam-security-widget"
      className="bg-slate-900 text-slate-100 rounded-lg border border-slate-700 px-3 py-2 text-[11px] flex flex-wrap items-center justify-between gap-3"
    >
      <video ref={videoRef} muted playsInline className="hidden" width={320} height={240} />

      <div className="flex items-center gap-2.5 min-w-0">
        {telemetry.cameraActive ? (
          <div className="p-1.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
            <Camera className="w-3.5 h-3.5" />
          </div>
        ) : (
          <div className="p-1.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300">
            <CameraOff className="w-3.5 h-3.5" />
          </div>
        )}
        <div className="min-w-0">
          <div className="font-bold flex items-center gap-2">
            <span>
              {telemetry.cameraActive
                ? 'CAMERA ACTIVE • Local AI CV Guard'
                : 'Webcam AI Protection Required by Policy'}
            </span>
            <span className="font-mono text-[10px] text-slate-300">
              [{telemetry.backend.toUpperCase()}]
            </span>
          </div>
          <div className="text-[10px] text-slate-400 truncate">
            Local memory inference only • Zero frame upload • Zero video retention • No facial recognition
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 tabular-nums">
        {telemetry.cameraActive && (
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-300">
            <Activity className="w-3 h-3 text-cyan-400" />
            <span>{telemetry.lastInferenceMs} ms</span>
            <span>Frames: {telemetry.totalFramesProcessed}</span>
            {telemetry.lastDetections.length > 0 && (
              <span className="text-amber-300 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {telemetry.lastDetections.map((d) => `${d.className} (${Math.round(d.score * 100)}%)`).join(', ')}
              </span>
            )}
          </div>
        )}

        {!consentGiven || !telemetry.cameraActive ? (
          <button
            type="button"
            disabled={starting}
            onClick={handleStartMonitoring}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded font-bold cursor-pointer flex items-center gap-1"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{starting ? 'Loading Local Model...' : 'Grant Camera Consent & Start'}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStopMonitoring}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded font-semibold cursor-pointer"
          >
            Pause Camera
          </button>
        )}
      </div>
    </div>
  );
};
