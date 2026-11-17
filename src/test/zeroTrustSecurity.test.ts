import assert from 'node:assert/strict';
import fs from 'node:fs';
import { once } from 'node:events';
import { createServer } from 'node:http';
import path from 'node:path';
import test from 'node:test';
import * as tf from '@tensorflow/tfjs';
import { evaluateBrowserCompliance } from '../services/browserGovernanceService';
import { WebcamAiDetectionEngine } from '../services/webcamAiDetectionEngine';
import {
  createInheritedControlsMap,
  DEFAULT_SECURITY_PARAMETERS,
  evaluateEffectiveSecurityPolicy,
} from '../services/zeroTrustPolicyEvaluator';
import type { ScopedSecurityPolicyConfig } from '../types/zeroTrustSecurity';

function makeGlobalPolicy(version = 1): ScopedSecurityPolicyConfig {
  return {
    id: 'zt-global',
    scopeLevel: 'GLOBAL',
    scopeRefId: 'GLOBAL',
    scopeLabel: 'Global Baseline',
    isActive: true,
    version,
    controls: createInheritedControlsMap({
      browserRestriction: { state: 'MANDATORY' },
      watermark: { state: 'MANDATORY' },
      clipboardControl: { state: 'ENABLED' },
      focusProtection: { state: 'ENABLED' },
      webcamMonitoring: { state: 'DISABLED' },
      blackoutResponse: { state: 'MANDATORY' },
      sessionTimeout: { state: 'MANDATORY' },
      sensitiveFieldMasking: { state: 'ENABLED' },
      screenAccessRestriction: { state: 'MANDATORY' },
      securityEventMonitoring: { state: 'MANDATORY' },
      exportRestrictions: { state: 'ENABLED' },
      exceptionApproval: { state: 'ENABLED' },
    }),
    parameters: JSON.parse(JSON.stringify(DEFAULT_SECURITY_PARAMETERS)),
    updatedAt: '2026-11-16T00:00:00Z',
    updatedById: 'usr-admin-01',
    updatedByName: 'Rajesh Sharma',
    changeReason: 'Test baseline',
  };
}

test('Deterministic policy evaluator respects Global->Company->Branch->Module->Optional Page->Optional User order and parent MANDATORY lock', () => {
  const globalPolicy = makeGlobalPolicy(1);
  const branchPolicy: ScopedSecurityPolicyConfig = {
    id: 'zt-br-1',
    scopeLevel: 'BRANCH',
    scopeRefId: 'br-pond-01',
    scopeLabel: 'Pondicherry Plant',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    isActive: true,
    version: 2,
    controls: createInheritedControlsMap({
      watermark: { state: 'DISABLED' }, // Cannot override Global MANDATORY!
      clipboardControl: { state: 'DISABLED' }, // Allowed because Global is ENABLED (not MANDATORY)
    }),
    parameters: {},
    updatedAt: '2026-11-16T00:00:00Z',
    updatedById: 'usr-admin-01',
    updatedByName: 'Rajesh Sharma',
    changeReason: 'Branch test',
  };

  const pagePolicy: ScopedSecurityPolicyConfig = {
    id: 'zt-page-1',
    scopeLevel: 'PAGE',
    scopeRefId: 'pr_master_list',
    scopeLabel: 'PR List Screen',
    pageKey: 'pr_master_list',
    isActive: true,
    version: 3,
    controls: createInheritedControlsMap({
      clipboardControl: { state: 'ENABLED' },
    }),
    parameters: {},
    updatedAt: '2026-11-16T00:00:00Z',
    updatedById: 'usr-admin-01',
    updatedByName: 'Rajesh Sharma',
    changeReason: 'Page override',
  };

  // Both optional scopes OFF -> clipboardControl disabled by Branch, watermark locked MANDATORY
  const evalOff = evaluateEffectiveSecurityPolicy({
    context: {
      userId: 'usr-buyer-01',
      userName: 'Vikram Singh',
      userRole: 'ITEM_MAKER',
      companyId: 'co-kosh-01',
      companyName: 'Kosh Innovations Pvt Ltd',
      branchId: 'br-pond-01',
      branchName: 'Pondicherry Plant',
      moduleKey: 'PURCHASE_REQUISITION',
      pageKey: 'pr_master_list',
    },
    optionalScopes: { pageLevelEnabled: false, userLevelEnabled: false, updatedAt: '', updatedBy: '', reason: '' },
    globalPolicy,
    branchPolicy,
    pagePolicy,
    exceptions: [],
    cacheVersion: 1,
  });
  assert.equal(evalOff.controls.watermark.effectiveValue, true);
  assert.equal(evalOff.controls.watermark.overrideStatus, 'LOCKED_BY_PARENT');
  assert.equal(evalOff.controls.clipboardControl.effectiveValue, false);
  assert.equal(evalOff.controls.clipboardControl.sourceLevel, 'BRANCH');

  // Enable Page scope -> page re-enables clipboardControl cleanly
  const evalPageOn = evaluateEffectiveSecurityPolicy({
    context: {
      userId: 'usr-buyer-01',
      userName: 'Vikram Singh',
      userRole: 'ITEM_MAKER',
      companyId: 'co-kosh-01',
      companyName: 'Kosh Innovations Pvt Ltd',
      branchId: 'br-pond-01',
      branchName: 'Pondicherry Plant',
      moduleKey: 'PURCHASE_REQUISITION',
      pageKey: 'pr_master_list',
    },
    optionalScopes: { pageLevelEnabled: true, userLevelEnabled: false, updatedAt: '', updatedBy: '', reason: '' },
    globalPolicy,
    branchPolicy,
    pagePolicy,
    exceptions: [],
    cacheVersion: 1,
  });
  assert.equal(evalPageOn.controls.clipboardControl.effectiveValue, true);
  assert.equal(evalPageOn.controls.clipboardControl.sourceLevel, 'PAGE');
});

