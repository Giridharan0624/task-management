/**
 * Creates an inline Web Worker that ticks every second.
 * Web Workers are NOT throttled in background tabs (unlike setInterval).
 */
let worker: Worker | null = null
let callback: (() => void) | null = null

const WORKER_CODE = `
  let interval = null;
  self.onmessage = function(e) {
    if (e.data === 'start') {
      if (interval) clearInterval(interval);
      interval = setInterval(() => self.postMessage('tick'), 1000);
    } else if (e.data === 'stop') {
      if (interval) clearInterval(interval);
      interval = null;
    }
  };
`

export function startTimerWorker(onTick: () => void) {
  stopTimerWorker()
  callback = onTick

  try {
    const blob = new Blob([WORKER_CODE], { type: 'application/javascript' })
    worker = new Worker(URL.createObjectURL(blob))
    worker.onmessage = () => {
      if (callback) callback()
    }
    worker.postMessage('start')
  } catch {
    // Fallback to setInterval if Workers not available
    const id = setInterval(() => { if (callback) callback() }, 1000)
    worker = { postMessage: () => {}, terminate: () => clearInterval(id), onmessage: null } as unknown as Worker
  }
}

export function stopTimerWorker() {
  if (worker) {
    worker.postMessage('stop')
    worker.terminate()
    worker = null
  }
  callback = null
}
