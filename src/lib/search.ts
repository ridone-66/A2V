export function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function parseEuroCents(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const normalized = Number(value.replace(",", "."));
  if (!Number.isFinite(normalized) || normalized < 0) return undefined;
  return Math.round(normalized * 100);
}

export function parsePage(value: string | undefined): number {
  const page = Number(value ?? "1");
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
}
