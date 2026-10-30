import { Injectable } from '@nestjs/common';
import type { ContentStatus, ModeratableContentType } from '@ruet-chottor/shared';

/** What staff see about one reported item: only the item itself, never its surroundings. */
export interface ModeratableItem {
  authorId: string;
  /** The reported text, even if the author has since deleted it. */
  preview: string;
  status: ContentStatus;
  /** Short context, e.g. "Group chat". */
  context: string;
}

/**
 * A content module's adapter for moderation (the add-moderation skill). Registered from the content
 * module's `onModuleInit`, so the moderation module never imports content internals and each
 * content module still works when moderation is switched off.
 */
export interface ModeratableContent {
  type: ModeratableContentType;
  /** e.g. "Chat message". */
  label: string;
  /** Only people who can see an item may report it (e.g. members of the conversation). */
  canReport(userId: string, contentId: string): Promise<boolean>;
  load(contentId: string): Promise<ModeratableItem | null>;
  /** Also tells open clients, e.g. over a socket. */
  setStatus(contentId: string, status: ContentStatus): Promise<void>;
}

@Injectable()
export class ModeratableContentRegistry {
  private readonly providers = new Map<ModeratableContentType, ModeratableContent>();

  register(provider: ModeratableContent) {
    this.providers.set(provider.type, provider);
  }

  /** Undefined when the module that owns the type is switched off. */
  get(type: ModeratableContentType): ModeratableContent | undefined {
    return this.providers.get(type);
  }
}
