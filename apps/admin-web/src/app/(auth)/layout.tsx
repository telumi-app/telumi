'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useRef, useEffect, useState } from 'react';
import { TelumiLogo } from '@/components/atoms/telumi-logo';

const routes = {
  '/forgot-password': 0,
  '/login': 1,
  '/register': 2,
};

// Helper para pegar o índice da rota
const getRouteIndex = (pathname: string | null) => {
  if (!pathname) return 0;
  // Verifica qual chave de rota está contida no pathname atual
  const routeKey = Object.keys(routes).find(route => pathname.includes(route));
  return routeKey ? routes[routeKey as keyof typeof routes] : 0;
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [prevPath, setPrevPath] = useState(pathname);
  const [direction, setDirection] = useState(1);

  // Deriva o estado de transição se o pathname mudar
  if (pathname !== prevPath) {
    const currentIndex = getRouteIndex(pathname);
    const prevIndex = getRouteIndex(prevPath);
    setDirection(currentIndex >= prevIndex ? 1 : -1);
    setPrevPath(pathname);
  }

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 40 : -40,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -40 : 40,
      opacity: 0,
    }),
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center">
      <div className="w-full max-w-[360px] px-4 flex flex-col">
        {/* Logo fixo para uma transição mais limpa style ElevenLabs */}
        <div className="pb-8 flex justify-center w-full">
          <TelumiLogo />
        </div>

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={pathname}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              duration: 0.4,
              ease: [0.33, 1, 0.68, 1],
            }}
            className="w-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
