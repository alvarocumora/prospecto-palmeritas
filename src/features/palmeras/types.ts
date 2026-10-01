import type { LucideIcon } from "lucide-react";

export type PalmerasTabId =
  "overview" | "geology" | "geophysics" | "targets" | "sampling" | "drill" | "budget";

export type PalmerasTab = {
  id: PalmerasTabId;
  label: string;
  icon: LucideIcon;
};

export type PalmerasProject = {
  name: string;
  ref: string;
  operator: string;
  coords: string;
  location: string;
  status: string;
  created: string;
};

export type PalmerasTone = "gold" | "copper" | "teal" | "info" | "alert" | "muted";

export type PalmerasCardAccent = "gold" | "copper" | "muted";
