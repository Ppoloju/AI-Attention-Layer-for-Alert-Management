import { timingSafeEqual } from 'node:crypto';

export function isValidEventIngestionKey(
  authorizationHeader: string | null,
  expectedKey = process.env.EVENT_INGESTION_API_KEY
): boolean {
  if (!expectedKey || !authorizationHeader?.startsWith('Bearer ')) {
    return false;
  }

  const providedKey = Buffer.from(authorizationHeader.slice('Bearer '.length));
  const configuredKey = Buffer.from(expectedKey);

  return (
    providedKey.length === configuredKey.length &&
    timingSafeEqual(providedKey, configuredKey)
  );
}
