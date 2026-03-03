import { TelumiLogo } from '@/components/atoms/telumi-logo';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-[360px] px-4 flex flex-col">
        <div className="pb-8 flex justify-center w-full">
          <TelumiLogo />
        </div>
        {children}
      </div>
    </main>
  );
}
