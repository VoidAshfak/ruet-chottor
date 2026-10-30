import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { ContentStatus } from '@ruet-chottor/shared';
import {
  type ModeratableContent,
  ModeratableContentRegistry,
  type ModeratableItem,
} from '../../core/moderation/moderatable-content.registry.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';

/** Lets members report a listing and moderators hide, remove or restore it (ADR 0009). */
@Injectable()
export class MarketplaceModeration implements ModeratableContent, OnModuleInit {
  readonly type = 'marketplace.listing' as const;
  readonly label = 'Marketplace listing';

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ModeratableContentRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  async canReport(_userId: string, listingId: string): Promise<boolean> {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    return listing?.status === 'visible';
  }

  async load(listingId: string): Promise<ModeratableItem | null> {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) return null;
    const price = listing.priceTaka === 0 ? 'Free' : `৳${listing.priceTaka}`;
    return {
      authorId: listing.createdById,
      preview: `${listing.title} (${price})\n\n${listing.description}`,
      status: listing.status,
      context: 'Marketplace',
      link: `/marketplace/${listing.id}`,
    };
  }

  /** Restoring a held listing publishes it, so the "held" note goes away too. */
  async setStatus(listingId: string, status: ContentStatus): Promise<void> {
    await this.prisma.listing.update({
      where: { id: listingId },
      data: { status, ...(status === 'visible' ? { heldTerm: null } : {}) },
    });
  }
}
