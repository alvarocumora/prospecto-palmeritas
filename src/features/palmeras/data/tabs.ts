import { Activity, Drill, Mountain, Radio, Target, TestTube2, Wallet } from "lucide-react";
import type { PalmerasTab } from "../types";

export const PALMERAS_TABS: PalmerasTab[] = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "geology", label: "Geology", icon: Mountain },
  { id: "geophysics", label: "Geophysics", icon: Radio },
  { id: "targets", label: "Targets", icon: Target },
  { id: "sampling", label: "Sampling", icon: TestTube2 },
  { id: "drill", label: "Drill Program", icon: Drill },
  { id: "budget", label: "Budget", icon: Wallet },
];
