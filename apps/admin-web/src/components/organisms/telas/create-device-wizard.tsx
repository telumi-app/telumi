'use client';

import * as React from 'react';

const PLAYER_BASE_URL = (
  process.env.NEXT_PUBLIC_PLAYER_URL || 'https://player.telumi.com.br'
).replace(/\/$/, '');
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRightBigIcon, ArrowLeftBigIcon, RefreshIcon, ClipboardIcon, TextCheckIcon, PlusSignIcon } from '@hugeicons/core-free-icons';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { devicesApi, type Device } from '@/lib/api/devices';
import { locationsApi, type Location } from '@/lib/api/locations';
import {
  createDeviceSchema,
  type DeviceOperationalStatus,
  type DeviceOrientation,
} from '@/lib/validation/devices';
import { createLocationSchema } from '@/lib/validation/locations';
import {
  MapsProvider,
  type MapsProviderErrorKind,
} from '@/components/maps/maps-provider';
import {
  LocationAutocomplete,
  type SelectedLocationPlace,
} from '@/components/maps/location-autocomplete';
import { LocationMapPreview } from '@/components/maps/location-map-preview';
import { type MeResponseData } from '@/lib/api/auth';

type CreateDeviceWizardProps = {
  initialAction?: 'create-screen' | 'add-location';
  onCreated: (device: Device) => void;
  onCancel: () => void;
  workspace?: MeResponseData['workspace'] | null;
};

type WizardMode = 'CREATE_LOCATION_FIRST' | 'SELECT_LOCATION';

function normalizeDeviceError(message: string) {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('já existe') || lowerMessage.includes('duplicate')) {
    return 'Já existe uma tela com esse nome neste ambiente.';
  }

  if (lowerMessage.includes('limite') || lowerMessage.includes('limit')) {
    return 'Limite de telas atingido. Ajuste seu plano para adicionar mais telas.';
  }

  if (lowerMessage.includes('expir') || lowerMessage.includes('expired')) {
    return 'O código expirou. Gere um novo para continuar.';
  }

  return message;
}

function normalizeLocationError(message: string) {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('já existe') || lowerMessage.includes('duplicate')) {
    return 'Já existe um local com esse nome neste ambiente.';
  }

  return message;
}

