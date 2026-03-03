'use client';

import { Button } from '@telumi/ui';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useMemo, useState } from 'react';

type ActivationChecklistItem = {
  id: string;
  label: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'done';
  actionRoute: string;
};

type ActivationChecklistProps = {
  items: ActivationChecklistItem[];
};

function StatusIcon({ status }: { status: ActivationChecklistItem['status'] }) {
  if (status === 'done') {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-emerald-600">
          <path d="M1.5 5L3.8 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  if (status === 'in_progress') {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      </span>
    );
  }

  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-background">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/20" />
    </span>
  );
}

export function ActivationChecklist({ items }: ActivationChecklistProps) {
  const [collapsed, setCollapsed] = useState(false);

  const { done, total, progress } = useMemo(() => {
    const done = items.filter((i) => i.status === 'done').length;
    const total = items.length;
    return { done, total, progress: total ? Math.round((done / total) * 100) : 0 };
  }, [items]);

  if (!items.length) return null;

  const isAllDone = done === total;

  return (
    <section className="rounded-xl border border-border/70 bg-card">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
        <div className="space-y-0.5">
          <h2 className="text-[15px] font-semibold text-foreground">Checklist de ativação</h2>
          <p className="text-[13px] text-muted-foreground/70">
            {isAllDone
              ? 'Ambiente configurado. Tudo pronto para uso.'
              : 'Complete os passos abaixo para ativar seu ambiente.'}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed((c) => !c)}
          className="h-7 shrink-0 px-2.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {collapsed ? 'Expandir' : 'Recolher'}
        </Button>
      </div>

      {/* Progress bar */}
      <div className="px-5 pb-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground/50">
            Progresso
          </span>
          <span className="text-[11px] font-semibold tabular-nums text-muted-foreground/60">
            {done} de {total}
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
          <motion.div
            className="h-full rounded-full bg-foreground/80"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border/50" />

      {/* Items */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="overflow-hidden divide-y divide-border/40"
          >
            {items.map((item, index) => (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: index * 0.04 }}
                className={`flex items-start gap-3.5 px-5 py-4 transition-colors ${item.status === 'done' ? 'opacity-50' : 'hover:bg-muted/30'}`}
              >
                <StatusIcon status={item.status} />

                <div className="flex flex-1 items-start justify-between gap-4 min-w-0">
                  <div className="min-w-0 space-y-0.5">
                    <p
                      className={`text-[13.5px] font-medium leading-snug ${item.status === 'done' ? 'text-muted-foreground line-through decoration-muted-foreground/40' : 'text-foreground'}`}
                    >
                      {item.label}
                    </p>
                    {item.description && (
                      <p className="text-[12.5px] leading-relaxed text-muted-foreground/70">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {item.status !== 'done' && (
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="h-7 shrink-0 border-border/60 px-3 text-[11.5px] font-medium text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                    >
                      <Link href={item.actionRoute}>Começar</Link>
                    </Button>
                  )}
                </div>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </section>
  );
}