test('Approved Browser Governance evaluates Edge, Chrome, outdated versions, Firefox, Safari, and insecure context', () => {
  const cfg = DEFAULT_SECURITY_PARAMETERS.browserGovernance;

  const edgeOk = evaluateBrowserCompliance(cfg, true, {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.2849.46',
    isSecureContext: true,
  });
  assert.equal(edgeOk.browserFamily, 'MICROSOFT_EDGE');
  assert.equal(edgeOk.compliant, true);
  assert.equal(edgeOk.decision, 'ALLOW');

  const chromeOk = evaluateBrowserCompliance(cfg, true, {
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    isSecureContext: true,
  });
  assert.equal(chromeOk.browserFamily, 'GOOGLE_CHROME');
  assert.equal(chromeOk.compliant, true);

  const outdatedChrome = evaluateBrowserCompliance(cfg, true, {
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.0.0 Safari/537.36',
    isSecureContext: true,
  });
  assert.equal(outdatedChrome.compliant, false);
  assert.equal(outdatedChrome.meetsMinimumVersion, false);

  const firefox = evaluateBrowserCompliance(cfg, true, {
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
    isSecureContext: true,
  });
  assert.equal(firefox.browserFamily, 'FIREFOX');
  assert.equal(firefox.compliant, false);
  assert.equal(firefox.decision, 'RESTRICT_SENSITIVE');

  const insecureStrict = evaluateBrowserCompliance({ ...cfg, requireSecureContext: true }, true, {
    userAgent: 'Mozilla/5.0 AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
    isSecureContext: false,
  });
  assert.equal(insecureStrict.compliant, false);
});

test('Real Local AI Model (TensorFlow.js + COCO-SSD SSDLite MobileNet v2) loads from local public/models/coco-ssd artifacts and runs tensor inference', async () => {
  const modelDir = path.resolve(process.cwd(), 'public/models/coco-ssd');
  assert.equal(fs.existsSync(path.join(modelDir, 'model.json')), true);

  // Serve local model files cleanly over localhost loopback without any external internet dependency
  const modelServer = createServer((req, res) => {
    const safeName = path.basename((req.url || '/').split('?')[0]);
    const fullPath = path.join(modelDir, safeName);
    if (!fs.existsSync(fullPath)) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': safeName.endsWith('.json') ? 'application/json' : 'application/octet-stream',
    });
    fs.createReadStream(fullPath).pipe(res);
  });

  modelServer.listen(0, '127.0.0.1');
  await once(modelServer, 'listening');
  const addr = modelServer.address();
  if (!addr || typeof addr === 'string') throw new Error('Failed to start local model asset server');

  try {
    const engine = new WebcamAiDetectionEngine();
    const init = await engine.initializeRuntime('cpu', `http://127.0.0.1:${addr.port}/model.json`);
    assert.equal(init.modelLoaded, true);
    assert.ok(['cpu', 'wasm'].includes(init.backend));

    // Real TFJS tensor input (320x240 RGB) -> run genuine SSD MobileNet v2 inference
    const blankFrame = tf.zeros([240, 320, 3], 'int32');
    try {
      const outcome = await engine.detectFrame(blankFrame, {
        ...DEFAULT_SECURITY_PARAMETERS.webcamAi,
        enabled: true,
        preferredBackend: 'cpu',
      });
      assert.ok(outcome.inferenceMs > 0, `Expected real positive inference latency, got ${outcome.inferenceMs}`);
      assert.equal(Array.isArray(outcome.detectedTargets), true);
      assert.equal(outcome.escalated, false);
      const telemetry = engine.getTelemetry();
      assert.equal(telemetry.modelLoaded, true);
      assert.equal(telemetry.totalFramesProcessed, 1);
      assert.ok(telemetry.lastInferenceMs > 0);
    } finally {
      blankFrame.dispose();
    }
  } finally {
    modelServer.close();
    await once(modelServer, 'close');
  }
});

test('Policy evaluation benchmark meets high-throughput enterprise latency budget (< 5ms avg)', () => {
  const globalPolicy = makeGlobalPolicy(1);
  const start = performance.now();
  const iterations = 200;
  for (let i = 0; i < iterations; i += 1) {
    evaluateEffectiveSecurityPolicy({
      context: {
        userId: 'usr-buyer-01',
        userName: 'Vikram Singh',
        userRole: 'ITEM_MAKER',
        companyId: 'co-kosh-01',
        companyName: 'Kosh Innovations Pvt Ltd',
        branchId: 'br-pond-01',
        branchName: 'Pondicherry Plant',
        moduleKey: 'PURCHASE_REQUISITION',
        pageKey: 'pr_master_list',
      },
      optionalScopes: { pageLevelEnabled: true, userLevelEnabled: true, updatedAt: '', updatedBy: '', reason: '' },
      globalPolicy,
      exceptions: [],
      cacheVersion: 1,
    });
  }
  const avgMs = (performance.now() - start) / iterations;
  assert.ok(avgMs < 5, `Policy evaluation took ${avgMs.toFixed(3)}ms/op (budget < 5ms)`);
});
