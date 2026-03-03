'use client';

import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  ActivityIcon,
  MegaphoneIcon,
  PlaySquareIcon,
  TvSmartIcon,
} from '@hugeicons/core-free-icons';
import { motion } from 'framer-motion';

// TODO: substituir com dados reais da API (GET /v1/workspace/stats)
const MOCK_STATS = {
  screens: { total: 12, online: 9, offline: 3 },
  campaigns: { active: 4, scheduled: 2 },
  media: { total: 87 },
  uptime: { value: '99.2', period: 'últimos 7 dias' },
};

interface SubStat {
  label: string;
  dot: 'emerald' | 'red' | 'amber' | 'neutral';
}

interface KpiCardData {
  icon: IconSvgElement;
  label: string;
  value: string | number;
  unit?: string;
  subStats: SubStat[];
}

const cards: KpiCardData[] = [
  {
    icon: TvSmartIcon,
    label: 'Telas',
    value: MOCK_STATS.screens.total,
    subStats: [
      { label: `${MOCK_STATS.screens.online} online`, dot: 'emerald' },
      { label: `${MOCK_STATS.screens.offline} offline`, dot: 'red' },
    ],
  },
  {
    icon: MegaphoneIcon,
    label: 'Campanhas',
    value: MOCK_STATS.campaigns.active,
    subStats: [
      { label: 'em exibição', dot: 'emerald' },
      { label: `${MOCK_STATS.campaigns.scheduled} agendadas`, dot: 'amber' },
    ],
  },
  {
    icon: PlaySquareIcon,
    label: 'Mídias',
    value: MOCK_STATS.media.total,
    subStats: [{ label: 'arquivos cadastrados', dot: 'neutral' }],
  },
  {
    icon: ActivityIcon,
    label: 'Uptime',
    value: MOCK_STATS.uptime.value,
    unit: '%',
    subStats: [{ label: MOCK_STATS.uptime.period, dot: 'neutral' }],
  },
];

const DOT_CLASSES: Record<SubStat['dot'], string> = {
  emerald: 'bg-emerald-500',
  red: 'bg-red-400',
  amber: 'bg-amber-400',
  neutral: 'bg-muted-foreground/25',
};

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.38,
      delay: i * 0.075,
      ease: EASE,
    },
  }),
};

function KpiCard({ card, index }: { card: KpiCardData; index: number }) {
  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      className="flex flex-col justify-between gap-5 rounded-xl border border-border/70 bg-card p-5 transition-shadow hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/55">
          {card.label}
        </p>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground/60">
          <HugeiconsIcon icon={card.icon} size={13} />
        </span>
      </div>

      <div className="flex items-baseline gap-0.5 tabular-nums">
        <span className="text-[2.5rem] font-semibold leading-none tracking-tight text-foreground">
          {card.value}
        </span>
        {card.unit && (
          <span className="text-xl font-medium text-muted-foreground/60">{card.unit}</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {card.subStats.map((stat) => (
          <span
            key={stat.label}
            className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground"
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASSES[stat.dot]}`} />
            {stat.label}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

export function KpiCards() {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
    >
      {cards.map((card, index) => (
        <KpiCard key={card.label} card={card} index={index} />
      ))}
    </motion.div>
  );
}
