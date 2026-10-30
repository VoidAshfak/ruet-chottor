import {
  MEDIA_FORMATS,
  MEDIA_MAX_BYTES,
  MEDIA_PURPOSES,
  type MediaAsset,
  mediaAssetSchema,
  mediaKindOf,
  type MediaKind,
  type MediaPurpose,
  uploadTicketSchema,
} from '@ruet-chottor/shared';
import { z } from 'zod';
import { apiRequest } from './api-client';

export const mediaText = {
  notAllowed: (kinds: readonly MediaKind[]) =>
    `Allowed here: ${kinds.flatMap((kind) => MEDIA_FORMATS[kind]).join(', ')}`,
  tooLarge: (kind: MediaKind) =>
    `${kind[0]!.toUpperCase()}${kind.slice(1)}s can be at most ${
      MEDIA_MAX_BYTES[kind] / (1024 * 1024)
    } MB`,
  failed: 'Upload failed. Check your connection and try again.',
};

/** Checks a picked file before any upload starts. Returns its kind, or an error message. */
export function checkFile(
  file: Pick<File, 'name' | 'size'>,
  purpose: MediaPurpose,
): { kind: MediaKind } | { error: string } {
  const allowed = MEDIA_PURPOSES[purpose].kinds as readonly MediaKind[];
  const kind = mediaKindOf(file.name);
  if (!kind || !allowed.includes(kind)) return { error: mediaText.notAllowed(allowed) };
  if (file.size > MEDIA_MAX_BYTES[kind]) return { error: mediaText.tooLarge(kind) };
  return { kind };
}

/** POSTs the file straight to Cloudinary, reporting progress (fetch cannot report upload progress). */
function sendToCloudinary(
  url: string,
  form: FormData,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(mediaText.failed));
    xhr.onerror = () => reject(new Error(mediaText.failed));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
    signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(form);
  });
}

/**
 * Uploads one file (ADR 0010): ask the API for a signed ticket, send the file directly to
 * Cloudinary, then let the API check it. Returns the checked asset to attach to content.
 */
export async function uploadMedia(
  file: File,
  purpose: MediaPurpose,
  {
    onProgress = () => {},
    signal,
  }: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<MediaAsset> {
  const checked = checkFile(file, purpose);
  if ('error' in checked) throw new Error(checked.error);

  const ticket = await apiRequest('/media/uploads', uploadTicketSchema, {
    method: 'POST',
    body: { purpose, kind: checked.kind, fileName: file.name, bytes: file.size },
  });
  const form = new FormData();
  for (const [key, value] of Object.entries(ticket.fields)) form.append(key, value);
  form.append('file', file);
  await sendToCloudinary(ticket.uploadUrl, form, onProgress, signal);
  return apiRequest(`/media/uploads/${ticket.assetId}/complete`, mediaAssetSchema, {
    method: 'POST',
  });
}

/** Removes an upload that was not saved with any content. Best effort. */
export async function cancelMedia(assetId: string): Promise<void> {
  await apiRequest(`/media/uploads/${assetId}`, z.undefined(), { method: 'DELETE' }).catch(
    () => undefined,
  );
}
