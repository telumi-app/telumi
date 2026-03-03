'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  cn,
} from '@telumi/ui';
import { HugeiconsIcon } from '@hugeicons/react';
import { TextCheckIcon, UnfoldMoreIcon } from '@hugeicons/core-free-icons';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { authApi } from '@/lib/api/auth';
import { type GoalProfile, onboardingApi } from '@/lib/api/onboarding';
import { clearSessionToken, getSessionToken } from '@/lib/auth/session';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  type SetupOnboardingFormData,
  setupOnboardingSchema,
} from '@/lib/validation/onboarding';
import { getCitiesByState, STATE_OPTIONS } from '@/lib/validation/brazil-locations';

const SCREEN_COUNT_OPTIONS = [
  { value: 'ONE_TO_TWO', label: '1-2' },
  { value: 'THREE_TO_FIVE', label: '3-5' },
  { value: 'SIX_TO_TEN', label: '6-10' },
  { value: 'TEN_PLUS', label: '10+' },
] as const;

export default function OnboardingSetupPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [cityOpen, setCityOpen] = useState(false);

  const form = useForm<SetupOnboardingFormData>({
    resolver: zodResolver(setupOnboardingSchema),
    defaultValues: {
      companyName: '',
      city: '',
      state: undefined,
      screenCount: undefined,
      goalProfile: 'INTERNAL',
      wantsToSellImmediately: undefined,
      hasCnpj: undefined,
      cnpj: '',
    },
    mode: 'onChange',
  });

  const goalProfile = form.watch('goalProfile');
  const hasCnpj = form.watch('hasCnpj');
  const selectedState = form.watch('state');

  const cityOptions = useMemo(() => getCitiesByState(selectedState), [selectedState]);

  useEffect(() => {
    const loadSession = async () => {
      const token = getSessionToken();

      if (!token) {
        router.replace('/login');
        return;
      }

      try {
        const response = await authApi.me(token);
        const workspace = response.data?.workspace;

        if (!workspace) {
          router.replace('/login');
          return;
        }

        if (workspace.onboardingCompleted) {
          router.replace('/dashboard');
          return;
        }

        if (workspace.onboardingNextRoute !== '/onboarding/setup') {
          router.replace(workspace.onboardingNextRoute);
          return;
        }

        form.setValue('goalProfile', workspace.goalProfile as GoalProfile);
      } catch {
        clearSessionToken();
        router.replace('/login');
      }
    };

    void loadSession();
  }, [form, router]);

  const isSubmitting = form.formState.isSubmitting;
  const canSubmit = form.formState.isValid;

  const onSubmit = async (values: SetupOnboardingFormData) => {
    setServerError(null);

    try {
      await onboardingApi.setup({
        companyName: values.companyName.trim(),
        city: values.city.trim(),
        state: values.state,
        screenCount: values.screenCount,
        goalProfile: values.goalProfile,
        wantsToSellImmediately: values.goalProfile === 'ADS_SALES' ? values.wantsToSellImmediately : undefined,
        hasCnpj: values.goalProfile === 'ADS_SALES' ? values.hasCnpj : undefined,
        cnpj: values.goalProfile === 'ADS_SALES' && values.hasCnpj ? values.cnpj : undefined,
      });

      await onboardingApi.complete();
      router.push('/dashboard');
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar as configurações iniciais.',
      );
    }
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">Configurações iniciais</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Defina as informações básicas para preparar seu ambiente.
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <FormField
            control={form.control}
            name="companyName"
            render={({ field }) => (
              <FormItem className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between mt-2.5 mb-1.5">
                  <FormLabel className="text-sm font-medium cursor-pointer text-foreground transition-all duration-150 ease-in-out">
                    Nome da empresa
                  </FormLabel>
                  <FormMessage className="text-[11px] font-medium text-destructive mt-0 leading-none" />
                </div>
                <FormControl>
                  <Input placeholder="Ex.: Telumi Mídia" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between mt-2.5 mb-1.5">
                  <FormLabel className="text-sm font-medium cursor-pointer text-foreground transition-all duration-150 ease-in-out">
                    Estado
                  </FormLabel>
                  <FormMessage className="text-[11px] font-medium text-destructive mt-0 leading-none" />
                </div>
                <Select
                  onValueChange={(value) => {
                    field.onChange(value);
                    form.setValue('city', '', {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    });
                  }}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {STATE_OPTIONS.map((state) => (
                      <SelectItem key={state.value} value={state.value}>
                        {state.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between mt-2.5 mb-1.5">
                  <FormLabel className="text-sm font-medium cursor-pointer text-foreground transition-all duration-150 ease-in-out">
                    Cidade
                  </FormLabel>
                  <FormMessage className="text-[11px] font-medium text-destructive mt-0 leading-none" />
                </div>
                <Popover open={cityOpen} onOpenChange={setCityOpen}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={cityOpen}
                        disabled={!selectedState}
                        className={cn(
                          'h-[46px] w-full justify-between rounded-xl border border-input bg-background px-4 py-2 text-sm text-foreground shadow-none transition-colors hover:bg-background hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring',
                          !field.value && 'text-muted-foreground',
                        )}
                      >
                        {field.value || (selectedState ? 'Selecione' : 'Selecione um estado primeiro')}
                        <HugeiconsIcon icon={UnfoldMoreIcon} size={16} className="text-muted-foreground" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar cidade..." className="h-11" />
                      <CommandList className="max-h-[220px]">
                        <CommandEmpty>Nenhuma cidade encontrada.</CommandEmpty>
                        <CommandGroup>
                          {cityOptions.map((city) => (
                            <CommandItem
                              value={city}
                              key={city}
                              onSelect={() => {
                                field.onChange(city);
                                setCityOpen(false);
                              }}
                            >
                              <HugeiconsIcon
                                icon={TextCheckIcon}
                                size={16}
                                className={cn(
                                  'mr-2',
                                  city === field.value ? 'opacity-100' : 'opacity-0',
                                )}
                              />
                              {city}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="screenCount"
            render={({ field }) => (
              <FormItem className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between mt-2.5 mb-1.5">
                  <FormLabel className="text-sm font-medium cursor-pointer text-foreground transition-all duration-150 ease-in-out">
                    Quantidade estimada de telas
                  </FormLabel>
                  <FormMessage className="text-[11px] font-medium text-destructive mt-0 leading-none" />
                </div>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {SCREEN_COUNT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          {goalProfile === 'INTERNAL' ? (
            <p className="text-sm text-muted-foreground">
              Você poderá começar a operar suas telas imediatamente.
            </p>
          ) : (
            <>
              <FormField
                control={form.control}
                name="wantsToSellImmediately"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pretende vender anúncios imediatamente?</FormLabel>
                    <FormControl>
                      <RadioGroup
                        value={
                          typeof field.value === 'boolean'
                            ? field.value
                              ? 'yes'
                              : 'no'
                            : undefined
                        }
                        onValueChange={(value: string) => field.onChange(value === 'yes')}
                        className="grid grid-cols-2 gap-3"
                      >
                        <div className="flex items-center space-x-2 rounded-xl border border-border px-3 py-3">
                          <RadioGroupItem value="yes" id="sell-yes" />
                          <Label htmlFor="sell-yes">Sim</Label>
                        </div>
                        <div className="flex items-center space-x-2 rounded-xl border border-border px-3 py-3">
                          <RadioGroupItem value="no" id="sell-no" />
                          <Label htmlFor="sell-no">Depois</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hasCnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Possui CNPJ?</FormLabel>
                    <FormControl>
                      <RadioGroup
                        value={
                          typeof field.value === 'boolean'
                            ? field.value
                              ? 'yes'
                              : 'no'
                            : undefined
                        }
                        onValueChange={(value: string) => field.onChange(value === 'yes')}
                        className="grid grid-cols-2 gap-3"
                      >
                        <div className="flex items-center space-x-2 rounded-xl border border-border px-3 py-3">
                          <RadioGroupItem value="yes" id="cnpj-yes" />
                          <Label htmlFor="cnpj-yes">Sim</Label>
                        </div>
                        <div className="flex items-center space-x-2 rounded-xl border border-border px-3 py-3">
                          <RadioGroupItem value="no" id="cnpj-no" />
                          <Label htmlFor="cnpj-no">Não</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {hasCnpj && (
                <FormField
                  control={form.control}
                  name="cnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CNPJ</FormLabel>
                      <FormControl>
                        <Input placeholder="00.000.000/0000-00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormDescription>
                Para vender anúncios, será necessário configurar dados financeiros posteriormente.
              </FormDescription>
            </>
          )}

          {serverError && <p className="text-sm font-medium text-destructive">{serverError}</p>}

          <Button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className="w-full h-[46px] rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
          >
            {isSubmitting ? 'Salvando...' : 'Criar meu ambiente'}
          </Button>
        </form>
      </Form>
    </div>
  );
}