export function CreateDeviceWizard({
  initialAction = 'create-screen',
  onCreated,
  onCancel,
  workspace,
}: CreateDeviceWizardProps) {
  const [loadingLocations, setLoadingLocations] = React.useState(true);
  const [locations, setLocations] = React.useState<Location[]>([]);
  const [mode, setMode] = React.useState<WizardMode>('SELECT_LOCATION');
  const [step, setStep] = React.useState(1);
  const [isAddingLocationInline, setIsAddingLocationInline] = React.useState(false);

  const [locationName, setLocationName] = React.useState('');
  const [locationAddress, setLocationAddress] = React.useState('');
  const [locationCity, setLocationCity] = React.useState<string | null>(null);
  const [locationState, setLocationState] = React.useState<string | null>(null);
  const [locationLatitude, setLocationLatitude] = React.useState<number | null>(null);
  const [locationLongitude, setLocationLongitude] = React.useState<number | null>(null);
  const [locationPlaceId, setLocationPlaceId] = React.useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = React.useState('');
  const [createdLocationId, setCreatedLocationId] = React.useState<string | null>(null);
  const [deviceName, setDeviceName] = React.useState('');
  const [deviceOrientation, setDeviceOrientation] = React.useState<DeviceOrientation>('HORIZONTAL');
  const [deviceResolution, setDeviceResolution] = React.useState('AUTO');
  const [deviceOperationalStatus, setDeviceOperationalStatus] = React.useState<DeviceOperationalStatus>('ACTIVE');
  const [deviceIsPublic, setDeviceIsPublic] = React.useState(false);
  const [deviceIsPartnerTv, setDeviceIsPartnerTv] = React.useState(false);
  const [devicePartnerName, setDevicePartnerName] = React.useState('');
  const [devicePartnerSharePct, setDevicePartnerSharePct] = React.useState<number | ''>('');

  const [locationError, setLocationError] = React.useState('');
  const [deviceNameError, setDeviceNameError] = React.useState('');
  const [selectedLocationError, setSelectedLocationError] = React.useState('');
  const [deviceConfigError, setDeviceConfigError] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isCreatingLocation, setIsCreatingLocation] = React.useState(false);
  const [isRegeneratingCode, setIsRegeneratingCode] = React.useState(false);
  const [error, setError] = React.useState('');
  const [createdDevice, setCreatedDevice] = React.useState<Device | null>(null);
  const [copied, setCopied] = React.useState(false);

  const resetLocationDraft = React.useCallback(() => {
    setLocationName('');
    setLocationAddress('');
    setLocationCity(null);
    setLocationState(null);
    setLocationLatitude(null);
    setLocationLongitude(null);
    setLocationPlaceId(null);
    setLocationError('');
  }, []);

  React.useEffect(() => {
    let mounted = true;

    const loadLocations = async () => {
      setLoadingLocations(true);
      setError('');

      try {
        const response = await locationsApi.list();
        if (!mounted) return;

        const data = response.data ?? [];
        setLocations(data);

        if (data.length === 0) {
          setMode('CREATE_LOCATION_FIRST');
          setStep(1);
          setIsAddingLocationInline(false);
        } else {
          setMode('SELECT_LOCATION');
          setSelectedLocationId(data.length === 1 ? data[0]!.id : '');
          setStep(1);
          setIsAddingLocationInline(initialAction === 'add-location');
        }
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Erro ao carregar locais.');
      } finally {
        if (mounted) {
          setLoadingLocations(false);
        }
      }
    };

    void loadLocations();

    return () => {
      mounted = false;
    };
  }, [initialAction]);

  const currentStepCount = mode === 'CREATE_LOCATION_FIRST' ? 3 : 2;
  const progressValue = (step / currentStepCount) * 100;
  const fieldClassName = 'mt-1 h-[46px] rounded-xl focus-visible:ring-0 focus-visible:ring-transparent focus-visible:border-input';
  const selectFieldClassName = 'mt-1 h-[46px] w-full rounded-xl focus-visible:ring-0 focus-visible:ring-transparent focus-visible:border-input';

  const validateCreateLocationStep = () => {
    setLocationError('');

    const parsed = createLocationSchema.safeParse({
      name: locationName,
      address: locationAddress || undefined,
      latitude: locationLatitude ?? undefined,
      longitude: locationLongitude ?? undefined,
      placeId: locationPlaceId ?? undefined,
    });

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setLocationError(issue?.message ?? 'Preencha os dados do local corretamente.');
      return false;
    }

    return true;
  };

  const validateDeviceStep = () => {
    setDeviceNameError('');
    setSelectedLocationError('');
    setDeviceConfigError('');

    const parsed = createDeviceSchema.safeParse({
      name: deviceName,
      locationId: selectedLocationId || createdLocationId || '',
      orientation: deviceOrientation,
      resolution: deviceResolution,
      operationalStatus: deviceOperationalStatus,
      isPublic: deviceIsPublic,
      isPartnerTv: deviceIsPartnerTv,
      partnerName: deviceIsPartnerTv ? devicePartnerName : undefined,
      partnerRevenueSharePct: deviceIsPartnerTv && devicePartnerSharePct !== '' ? devicePartnerSharePct : undefined,
    });

    if (!parsed.success) {
      const nameIssue = parsed.error.issues.find((issue) => issue.path[0] === 'name');
      const locationIssue = parsed.error.issues.find((issue) => issue.path[0] === 'locationId');

      if (nameIssue) {
        setDeviceNameError(nameIssue.message);
      }

      if (locationIssue) {
        setSelectedLocationError(locationIssue.message);
      }

      const configIssue = parsed.error.issues.find((issue) => {
        const field = issue.path[0];
        return field !== 'name' && field !== 'locationId';
      });

      if (configIssue) {
        setDeviceConfigError(configIssue.message);
      }

      return false;
    }

    return true;
  };

  const createScreen = async () => {
    setError('');
    setIsSubmitting(true);

    try {
      const locationId = createdLocationId ?? selectedLocationId;

      const response = await devicesApi.create({
        name: deviceName.trim(),
        locationId,
        orientation: deviceOrientation,
        resolution: deviceResolution,
        operationalStatus: deviceOperationalStatus,
        isPublic: deviceIsPublic,
        isPartnerTv: deviceIsPartnerTv,
        partnerName: deviceIsPartnerTv ? devicePartnerName.trim() : undefined,
        partnerRevenueSharePct: deviceIsPartnerTv && devicePartnerSharePct !== '' ? Number(devicePartnerSharePct) : undefined,
      });

      if (response.data) {
        setCreatedDevice(response.data);
        setStep(mode === 'CREATE_LOCATION_FIRST' ? 3 : 2);
        onCreated(response.data);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar tela.';
      setError(normalizeDeviceError(errorMessage));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitCreateScreen = async () => {
    if (!validateDeviceStep()) return;
    await createScreen();
  };

  const handleCopyCode = async () => {
    if (!createdDevice?.pairingCode) return;
    try {
      await navigator.clipboard.writeText(createdDevice.pairingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  const handleRegenerateCode = async () => {
    if (!createdDevice) return;

    setError('');
    setIsRegeneratingCode(true);

    try {
      const response = await devicesApi.regenerateCode(createdDevice.id);

      if (response.data) {
        const regeneratedCode = response.data;
        setCreatedDevice((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            pairingCode: regeneratedCode.pairingCode,
            pairingExpiresAt: regeneratedCode.pairingExpiresAt,
          };
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao regenerar código.';
      setError(normalizeDeviceError(errorMessage));
    } finally {
      setIsRegeneratingCode(false);
    }
  };

  const createLocationFromDraft = (options: { advanceToNextStep: boolean }) => {
    if (!validateCreateLocationStep()) return;

    setError('');
    setIsCreatingLocation(true);

    void locationsApi
      .create({
        name: locationName.trim(),
        address: locationAddress.trim() || undefined,
        city: locationCity ?? undefined,
        state: locationState ?? undefined,
        latitude: locationLatitude ?? undefined,
        longitude: locationLongitude ?? undefined,
        placeId: locationPlaceId ?? undefined,
      })
      .then((response) => {
        if (!response.data) {
          throw new Error('Não foi possível criar o local.');
        }

        setCreatedLocationId(response.data.id);
        setSelectedLocationId(response.data.id);
        setLocations((prev) => [response.data!, ...prev]);

        if (options.advanceToNextStep) {
          setStep(2);
        } else {
          setIsAddingLocationInline(false);
          resetLocationDraft();
          toast.success('Local adicionado com sucesso.');
        }
      })
      .catch((err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : 'Erro ao criar local.';
        setError(normalizeLocationError(errorMessage));
      })
      .finally(() => {
        setIsCreatingLocation(false);
      });
  };

  const handleAdvanceFromLocation = () => {
    createLocationFromDraft({ advanceToNextStep: true });
  };

  const handleCreateLocationInline = () => {
    createLocationFromDraft({ advanceToNextStep: false });
  };

  const handleMapsError = React.useCallback((kind: MapsProviderErrorKind) => {
    if (kind === 'api-not-activated') {
      toast.error('Não foi possível carregar o mapa. Você pode informar o endereço manualmente.');
      return;
    }

    if (kind === 'quota-exceeded') {
      toast.error('Limite temporário atingido. Tente novamente em alguns minutos.');
      return;
    }

    toast.error('Não foi possível carregar o mapa. Você pode informar o endereço manualmente.');
  }, []);

  const handleAddressChange = React.useCallback((value: string) => {
    setLocationAddress(value);

    if (locationPlaceId) {
      setLocationLatitude(null);
      setLocationLongitude(null);
      setLocationPlaceId(null);
      setLocationCity(null);
      setLocationState(null);
    }
  }, [locationPlaceId]);

  const handlePlaceSelect = React.useCallback((place: SelectedLocationPlace) => {
    setLocationAddress(place.formattedAddress);
    setLocationLatitude(place.lat);
    setLocationLongitude(place.lng);
    setLocationPlaceId(place.placeId || null);
    setLocationCity(place.city || null);
    setLocationState(place.state || null);
  }, []);

  const isPairingStep = createdDevice && step === currentStepCount;

  const wizardTitle = (() => {
    if (mode === 'CREATE_LOCATION_FIRST' && step === 1) return 'Onde esta tela será instalada?';
    if (mode === 'CREATE_LOCATION_FIRST' && step === 2) return 'Identifique esta tela';
    if (mode === 'SELECT_LOCATION' && step === 1 && !isAddingLocationInline) return 'Nova tela';
    if (mode === 'SELECT_LOCATION' && step === 1 && isAddingLocationInline) return 'Adicionar local';
    return 'Conectar a tela';
  })();

  const wizardDescription = (() => {
    if (mode === 'CREATE_LOCATION_FIRST' && step === 1) {
      return 'Defina o local físico onde a tela ficará instalada. Você poderá adicionar outras telas a este mesmo local depois.';
    }

    if (mode === 'CREATE_LOCATION_FIRST' && step === 2) {
      return 'Escolha um nome para facilitar a identificação dentro do sistema.';
    }

    if (mode === 'SELECT_LOCATION' && step === 1 && !isAddingLocationInline) {
      return 'Selecione o local onde a tela será instalada e defina um nome para identificá-la.';
    }

    if (mode === 'SELECT_LOCATION' && step === 1 && isAddingLocationInline) {
      return 'Cadastre um novo local e volte para finalizar a criação da tela.';
    }

    return 'Abra o aplicativo Telumi na TV e insira o código abaixo para concluir a conexão.';
  })();

  const locationFormContent = (
    <div className="space-y-4">
      <div>
        <Label htmlFor="location-name">
          Nome do local
        </Label>
        <Input
          id="location-name"
          placeholder="Ex: Loja Centro, Recepção Clínica, Unidade Shopping"
          value={locationName}
          onChange={(event) => setLocationName(event.target.value)}
          className={fieldClassName}
          autoFocus
        />
        <p className="mt-1 text-xs text-muted-foreground">Use um nome fácil de identificar.</p>
      </div>

      <div>
        <Label htmlFor="location-address">
          Endereço (opcional)
        </Label>
        <MapsProvider
          onError={handleMapsError}
          fallback={
            <Input
              id="location-address"
              placeholder="Digite o endereço para localizar no mapa"
              value={locationAddress}
              onChange={(event) => handleAddressChange(event.target.value)}
              className={fieldClassName}
            />
          }
        >
          <LocationAutocomplete
            value={locationAddress}
            onValueChange={handleAddressChange}
            onSelect={handlePlaceSelect}
            inputClassName={fieldClassName}
          />
          {locationLatitude !== null && locationLongitude !== null && (
            <div className="mt-3">
              <LocationMapPreview lat={locationLatitude} lng={locationLongitude} />
            </div>
          )}
        </MapsProvider>
        <p className="mt-1 text-xs text-muted-foreground">
          Usado para organizar suas telas e visualizar no mapa.
        </p>
      </div>

      {locationError && <p className="text-sm text-destructive">{locationError}</p>}
    </div>
  );

  const deviceConfigurationContent = (
    <div className="space-y-4 rounded-lg border border-border bg-muted/40 p-4">
      <p className="text-sm font-medium text-foreground">Configurações da tela</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Orientação</Label>
          <Select value={deviceOrientation} onValueChange={(value) => setDeviceOrientation(value as DeviceOrientation)}>
            <SelectTrigger className={selectFieldClassName}>
              <SelectValue placeholder="Selecione a orientação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HORIZONTAL">Horizontal</SelectItem>
              <SelectItem value="VERTICAL">Vertical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Status operacional</Label>
          <Select
            value={deviceOperationalStatus}
            onValueChange={(value) => setDeviceOperationalStatus(value as DeviceOperationalStatus)}
          >
            <SelectTrigger className={selectFieldClassName}>
              <SelectValue placeholder="Selecione o status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Ativa</SelectItem>
              <SelectItem value="INACTIVE">Inativa</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Resolução</Label>
          <Select value={deviceResolution} onValueChange={setDeviceResolution}>
            <SelectTrigger className={selectFieldClassName}>
              <SelectValue placeholder="Selecione a resolução" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AUTO">Auto detect</SelectItem>
              <SelectItem value="1920x1080">1920x1080 (Full HD)</SelectItem>
              <SelectItem value="1280x720">1280x720 (HD)</SelectItem>
              <SelectItem value="3840x2160">3840x2160 (4K)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {workspace?.goalProfile !== 'INTERNAL' && (
          <div>
            <Label>Disponível no marketplace</Label>
            <Select
              value={deviceIsPublic ? 'true' : 'false'}
              onValueChange={(value) => setDeviceIsPublic(value === 'true')}
            >
              <SelectTrigger className={selectFieldClassName}>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Sim</SelectItem>
                <SelectItem value="false">Não</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {workspace?.goalProfile !== 'INTERNAL' && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>TV de parceiro</Label>
              <Select
                value={deviceIsPartnerTv ? 'true' : 'false'}
                onValueChange={(value) => setDeviceIsPartnerTv(value === 'true')}
              >
                <SelectTrigger className={selectFieldClassName}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Sim</SelectItem>
                  <SelectItem value="false">Não</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Marque se esta TV pertence a um parceiro externo.
              </p>
            </div>

            {deviceIsPartnerTv && (
              <div>
                <Label>Nome do parceiro</Label>
                <Input
                  placeholder="Ex: Clínica Saúde Mais"
                  value={devicePartnerName}
                  onChange={(e) => setDevicePartnerName(e.target.value)}
                  className={fieldClassName}
                />
              </div>
            )}
          </div>

          {deviceIsPartnerTv && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Percentual de repasse (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  placeholder="Ex: 30"
                  value={devicePartnerSharePct}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDevicePartnerSharePct(val === '' ? '' : Number(val));
                  }}
                  className={fieldClassName}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Porcentagem da receita repassada ao parceiro.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {deviceConfigError && <p className="text-xs text-destructive">{deviceConfigError}</p>}
    </div>
  );

  if (loadingLocations) {
    return (
      <Card className="gap-0 overflow-hidden border-0 py-0 shadow-none sm:rounded-lg">
        <CardContent className="flex items-center justify-center py-14">
          <HugeiconsIcon icon={RefreshIcon} size={20} className="animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-0 overflow-hidden border-0 py-0 shadow-none sm:rounded-lg">
      <CardHeader className="flex flex-col items-start gap-1.5 p-6 pb-0">
        <CardTitle className="text-lg">{wizardTitle}</CardTitle>
        <CardDescription className="text-sm leading-relaxed">{wizardDescription}</CardDescription>

        <Progress value={progressValue} className="mt-3 h-1 w-full bg-muted" />
      </CardHeader>

      <Separator className="mt-5" />

      <CardContent className="space-y-5 p-6">
        {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

        {mode === 'CREATE_LOCATION_FIRST' && step === 1 && (
          <div className="space-y-4">
            {locationFormContent}

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleAdvanceFromLocation} disabled={isCreatingLocation}>
                {isCreatingLocation ? (
                  <HugeiconsIcon icon={RefreshIcon} size={16} className="mr-2 animate-spin" />
                ) : (
                  <HugeiconsIcon icon={ArrowRightBigIcon} size={16} className="mr-1" />
                )}
                Continuar
              </Button>
            </div>
          </div>
        )}

        {mode === 'CREATE_LOCATION_FIRST' && step === 2 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="device-name-create-location">
                Nome da tela
              </Label>
              <Input
                id="device-name-create-location"
                placeholder="Ex: TV Recepção, Tela Vitrine 1, Monitor Sala A"
                value={deviceName}
                onChange={(event) => setDeviceName(event.target.value)}
                className={fieldClassName}
                autoFocus
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Este nome será exibido na lista de telas.
              </p>
              {deviceNameError && (
                <p className="mt-1 text-xs text-destructive">{deviceNameError}</p>
              )}
            </div>

            {deviceConfigurationContent}

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSubmitCreateScreen} disabled={isSubmitting}>
                {isSubmitting ? (
                  <HugeiconsIcon icon={RefreshIcon} size={16} className="mr-2 animate-spin" />
                ) : null}
                Criar tela
              </Button>
            </div>
          </div>
        )}

        {mode === 'SELECT_LOCATION' && step === 1 && (
          <div className="space-y-4">
            {!isAddingLocationInline ? (
              <>
                <div>
                  <Label htmlFor="device-name-select-location">
                    Nome da tela
                  </Label>
                  <Input
                    id="device-name-select-location"
                    placeholder="Ex: TV Recepção"
                    value={deviceName}
                    onChange={(event) => setDeviceName(event.target.value)}
                    className={fieldClassName}
                    autoFocus
                  />
                  {deviceNameError && (
                    <p className="mt-1 text-xs text-destructive">{deviceNameError}</p>
                  )}
                </div>

                <div>
                  <Label>Local</Label>
                  <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                    <SelectTrigger className={selectFieldClassName}>
                      <SelectValue placeholder="Selecione um local" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedLocationError && (
                    <p className="mt-1 text-xs text-destructive">{selectedLocationError}</p>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setError('');
                      resetLocationDraft();
                      setIsAddingLocationInline(true);
                    }}
                  >
                    <HugeiconsIcon icon={PlusSignIcon} size={14} className="mr-1" />
                    Adicionar novo local
                  </Button>
                </div>

                {deviceConfigurationContent}

                <div className="flex justify-end gap-2 border-t pt-4">
                  <Button type="button" variant="ghost" onClick={onCancel}>
                    Cancelar
                  </Button>
                  <Button type="button" onClick={handleSubmitCreateScreen} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <HugeiconsIcon icon={RefreshIcon} size={16} className="mr-2 animate-spin" />
                    ) : null}
                    Criar tela
                  </Button>
                </div>
              </>
            ) : (
              <>
                {locationFormContent}
                <div className="flex justify-end gap-2 border-t pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setIsAddingLocationInline(false);
                      setError('');
                      setLocationError('');
                    }}
                  >
                    Voltar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleCreateLocationInline}
                    disabled={isCreatingLocation}
                  >
                    {isCreatingLocation ? (
                      <HugeiconsIcon icon={RefreshIcon} size={16} className="mr-2 animate-spin" />
                    ) : null}
                    Salvar local
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {isPairingStep && createdDevice && (
          <div className="space-y-4">
            <div className="grid gap-4 rounded-lg border border-dashed border-primary/20 bg-primary/[0.02] p-6 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="text-center sm:text-left">
                <p className="mb-3 text-sm text-muted-foreground">Código de conexão</p>
                <p className="font-mono text-3xl font-bold tracking-[0.4em] text-primary">
                  {createdDevice.pairingCode}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  O código expira em 10 minutos.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Você pode inserir manualmente o código ou escanear o QR na TV.
                </p>
              </div>

              {createdDevice.pairingCode && (
                <div className="mx-auto rounded-lg border bg-background p-2 sm:mx-0">
                  <QRCodeSVG
                    value={`${PLAYER_BASE_URL}/?pairCode=${createdDevice.pairingCode}`}
                    size={112}
                    marginSize={1}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#111827"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5 rounded-lg bg-muted/50 p-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tela</span>
                <span className="font-medium">{createdDevice.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Local</span>
                <span className="font-medium">{createdDevice.locationName}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
              <Button type="button" variant="ghost" size="sm" onClick={handleCopyCode}>
                {copied ? (
                  <>
                    <HugeiconsIcon icon={TextCheckIcon} size={12} className="mr-1" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <HugeiconsIcon icon={ClipboardIcon} size={12} className="mr-1" />
                    Copiar código
                  </>
                )}
              </Button>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRegenerateCode}
                  disabled={isRegeneratingCode}
                >
                  {isRegeneratingCode ? (
                    <HugeiconsIcon icon={RefreshIcon} size={16} className="mr-2 animate-spin" />
                  ) : (
                    <HugeiconsIcon icon={RefreshIcon} size={16} className="mr-2" />
                  )}
                  Regenerar código
                </Button>
                <Button type="button" onClick={onCancel}>
                  Finalizar
                </Button>
              </div>
            </div>

            {mode === 'SELECT_LOCATION' && (
              <div className="flex justify-start border-t pt-2">
                <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                  <HugeiconsIcon icon={ArrowLeftBigIcon} size={16} className="mr-1" />
                  Voltar
                </Button>
              </div>
            )}

          </div>
        )}
      </CardContent>
    </Card>
  );
}
