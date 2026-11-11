export function investmentAmount(value: unknown, maximum = Number.MAX_SAFE_INTEGER) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= maximum
    ? value
    : undefined;
}

export function equitySearch(amount: number) {
  return {
    tab: "simulador" as const,
    amount,
    currency: "USD" as const,
    instrument: "equity" as const,
  };
}

export function equityAmount(search: Record<string, unknown>) {
  return search.currency === "USD" && search.instrument === "equity"
    ? investmentAmount(search.amount)
    : undefined;
}

export function collateralSearch(amount: number, months: number) {
  return {
    amount,
    months,
    currency: "CLP" as const,
    instrument: "colateral-inmobiliario" as const,
  };
}

export function investmentHref(path: string, search: Record<string, string | number>) {
  return `${path}?${new URLSearchParams(Object.entries(search).map(([key, value]) => [key, String(value)]))}`;
}

export function safeAuthNext(next?: string) {
  // Reject backslashes and control characters before either URL parser handles the path.
  // eslint-disable-next-line no-control-regex
  if (!next?.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(next)) {
    return "/dashboard";
  }
  return next;
}
