'use client';

import * as React from 'react';

type PlayerStartupScreenProps = {
  stage: 'runtime' | 'manifest' | 'render';
  deviceName?: string;
  workspaceName?: string;
  locationName?: string;
  isOffline: boolean;
};

const STAGE_COPY: Record<PlayerStartupScreenProps['stage'], { eyebrow: string; title: string; description: string }> = {
  runtime: {
    eyebrow: 'Boot local',
    title: 'Preparando o runtime da tela',
    description: 'Ajustando cache, perfil do dispositivo e serviços locais para iniciar a programação com estabilidade.',
  },
  manifest: {
    eyebrow: 'Sincronização',
    title: 'Carregando a fila criativa',
    description: 'Buscando a programação publicada e validando a melhor versão disponível para esta tela.',
  },
  render: {
    eyebrow: 'Warm-up',
    title: 'Aquecendo a primeira reprodução',
    description: 'Pré-carregando a mídia inicial para evitar troca brusca e começar a exibição de forma saudável.',
  },
};

export function PlayerStartupScreen({ stage, deviceName, workspaceName, locationName, isOffline }: PlayerStartupScreenProps) {
  const copy = STAGE_COPY[stage];

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(129,140,248,0.24),_transparent_38%),linear-gradient(180deg,_#070b16_0%,_#02040a_100%)] text-white">
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:36px_36px]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-indigo-500/10 to-transparent" />

      <div className="relative flex min-h-screen flex-col justify-between px-8 py-10 md:px-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-indigo-200/70">Telumi Player</p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              {deviceName ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{deviceName}</span> : null}
              {locationName ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{locationName}</span> : null}
              {workspaceName ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{workspaceName}</span> : null}
            </div>
          </div>

          <div className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${
            isOffline
              ? 'border-amber-400/30 bg-amber-400/10 text-amber-200'
              : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
          }`}>
            {isOffline ? 'Offline resiliente' : 'Online'}
          </div>
        </div>

        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{copy.eyebrow}</p>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-[-0.04em] text-white md:text-6xl">
            {copy.title}
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-6 text-slate-300 md:text-base">
            {copy.description}
          </p>

          <div className="mt-10 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-[0_0_40px_rgba(99,102,241,0.16)]">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-300/30 border-t-indigo-300" />
            </div>
            <div className="flex-1 space-y-3">
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-1/2 animate-[playerBootPulse_2.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-indigo-400 via-cyan-300 to-emerald-300" />
              </div>
              <div className="flex gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-300" />
                <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300 [animation-delay:180ms]" />
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300 [animation-delay:360ms]" />
              </div>
            </div>
          </div>
        </div>

        <style jsx>{`
          @keyframes playerBootPulse {
            0% { transform: translateX(-30%); opacity: 0.72; }
            50% { transform: translateX(55%); opacity: 1; }
            100% { transform: translateX(130%); opacity: 0.72; }
          }
        `}</style>
      </div>
    </div>
  );
}
