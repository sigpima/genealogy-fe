'use client';

import React from 'react';
import { generationTier, toRoman, type GenerationTier } from '@/lib/tree/generations';
import type { MemberStatus } from '@/lib/tree/member-status';
import type { ZoomLevel } from '@/lib/tree/zoom';

export type MemberCardProps = {
  id: number;
  name: string;
  generation: number;
  level: ZoomLevel;
  status: MemberStatus;
  lifespan: string | null;
  detailState: 'loading' | 'loaded' | 'failed';
  avatarUrl: string | null;
  spouseLabel: string | null;
  childCount: number;
  hasChildren: boolean;
  isCollapsed: boolean;
  hiddenDescendants: number;
  isHighlighted: boolean;
  isSelected: boolean;
  onSelect: (id: number) => void;
  onToggle: (id: number) => void;
};

const COMPACT = { width: 160, height: 56 };
const DETAILED = { width: 240, height: 110 };

function tierColor(tier: GenerationTier): string {
  return `var(--color-tier-${tier})`;
}

function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
}

function statusRing(status: MemberStatus): string {
  if (status === 'living') return 'var(--color-living)';
  if (status === 'deceased') return 'var(--color-deceased)';
  return 'var(--color-border)';
}

export const MemberCard = React.memo(function MemberCard(props: MemberCardProps) {
  const { id, name, generation, level, isHighlighted, isSelected, onSelect } = props;
  const tier = generationTier(generation);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(id);
    }
  };

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${name}, đời ${generation}`}
      style={{ cursor: 'pointer', outline: 'none' }}
      onClick={() => onSelect(id)}
      onKeyDown={handleKeyDown}
    >
      {level === 'dot' ? (
        <DotCard {...props} tier={tier} />
      ) : level === 'compact' ? (
        <CompactCard {...props} tier={tier} emphasized={isHighlighted || isSelected} />
      ) : (
        <DetailedCard {...props} tier={tier} emphasized={isHighlighted || isSelected} />
      )}
    </g>
  );
});

function DotCard({ name, generation, tier, isHighlighted, isSelected }: MemberCardProps & { tier: GenerationTier }) {
  const emphasized = isHighlighted || isSelected;
  return (
    <>
      <title>{`${name} · Đời ${generation}`}</title>
      <circle r={14} fill="transparent" />
      <circle
        r={emphasized ? 11 : 8}
        fill={tierColor(tier)}
        className={emphasized ? 'stroke-primary' : undefined}
        strokeWidth={emphasized ? 3 : 0}
      />
    </>
  );
}

function cardFrame(tier: GenerationTier, emphasized: boolean) {
  const ancestor = tier === 'ancestor';
  return {
    className: `${ancestor ? 'fill-surface-muted' : 'fill-surface'} ${
      emphasized ? 'stroke-primary' : ancestor ? 'stroke-secondary' : 'stroke-border'
    }`,
    strokeWidth: emphasized ? 2.5 : ancestor ? 2 : 1,
  };
}

function GenerationBadge({ generation, tier }: { generation: number; tier: GenerationTier }) {
  return (
    <circle r={12} fill={tierColor(tier)}>
      <title>{`Đời ${generation}`}</title>
    </circle>
  );
}

function ToggleControl({
  id,
  y,
  isCollapsed,
  hiddenDescendants,
  onToggle,
}: Pick<MemberCardProps, 'id' | 'isCollapsed' | 'hiddenDescendants' | 'onToggle'> & { y: number }) {
  return (
    <>
      <g
        role="button"
        tabIndex={0}
        aria-label={isCollapsed ? 'Mở nhánh' : 'Thu nhánh'}
        transform={`translate(0, ${y})`}
        style={{ cursor: 'pointer' }}
        onClick={(event) => {
          event.stopPropagation();
          onToggle(id);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            onToggle(id);
          }
        }}
      >
        <circle r={10} className="fill-primary" />
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={14}
          className="fill-on-primary"
          style={{ pointerEvents: 'none' }}
        >
          {isCollapsed ? '+' : '−'}
        </text>
      </g>
      {isCollapsed && hiddenDescendants > 0 && (
        <g transform={`translate(0, ${y + 24})`} style={{ pointerEvents: 'none' }}>
          <rect x={-46} y={-10} width={92} height={20} rx={10} className="fill-surface-muted stroke-border" />
          <text textAnchor="middle" dominantBaseline="central" fontSize={11} className="fill-muted">
            {`${hiddenDescendants} hậu duệ`}
          </text>
        </g>
      )}
    </>
  );
}

function CompactCard(props: MemberCardProps & { tier: GenerationTier; emphasized: boolean }) {
  const { id, name, generation, tier, emphasized, lifespan, detailState, hasChildren } = props;
  const frame = cardFrame(tier, emphasized);
  const { width, height } = COMPACT;
  return (
    <>
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        rx={8}
        className={frame.className}
        strokeWidth={frame.strokeWidth}
      />
      <g transform="translate(-56, 0)">
        <GenerationBadge generation={generation} tier={tier} />
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={generation >= 10 ? 8 : 9}
          fontWeight={600}
          fill="#ffffff"
          style={{ pointerEvents: 'none' }}
        >
          {toRoman(generation)}
        </text>
      </g>
      <text x={-38} y={lifespan !== null || detailState === 'loading' ? -6 : 0} dominantBaseline="central" fontSize={13} fontWeight={700} className="font-display fill-text">
        {truncate(name, 15)}
      </text>
      {detailState === 'loaded' && lifespan !== null && (
        <text x={-38} y={12} dominantBaseline="central" fontSize={11} className="fill-muted">
          {lifespan}
        </text>
      )}
      {detailState === 'loading' && <rect x={-38} y={8} width={64} height={7} rx={3.5} className="fill-surface-muted" />}
      {hasChildren && (
        <ToggleControl
          id={id}
          y={height / 2}
          isCollapsed={props.isCollapsed}
          hiddenDescendants={props.hiddenDescendants}
          onToggle={props.onToggle}
        />
      )}
    </>
  );
}

function DetailedCard(props: MemberCardProps & { tier: GenerationTier; emphasized: boolean }) {
  const {
    id,
    name,
    generation,
    tier,
    emphasized,
    status,
    lifespan,
    detailState,
    avatarUrl,
    spouseLabel,
    childCount,
    hasChildren,
  } = props;
  const frame = cardFrame(tier, emphasized);
  const { width, height } = DETAILED;
  const clipId = `avatar-clip-${id}`;
  const ring = statusRing(detailState === 'loaded' ? status : 'unknown');
  return (
    <>
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        rx={8}
        className={frame.className}
        strokeWidth={frame.strokeWidth}
        style={{ filter: 'drop-shadow(0 4px 8px rgba(60, 42, 33, 0.08))' }}
      />
      <g transform="translate(-86, -10)">
        {avatarUrl ? (
          <>
            <clipPath id={clipId}>
              <circle r={22} />
            </clipPath>
            <image
              href={avatarUrl}
              x={-22}
              y={-22}
              width={44}
              height={44}
              clipPath={`url(#${clipId})`}
              preserveAspectRatio="xMidYMid slice"
              style={status === 'deceased' ? { filter: 'grayscale(1)' } : undefined}
            />
          </>
        ) : (
          <>
            <circle r={22} className="fill-primary" />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={18}
              className="font-display fill-on-primary"
              style={{ pointerEvents: 'none' }}
            >
              {name.trim().charAt(0).toUpperCase()}
            </text>
          </>
        )}
        <circle r={24} fill="none" stroke={ring} strokeWidth={2.5} />
      </g>
      <text x={-52} y={-30} dominantBaseline="central" fontSize={15} fontWeight={700} className="font-display fill-text">
        {truncate(name, 19)}
      </text>
      <g transform="translate(-52, -10)">
        <rect width={52} height={16} rx={8} fill={tierColor(tier)} />
        <text
          x={26}
          y={8.5}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={10}
          fontWeight={600}
          fill="#ffffff"
          style={{ pointerEvents: 'none' }}
        >
          {`Đời ${toRoman(generation)}`}
        </text>
      </g>
      {detailState === 'loading' ? (
        <rect x={-52} y={12} width={96} height={8} rx={4} className="fill-surface-muted" />
      ) : (
        lifespan !== null && (
          <text x={-52} y={16} dominantBaseline="central" fontSize={12} className="fill-muted">
            {lifespan}
          </text>
        )
      )}
      <line x1={-104} x2={104} y1={31} y2={31} className="stroke-border" strokeWidth={1} />
      {detailState === 'loading' ? (
        <rect x={-104} y={39} width={120} height={8} rx={4} className="fill-surface-muted" />
      ) : (
        <>
          {spouseLabel !== null && (
            <text x={-104} y={42} dominantBaseline="central" fontSize={12} className="fill-muted">
              {truncate(`Phối: ${spouseLabel}`, 22)}
            </text>
          )}
        </>
      )}
      {childCount > 0 && (
        <text x={104} y={42} textAnchor="end" dominantBaseline="central" fontSize={12} fontWeight={600} className="fill-text">
          {`${childCount} con`}
        </text>
      )}
      {hasChildren && (
        <ToggleControl
          id={id}
          y={height / 2}
          isCollapsed={props.isCollapsed}
          hiddenDescendants={props.hiddenDescendants}
          onToggle={props.onToggle}
        />
      )}
    </>
  );
}
