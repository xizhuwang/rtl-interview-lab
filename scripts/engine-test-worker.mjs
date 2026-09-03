import { parentPort } from 'node:worker_threads';
import initIvlpp from '../.engine-cache/ivlpp.js';
import initIvl from '../.engine-cache/ivl.js';
import initVvp from '../.engine-cache/vvp.js';
globalThis.__SOC_RTL_TEST_FACTORIES__ = { initIvlpp, initIvl, initVvp };
globalThis.self = {
  addEventListener: (_, callback) => parentPort.on('message', (data) => callback({ data })),
  postMessage: (data) => parentPort.postMessage(data),
};
await import('../public/engine/worker.js');
parentPort.postMessage({ type: 'TEST_READY' });
