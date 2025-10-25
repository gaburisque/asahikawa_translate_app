type MetricName = 'asr' | 'translate' | 'tts' | 'e2e';

interface Metric { start: number; end?: number; duration?: number }
const metrics: Record<MetricName, Metric> = {
  asr: { start: 0 },
  translate: { start: 0 },
  tts: { start: 0 },
  e2e: { start: 0 },
};

export function markStart(name: MetricName) { metrics[name] = { start: performance.now() }; }
export function markEnd(name: MetricName) {
  const m = metrics[name];
  if (m) { m.end = performance.now(); m.duration = m.end - m.start; }
}
export function logMetrics() {
  // Hook for GA4 integration in future
  console.group('📊 Metrics');
  (Object.keys(metrics) as MetricName[]).forEach((k) => {
    const m = metrics[k];
    if (m.duration != null) console.log(`${k}: ${m.duration.toFixed(1)}ms`);
  });
  console.groupEnd();
}

export function getE2E(): number | undefined {
  return metrics.e2e.duration;
}


