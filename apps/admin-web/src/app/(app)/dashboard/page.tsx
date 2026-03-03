'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ActivationChecklist } from '@/components/organisms/dashboard/activation-checklist';
import { KpiCards } from '@/components/organisms/dashboard/kpi-cards';
import { authApi } from '@/lib/api/auth';
import { clearSessionToken, getSessionToken } from '@/lib/auth/session';

const pageVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' as const } },
};

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [checklist, setChecklist] = useState<
    Array<{
      id: string;
      label: string;
      description?: string;
      status: 'pending' | 'in_progress' | 'done';
      actionRoute: string;
    }>
  >([]);

  useEffect(() => {
    const load = async () => {
      const token = getSessionToken();

      if (!token) {
        router.replace('/login');
        return;
      }

      try {
        const response = await authApi.me(token);
        const user = response.data;

        if (!user) {
          router.replace('/login');
          return;
        }

        if (!user.workspace.onboardingCompleted) {
          router.replace(user.workspace.onboardingNextRoute);
          return;
        }

        setUserName(user.name ?? user.email);
        setChecklist(user.workspace.activationChecklist);
      } catch {
        clearSessionToken();
        router.replace('/login');
        return;
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground/60">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/30" />
        Carregando...
      </div>
    );
  }

  const hour = new Date().getHours();
  let greeting = 'Bom dia';
  if (hour >= 12 && hour < 18) greeting = 'Boa tarde';
  if (hour >= 18) greeting = 'Boa noite';

  const firstName = userName.split(' ')[0];
  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-8"
    >
      {/* Greeting */}
      <motion.section
        variants={sectionVariants}
        className="flex items-end justify-between gap-4 border-b border-border/50 pb-6"
      >
        <div className="space-y-1">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/45">
            Meu Ambiente
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[1.75rem]">
            {greeting}, {firstName}
          </h1>
          <p className="text-[13px] text-muted-foreground/65">
            Gerencie suas telas, campanhas e conteúdo.
          </p>
        </div>
        <p className="shrink-0 text-[11px] tabular-nums text-muted-foreground/40 capitalize hidden sm:block">
          {today}
        </p>
      </motion.section>

      {/* KPIs */}
      <motion.div variants={sectionVariants}>
        <KpiCards />
      </motion.div>

      {/* Checklist */}
      <motion.div variants={sectionVariants}>
        <ActivationChecklist items={checklist} />
      </motion.div>
    </motion.div>
  );
}
