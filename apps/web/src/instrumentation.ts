/**
 * Honeycomb browser instrumentation.
 * Imported at the top of main.tsx — before React mounts —
 * so page load, fetch, and user interaction spans are captured.
 *
 * Set VITE_HONEYCOMB_API_KEY in your .env file.
 */
import { HoneycombWebSDK } from '@honeycombio/opentelemetry-web';
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';

const apiKey = import.meta.env.VITE_HONEYCOMB_API_KEY as string;

if (!apiKey) {
  console.warn(
    '[Honeycomb] VITE_HONEYCOMB_API_KEY is not set — traces will not be exported. ' +
      'Copy .env to .env and add your API key.',
  );
}

const sdk = new HoneycombWebSDK({
  apiKey,
  serviceName: 'circleci-web',
  instrumentations: [
    getWebAutoInstrumentations({
      // Auto-instruments fetch, XHR, document-load, user-interaction
      '@opentelemetry/instrumentation-user-interaction': {
        eventNames: ['click'],
      },
    }),
  ],
});

sdk.start();
