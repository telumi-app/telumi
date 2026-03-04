'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import type { IconSvgElement } from '@hugeicons/react';
import {
  ArrowRight02Icon,
  Calendar01Icon,
  CreditCardIcon,
  IdVerifiedIcon,
  InformationCircleIcon,
  Mail01Icon,
  NotificationBubbleIcon,
  ShieldKeyIcon,
  UserCircleIcon,
} from '@hugeicons/core-free-icons';

import { useCurrentUser } from '@/hooks/use-current-user';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { authApi } from '@/lib/api/auth';
import { getSessionToken } from '@/lib/auth/session';

function roleLabel(role: string | undefined): string {
  switch (role) {
    case 'ADMIN': return 'Administrador';
    case 'OPERATOR': return 'Operador';
    default: return role ?? '—';
  }
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}

function getInitials(name: string | null | undefined): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

interface MenuItemProps {
  label: string;
  icon: IconSvgElement;
  active?: boolean;
}

function MenuItem({ label, icon, active = false }: MenuItemProps) {
  return (
    <button
      type="button"
      className={[
        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
        active
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
      ].join(' ')}
    >
      <HugeiconsIcon icon={icon} size={16} />
      <span>{label}</span>
    </button>
  );
}

interface DataFieldProps {
  label: string;
  value: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
}

function DataField({ label, value, disabled = true, onChange }: DataFieldProps) {
  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <Input
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        disabled={disabled}
        className="h-8 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
      />
    </div>
  );
}

interface AccountFormState {
  name: string;
  email: string;
  role: string;
  workspace: string;
}

function buildInitialForm(user: ReturnType<typeof useCurrentUser>['user']): AccountFormState {
  return {
    name: user?.name ?? '',
    email: user?.email ?? '',
    role: roleLabel(user?.role),
    workspace: user?.workspace?.name ?? '',
  };
}

export default function ContaPage() {
  const { user, loading } = useCurrentUser();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<AccountFormState>({
    name: '',
    email: '',
    role: '',
    workspace: '',
  });

  useEffect(() => {
    setForm(buildInitialForm(user));
  }, [user]);

  useEffect(() => {
    if (!saveSuccess) return;
    const timeoutId = window.setTimeout(() => setSaveSuccess(null), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [saveSuccess]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
  }

  const fullName = form.name || 'Usuário Telumi';
  const email = form.email || '—';
  const workspace = form.workspace || '—';
  const memberSince = formatDate(user?.createdAt);
  const accountId = user?.id ?? '—';
  const role = form.role || roleLabel(user?.role);

  const handleFieldChange = (field: keyof AccountFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleStartEdit = () => {
    setSaveError(null);
    setSaveSuccess(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setForm(buildInitialForm(user));
    setSaveError(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    const token = getSessionToken();

    if (!token) {
      setSaveError('Sessão expirada. Faça login novamente.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await authApi.updateMe(
        {
          name: form.name.trim(),
          email: form.email.trim(),
          workspaceName: form.workspace.trim(),
        },
        token,
      );

      const updatedUser = response.data;

      if (updatedUser) {
        setForm({
          name: updatedUser.name ?? '',
          email: updatedUser.email,
          role: roleLabel(updatedUser.role),
          workspace: updatedUser.workspace.name,
        });
      }

      setSaveSuccess('Dados atualizados com sucesso.');
      setIsEditing(false);
      window.dispatchEvent(new Event('telumi:user-updated'));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Não foi possível salvar os dados.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="p-6"
    >
      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Card className="h-fit gap-0 p-3">
          <div className="border-b border-border px-2 pb-3">
            <h2 className="text-base font-semibold text-foreground">Conta</h2>
            <p className="mt-1 text-xs text-muted-foreground">Configurações do perfil</p>
          </div>

          <div className="mt-3 space-y-1">
            <MenuItem label="Perfil" icon={UserCircleIcon} active />
            <MenuItem label="Segurança" icon={ShieldKeyIcon} />
            <MenuItem label="Notificações" icon={NotificationBubbleIcon} />
            <MenuItem label="Cobrança" icon={CreditCardIcon} />
            <MenuItem label="Dados da conta" icon={InformationCircleIcon} />
          </div>
        </Card>

        <Card className="gap-0 overflow-hidden p-0">
          <div className="h-32 bg-muted" />

          <div className="px-5 pb-5">
            <div className="-mt-10 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
              <div className="flex items-end gap-3">
                <Avatar className="h-20 w-20 border-4 border-background">
                  <AvatarFallback className="text-base font-semibold">
                    {getInitials(fullName)}
                  </AvatarFallback>
                </Avatar>

                <div className="pb-1">
                  <h1 className="text-xl font-semibold text-foreground">{fullName}</h1>
                  <p className="text-sm text-muted-foreground">{role}</p>
                </div>
              </div>

              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={handleCancelEdit} disabled={isSaving}>
                    Cancelar
                  </Button>
                  <Button type="button" size="sm" onClick={() => void handleSave()} disabled={isSaving}>
                    {isSaving ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={handleStartEdit}>
                  <HugeiconsIcon icon={ArrowRight02Icon} size={14} />
                  Editar
                </Button>
              )}
            </div>

            <section className="mt-5">
              <div className="mb-3">
                <h2 className="text-sm font-semibold text-foreground">Informações da conta</h2>
                <p className="text-xs text-muted-foreground">Dados principais do seu perfil Telumi</p>
              </div>

              {saveError && (
                <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {saveError}
                </div>
              )}

              {saveSuccess && (
                <div className="mb-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                  {saveSuccess}
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <DataField
                  label="Nome completo"
                  value={fullName}
                  disabled={!isEditing}
                  onChange={(value) => handleFieldChange('name', value)}
                />
                <DataField
                  label="E-mail"
                  value={email}
                  disabled={!isEditing}
                  onChange={(value) => handleFieldChange('email', value)}
                />
                <DataField
                  label="Cargo"
                  value={role}
                  disabled
                />
                <DataField
                  label="Workspace"
                  value={workspace}
                  disabled={!isEditing}
                  onChange={(value) => handleFieldChange('workspace', value)}
                />
                <DataField label="ID da conta" value={accountId} disabled />
                <DataField label="Membro desde" value={memberSince} disabled />
                <DataField label="Status" value="Conta ativa" disabled />
              </div>
            </section>

            <div className="mt-4 border-t border-border pt-4">
              <button
                type="button"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <HugeiconsIcon icon={IdVerifiedIcon} size={14} />
                Configurar segurança da conta
              </button>
            </div>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}
