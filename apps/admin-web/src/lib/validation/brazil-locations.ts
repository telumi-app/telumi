import estadosCidades from 'estados-cidades';

const STATE_LABELS: Record<string, string> = {
  AC: 'Acre',
  AL: 'Alagoas',
  AP: 'Amapá',
  AM: 'Amazonas',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',
  PA: 'Pará',
  PB: 'Paraíba',
  PR: 'Paraná',
  PE: 'Pernambuco',
  PI: 'Piauí',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul',
  RO: 'Rondônia',
  RR: 'Roraima',
  SC: 'Santa Catarina',
  SP: 'São Paulo',
  SE: 'Sergipe',
  TO: 'Tocantins',
};

type EstadosCidadesAPI = {
  states: () => string[];
  cities: (stateUf: string) => string[];
};

const api = estadosCidades as unknown as EstadosCidadesAPI;

export const STATE_OPTIONS = api.states().map((uf) => ({
  value: uf,
  label: STATE_LABELS[uf] ?? uf,
}));

export function getCitiesByState(stateUf?: string): string[] {
  if (!stateUf) {
    return [];
  }

  return api.cities(stateUf);
}
