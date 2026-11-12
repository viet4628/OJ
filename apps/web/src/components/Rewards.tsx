import type { ReactNode } from 'react';
import type { RewardTier } from '../lib/api';

// Reward cosmetics are product content (a game-like prize), so this module is
// the one place allowed to use metallic colours outside the single-accent UI
// palette. Everything else keeps using the design tokens.
const FRAME: Record<RewardTier, string> = {
  gold: 'bg-gradient-to-br from-[#f9e08b] via-[#d4a017] to-[#7a5600] shadow-[0_0_14px_rgba(212,160,23,0.45)]',
  silver: 'bg-gradient-to-br from-[#f4f6f9] via-[#a7b2c0] to-[#5b6676] shadow-[0_0_12px_rgba(167,178,192,0.4)]',
  bronze: 'bg-gradient-to-br from-[#f2b884] via-[#b0652a] to-[#62340f] shadow-[0_0_12px_rgba(176,101,42,0.35)]',
  participant: 'bg-[var(--accent)]',
};
const BANNER: Record<RewardTier, string> = {
  gold: 'bg-gradient-to-r from-[#2b1d00] via-[#a8780a] to-[#f4d26b]',
  silver: 'bg-gradient-to-r from-[#1f2630] via-[#6f7c8c] to-[#dfe5ec]',
  bronze: 'bg-gradient-to-r from-[#2a1406] via-[#8f4f1d] to-[#e8a66b]',
  participant: 'bg-gradient-to-r from-accent/70 via-accent/40 to-accent/10',
};

/** Tier of a catalog id such as "frame-gold"; null when nothing is equipped. */
export function rewardTier(rewardId: string | null | undefined): RewardTier | null {
  const tier = rewardId?.split('-').pop();
  return tier && tier in FRAME ? (tier as RewardTier) : null;
}

/** Wraps an avatar with the equipped frame; renders the avatar alone without one. */
export function AvatarFrame({ frame, children, className = '' }: { frame?: string | null; children: ReactNode; className?: string }) {
  const tier = rewardTier(frame);
  if (!tier) return <>{children}</>;
  return <div className={`rounded-full p-[4px] ${FRAME[tier]} ${className}`}>{children}</div>;
}

/** Profile backdrop from the equipped banner (decorative). */
export function ProfileBanner({ banner, className = '' }: { banner?: string | null; className?: string }) {
  const tier = rewardTier(banner);
  if (!tier) return null;
  return <div aria-hidden="true" className={`${BANNER[tier]} ${className}`} />;
}

/** Small visual sample of a reward for lists and pickers. */
export function RewardSwatch({ rewardId }: { rewardId: string }) {
  const tier = rewardTier(rewardId) ?? 'participant';
  return rewardId.startsWith('banner-')
    ? <span aria-hidden="true" className={`inline-block h-6 w-12 rounded ${BANNER[tier]}`} />
    : <span aria-hidden="true" className={`inline-flex h-7 w-7 items-center justify-center rounded-full p-[3px] ${FRAME[tier]}`}><span className="h-full w-full rounded-full bg-[var(--bg-secondary)]" /></span>;
}
