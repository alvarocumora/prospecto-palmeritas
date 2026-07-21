/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
  Hr,
  Button,
} from "@react-email/components";

export const colors = {
  bg: "#ffffff",
  surface: "#0b0a09",
  primary: "#d97706", // ámbar minero
  text: "#111111",
  muted: "#666666",
  border: "#e5e5e5",
  danger: "#b91c1c",
  warn: "#b45309",
  success: "#15803d",
};

export const styles = {
  main: { backgroundColor: colors.bg, fontFamily: "Inter, Arial, sans-serif" } as const,
  container: {
    padding: "32px 28px",
    maxWidth: "600px",
    margin: "0 auto",
    border: `1px solid ${colors.border}`,
    borderRadius: "8px",
  } as const,
  brand: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "12px",
    letterSpacing: "0.12em",
    color: colors.primary,
    textTransform: "uppercase" as const,
    margin: "0 0 18px",
  },
  h1: { fontSize: "22px", lineHeight: "1.3", color: colors.text, margin: "0 0 12px" } as const,
  p: { fontSize: "14px", lineHeight: "1.6", color: colors.text, margin: "0 0 14px" } as const,
  muted: { fontSize: "12px", color: colors.muted, margin: "8px 0 0" } as const,
  kv: {
    fontSize: "13px",
    lineHeight: "1.6",
    color: colors.text,
    padding: "12px 14px",
    background: "#f7f6f4",
    borderRadius: "6px",
    margin: "12px 0",
    fontFamily: "'IBM Plex Mono', monospace",
  } as const,
  cta: {
    backgroundColor: colors.primary,
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    padding: "10px 18px",
    borderRadius: "6px",
    textDecoration: "none",
    display: "inline-block",
  } as const,
  hr: { borderColor: colors.border, margin: "22px 0" } as const,
  footer: { fontSize: "11px", color: colors.muted, lineHeight: "1.5" } as const,
};

export function badge(level: "danger" | "warn" | "info" | "success", label: string) {
  const map = {
    danger: colors.danger,
    warn: colors.warn,
    info: colors.primary,
    success: colors.success,
  };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 8px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: 600,
        background: `${map[level]}1a`,
        color: map[level],
        fontFamily: "'IBM Plex Mono', monospace",
        letterSpacing: "0.05em",
      }}
    >
      {label}
    </span>
  );
}

interface LayoutProps {
  preview: string;
  brand?: string;
  children: React.ReactNode;
  ctaHref?: string;
  ctaLabel?: string;
  audience?: "internal" | "investor";
  /** Inyectado automáticamente por sendInternalEmail para confirmar apertura. */
  trackingPixelUrl?: string;
}

export function EmailLayout({
  preview,
  brand = "GEOCAPITALS",
  children,
  ctaHref,
  ctaLabel,
  audience,
  trackingPixelUrl,
}: LayoutProps) {
  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Text style={styles.brand}>
            {brand}
            {audience ? ` · ${audience === "internal" ? "Equipo técnico" : "Investor brief"}` : ""}
          </Text>
          {children}
          {ctaHref && ctaLabel ? (
            <Section style={{ margin: "20px 0 6px" }}>
              <Button href={ctaHref} style={styles.cta}>
                {ctaLabel}
              </Button>
            </Section>
          ) : null}
          <Hr style={styles.hr} />
          <Text style={styles.footer}>
            Geocapitals · Plataforma para exploración minera moderna
            <br />
            Catastro · Satelital · NI 43-101 · Deal flow
          </Text>
          {trackingPixelUrl ? (
            <img
              src={trackingPixelUrl}
              alt=""
              width={1}
              height={1}
              style={{ width: 1, height: 1, border: 0, display: "block" }}
            />
          ) : null}
        </Container>
      </Body>
    </Html>
  );
}

export function KeyValueBlock({
  rows,
}: {
  rows: Array<[string, string | number | null | undefined]>;
}) {
  return (
    <Section style={styles.kv}>
      {rows.map(([k, v], i) => (
        <Text key={i} style={{ margin: "2px 0", fontSize: "13px" }}>
          <span style={{ color: colors.muted }}>{k}: </span>
          <span style={{ color: colors.text }}>{v ?? "—"}</span>
        </Text>
      ))}
    </Section>
  );
}

export function appUrl(path = "/"): string {
  const base = "https://geocapitals.com";
  return path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
