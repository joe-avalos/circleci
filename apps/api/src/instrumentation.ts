/**
 * OpenTelemetry instrumentation — must be imported BEFORE any other module
 * in main.ts so that NestJS's HTTP server and all outgoing calls are patched.
 *
 * Sends traces to Honeycomb via OTLP/HTTP.
 * Set HONEYCOMB_API_KEY in your .env file.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    'service.name': 'circleci-api',
    'service.version': '1.0.0',
    // Populated automatically when running inside a CircleCI job.
    // Undefined locally — OTel drops undefined attributes silently.
    'circleci.branch':      process.env.CIRCLE_BRANCH,
    'circleci.build_num':   process.env.CIRCLE_BUILD_NUM,
    'circleci.job':         process.env.CIRCLE_JOB,
    'circleci.pipeline_id': process.env.CIRCLE_PIPELINE_ID,
    'circleci.workflow_id': process.env.CIRCLE_WORKFLOW_ID,
    'circleci.sha':         process.env.CIRCLE_SHA1,
  }),
  traceExporter: new OTLPTraceExporter({
    url: 'https://api.honeycomb.io/v1/traces',
    headers: {
      'x-honeycomb-team': process.env.HONEYCOMB_API_KEY ?? '',
    },
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown().finally(() => process.exit(0));
});
