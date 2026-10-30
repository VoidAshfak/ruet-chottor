'use client';

import {
  MEDIA_FORMATS,
  MEDIA_PURPOSES,
  type MediaAsset,
  type MediaKind,
  type MediaPurpose,
} from '@ruet-chottor/shared';
import { useEffect, useId, useRef, useState } from 'react';
import { InfoTip } from '@/components/guide/InfoTip';
import { Button } from '@/components/ui/button';
import { checkFile, uploadMedia } from '@/lib/media-upload';
import { help } from './help';

type Uploading = { key: string; file: File; progress: number; error?: string };

type MediaUploaderProps = {
  purpose: MediaPurpose;
  /** Checked uploads, in order. Saving the content attaches them. */
  value: MediaAsset[];
  onChange: (assets: MediaAsset[]) => void;
  /** True while any file is still uploading, so the form can wait. */
  onBusyChange?: (busy: boolean) => void;
};

/**
 * Pick, upload and order photos/videos for a piece of content. Files go straight to Cloudinary
 * (lib/media-upload.ts); the parent form only keeps the resulting assets.
 */
export function MediaUploader({ purpose, value, onChange, onBusyChange }: MediaUploaderProps) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<Uploading[]>([]);
  const [notice, setNotice] = useState<string>();
  const rules = MEDIA_PURPOSES[purpose];
  const accept = (rules.kinds as readonly MediaKind[])
    .flatMap((kind) => MEDIA_FORMATS[kind].map((format) => `.${format}`))
    .join(',');
  // Uploads finish one by one, after renders; each must add to the newest list, not a stale one.
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  });

  const setBusy = (list: Uploading[]) => {
    setUploading(list);
    onBusyChange?.(list.some((item) => !item.error));
  };

  const start = (item: Uploading) => {
    void uploadMedia(item.file, purpose, {
      onProgress: (fraction) =>
        setUploading((list) =>
          list.map((entry) => (entry.key === item.key ? { ...entry, progress: fraction } : entry)),
        ),
    })
      .then((asset) => {
        onChange([...latest.current, asset]);
        setUploading((list) => {
          const next = list.filter((entry) => entry.key !== item.key);
          onBusyChange?.(next.some((entry) => !entry.error));
          return next;
        });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        setUploading((list) => {
          const next = list.map((entry) =>
            entry.key === item.key ? { ...entry, error: message } : entry,
          );
          onBusyChange?.(next.some((entry) => !entry.error));
          return next;
        });
      });
  };

  const pick = (files: FileList | null) => {
    setNotice(undefined);
    const room = rules.maxPerItem - value.length - uploading.length;
    const chosen = [...(files ?? [])];
    if (chosen.length > room) setNotice(help.limitReached(rules.maxPerItem));
    const items: Uploading[] = [];
    for (const file of chosen.slice(0, Math.max(0, room))) {
      const checked = checkFile(file, purpose);
      if ('error' in checked) {
        setNotice(`${file.name}: ${checked.error}`);
        continue;
      }
      items.push({ key: crypto.randomUUID(), file, progress: 0 });
    }
    if (items.length === 0) return;
    setBusy([...uploading, ...items]);
    items.forEach(start);
    if (input.current) input.current.value = '';
  };

  const full = value.length + uploading.length >= rules.maxPerItem;

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={full}
          aria-label={help.addLabel(rules.maxPerItem)}
          onClick={() => input.current?.click()}
        >
          {help.add}
        </Button>
        <InfoTip text={help.tip} label={help.tipLabel} />
        <input
          id={inputId}
          ref={input}
          type="file"
          multiple
          accept={accept}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => pick(event.target.files)}
        />
      </div>
      {notice ? (
        <p role="status" className="text-sm text-destructive">
          {notice}
        </p>
      ) : null}

      {value.length + uploading.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {value.map((asset, index) => (
            <li key={asset.id} className="relative overflow-hidden rounded-lg border">
              {asset.thumbnailUrl ? (
                // Cloudinary already serves a small, optimised thumbnail; next/image would resize it again on our server.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={asset.thumbnailUrl}
                  alt={asset.kind === 'video' ? help.video(index + 1) : help.imageAlt(index + 1)}
                  className="aspect-[3/2] w-full object-cover"
                />
              ) : null}
              <Button
                type="button"
                variant="secondary"
                size="xs"
                className="absolute top-1 right-1"
                aria-label={help.removeLabel(help.imageAlt(index + 1))}
                onClick={() => onChange(value.filter((item) => item.id !== asset.id))}
              >
                {help.remove}
              </Button>
            </li>
          ))}
          {uploading.map((item) => (
            <li
              key={item.key}
              className="flex aspect-[3/2] flex-col justify-center gap-1 rounded-lg border p-2 text-xs"
            >
              <span className="truncate">{item.file.name}</span>
              {item.error ? (
                <>
                  <span role="alert" className="text-destructive">
                    {item.error}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        const retry = { ...item, error: undefined, progress: 0 };
                        setBusy(uploading.map((entry) => (entry.key === item.key ? retry : entry)));
                        start(retry);
                      }}
                    >
                      {help.retry}
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      aria-label={help.removeLabel(item.file.name)}
                      onClick={() => setBusy(uploading.filter((entry) => entry.key !== item.key))}
                    >
                      {help.remove}
                    </Button>
                  </div>
                </>
              ) : (
                <span className="text-muted-foreground" aria-live="polite">
                  {item.progress < 1
                    ? help.uploading(Math.round(item.progress * 100))
                    : help.checking}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
