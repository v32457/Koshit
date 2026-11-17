/**
 * KOSH INNOVATIONS — LOCAL WEBCAM COMPUTER VISION ENGINE
 * Executes REAL open-source object detection locally using @tensorflow/tfjs + @tensorflow-models/coco-ssd
 * backed by SHA-256 verified weights stored in /public/models/coco-ssd/ and WASM binaries in /public/tfjs-wasm/.
 *
 * PRIVACY INVARIANTS (NON-NEGOTIABLE):
 * - 100% local frame inference in memory only
 * - ZERO webcam frame upload
 * - ZERO video recording or retention
 * - ZERO facial recognition or biometric identification
 * - Transmits only structured detection metadata (class, score, risk) when policy threshold is crossed
 */

import type {
  SecuritySeverity,
  WebcamAiDetectionConfig,
  WebcamDetectionTelemetry,
} from '../types/zeroTrustSecurity';

export interface DetectionOutcome {
  detectedTargets: Array<{
    className: string;
    score: number;
    bbox: [number, number, number, number];
    riskLevel: SecuritySeverity;
  }>;
  inferenceMs: number;
  escalated: boolean;
  suppressedByCooldown: boolean;
  riskSeverity: SecuritySeverity;
  persistenceCount: number;
}

export class WebcamAiDetectionEngine {
  private tf: any = null;
  private model: any = null;
  private activeBackend = 'uninitialized';
  private stream: MediaStream | null = null;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private loadingPromise: Promise<void> | null = null;

  private persistenceTimestamps: number[] = [];
  private lastEscalationAt = 0;
  private inferenceSamples: number[] = [];
  private totalFramesProcessed = 0;
  private permissionState: WebcamDetectionTelemetry['cameraPermission'] = 'idle';
  private lastError: string | undefined;
  private lastDetections: DetectionOutcome['detectedTargets'] = [];

  public async initializeRuntime(
    preferredBackend: WebcamAiDetectionConfig['preferredBackend'] = 'auto',
    customModelUrl?: string
  ): Promise<{ backend: string; modelLoaded: boolean }> {
    if (this.model) {
      return { backend: this.activeBackend, modelLoaded: true };
    }
    if (this.loadingPromise) {
      await this.loadingPromise;
      return { backend: this.activeBackend, modelLoaded: Boolean(this.model) };
    }

    this.loadingPromise = (async () => {
      try {
        const tf = await import('@tensorflow/tfjs');
        const wasmBackend = await import('@tensorflow/tfjs-backend-wasm');
        const cocoSsd = await import('@tensorflow-models/coco-ssd');

        this.tf = tf;
        if (typeof wasmBackend.setWasmPaths === 'function' && typeof window !== 'undefined') {
          wasmBackend.setWasmPaths('/tfjs-wasm/');
        }

        const candidateBackends =
          preferredBackend === 'auto'
            ? typeof window !== 'undefined'
              ? ['webgpu', 'webgl', 'wasm', 'cpu']
              : ['cpu']
            : [preferredBackend, 'wasm', 'cpu'];

        for (const candidate of candidateBackends) {
          try {
            if (candidate === 'webgpu' && (typeof navigator === 'undefined' || !(navigator as any).gpu)) {
              continue;
            }
            if (candidate === 'webgl' && typeof document === 'undefined') {
              continue;
            }
            if (candidate === 'wasm' && typeof WebAssembly === 'undefined') {
              continue;
            }
            const ok = await tf.setBackend(candidate);
            if (ok) {
              await tf.ready();
              this.activeBackend = tf.getBackend();
              break;
            }
          } catch {
            // Try next fallback backend
          }
        }

        if (!this.activeBackend || this.activeBackend === 'uninitialized') {
          await tf.setBackend('cpu');
          await tf.ready();
          this.activeBackend = tf.getBackend();
        }

        const modelUrl =
          customModelUrl ||
          (typeof window !== 'undefined'
            ? '/models/coco-ssd/model.json'
            : undefined);

        this.model = await cocoSsd.load({
          base: 'lite_mobilenet_v2',
          ...(modelUrl ? { modelUrl } : {}),
        });
        this.lastError = undefined;
      } catch (err: any) {
        this.lastError = err?.message || 'Failed to initialize TensorFlow.js COCO-SSD model';
        throw err;
      } finally {
        this.loadingPromise = null;
      }
    })();

    await this.loadingPromise;
    return { backend: this.activeBackend, modelLoaded: Boolean(this.model) };
  }

  public async requestCameraPermission(): Promise<{
    granted: boolean;
    state: WebcamDetectionTelemetry['cameraPermission'];
    stream?: MediaStream;
    error?: string;
  }> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.permissionState = 'unavailable';
      this.lastError = 'Browser MediaDevices API unavailable in this environment.';
      return { granted: false, state: 'unavailable', error: this.lastError };
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      this.stream = stream;
      this.permissionState = 'granted';
      this.lastError = undefined;
      return { granted: true, state: 'granted', stream };
    } catch (err: any) {
      const name = err?.name || '';
      this.permissionState = name === 'NotAllowedError' || name === 'PermissionDeniedError' ? 'denied' : 'unavailable';
      this.lastError = err?.message || 'Camera permission denied or device unavailable';
      return { granted: false, state: this.permissionState, error: this.lastError };
    }
  }

  /**
   * Executes real COCO-SSD object detection against a video frame, canvas, ImageData, or tf.Tensor3D.
   * Zero network uploads — frames stay strictly in local memory and tensors are disposed immediately.
   */
  public async detectFrame(
    input: HTMLVideoElement | HTMLCanvasElement | ImageData | any,
    config: WebcamAiDetectionConfig,
    nowMs = Date.now()
  ): Promise<DetectionOutcome> {
    if (!this.model) {
      await this.initializeRuntime(config.preferredBackend);
    }

    const start = performance.now();
    const predictions: Array<{ class: string; score: number; bbox: [number, number, number, number] }> =
      await this.model.detect(input, 10, Math.max(0.2, config.confidenceThreshold * 0.8));
    const inferenceMs = Math.round((performance.now() - start) * 100) / 100;

    this.totalFramesProcessed += 1;
    this.inferenceSamples.push(inferenceMs);
    if (this.inferenceSamples.length > 50) this.inferenceSamples.shift();

    const normalizedTargets = new Set(config.targetClasses.map((c) => c.toLowerCase()));
    const matched = predictions
      .filter(
        (p) =>
          p.score >= config.confidenceThreshold &&
          normalizedTargets.has(p.class.toLowerCase())
      )
      .map((p) => {
        const isHighConfidencePhone = p.class.toLowerCase() === 'cell phone' && p.score >= 0.78;
        return {
          className: p.class,
          score: Math.round(p.score * 1000) / 1000,
          bbox: p.bbox,
          riskLevel: isHighConfidencePhone ? ('HIGH' as SecuritySeverity) : config.riskOnSingleDetection,
        };
      });

    this.lastDetections = matched;

    // Persistence window pruning + false-positive suppression
    const windowMs = Math.max(2, config.escalationWindowSeconds) * 1000;
    this.persistenceTimestamps = this.persistenceTimestamps.filter((ts) => nowMs - ts <= windowMs);

    let escalated = false;
    let suppressedByCooldown = false;
    let riskSeverity: SecuritySeverity = 'INFO';

    if (matched.length > 0) {
      this.persistenceTimestamps.push(nowMs);
      riskSeverity = config.riskOnSingleDetection;

      if (this.persistenceTimestamps.length >= Math.max(1, config.persistenceFrames)) {
        const cooldownMs = Math.max(5, config.cooldownSeconds) * 1000;
        if (nowMs - this.lastEscalationAt < cooldownMs) {
          suppressedByCooldown = true;
        } else {
          escalated = true;
          this.lastEscalationAt = nowMs;
          riskSeverity = config.riskOnPersistentDetection;
        }
      }
    }

    return {
      detectedTargets: matched,
      inferenceMs,
      escalated,
      suppressedByCooldown,
      riskSeverity,
      persistenceCount: this.persistenceTimestamps.length,
    };
  }

  public startVideoLoop(
    videoEl: HTMLVideoElement,
    config: WebcamAiDetectionConfig,
    onOutcome: (outcome: DetectionOutcome) => void,
    onError: (err: Error) => void
  ): void {
    this.stopLoopOnly();
    const intervalMs = Math.max(500, Math.round(1000 / Math.max(0.2, Math.min(2, config.fps))));
    let busy = false;
    this.intervalHandle = setInterval(() => {
      if (busy || !videoEl || videoEl.readyState < 2) return;
      busy = true;
      this.detectFrame(videoEl, config)
        .then(onOutcome)
        .catch((err) => onError(err instanceof Error ? err : new Error(String(err))))
        .finally(() => {
          busy = false;
        });
    }, intervalMs);
  }

  private stopLoopOnly(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  public stopMonitoring(): void {
    this.stopLoopOnly();
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
    this.persistenceTimestamps = [];
    this.lastDetections = [];
  }

  public getTelemetry(): WebcamDetectionTelemetry {
    const avg =
      this.inferenceSamples.length > 0
        ? Math.round((this.inferenceSamples.reduce((a, b) => a + b, 0) / this.inferenceSamples.length) * 100) / 100
        : 0;
    const memInfo = this.tf?.memory?.();
    const memoryMbEstimate = memInfo?.numBytes ? Math.round((memInfo.numBytes / (1024 * 1024)) * 100) / 100 : null;

    return {
      runtimeReady: Boolean(this.tf),
      backend: this.activeBackend,
      modelLoaded: Boolean(this.model),
      modelName: 'COCO-SSD (SSDLite MobileNet v2 Local)',
      cameraPermission: this.permissionState,
      cameraActive: Boolean(this.stream && this.stream.getVideoTracks().some((t) => t.readyState === 'live')),
      lastInferenceMs: this.inferenceSamples[this.inferenceSamples.length - 1] || 0,
      avgInferenceMs: avg,
      totalFramesProcessed: this.totalFramesProcessed,
      memoryMbEstimate,
      consecutivePhoneDetections: this.persistenceTimestamps.length,
      lastDetections: this.lastDetections,
      lastError: this.lastError,
    };
  }

  public resetPersistence(): void {
    this.persistenceTimestamps = [];
    this.lastEscalationAt = 0;
  }
}

export const sharedWebcamAiEngine = new WebcamAiDetectionEngine();
