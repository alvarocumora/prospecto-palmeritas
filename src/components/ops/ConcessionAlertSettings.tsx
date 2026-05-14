import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, Loader2, Save } from "lucide-react";

type Settings = {
  status_change_enabled: boolean;
  area_change_enabled: boolean;
  holder_change_enabled: boolean;
  area_change_threshold_pct: number;
  email_notify: boolean;
  email_recipients: string[];
  webhook_url: string | null;
};

const DEFAULTS: Settings = {
  status_change_enabled: true,
  area_change_enabled: true,
  holder_change_enabled: true,
  area_change_threshold_pct: 5,
  email_notify: false,
  email_recipients: [],
  webhook_url: "",
};

export function ConcessionAlertSettings({ projectId }: { projectId: string }) {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emailsRaw, setEmailsRaw] = useState("");

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("concession_alert_settings")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();
      if (cancel) return;
      if (data) {
        setS({
          status_change_enabled: data.status_change_enabled,
          area_change_enabled: data.area_change_enabled,
          holder_change_enabled: data.holder_change_enabled,
          area_change_threshold_pct: Number(data.area_change_threshold_pct),
          email_notify: data.email_notify,
          email_recipients: data.email_recipients ?? [],
          webhook_url: data.webhook_url ?? "",
        });
        setEmailsRaw((data.email_recipients ?? []).join(", "));
      }
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [projectId]);

  const save = async () => {
    setSaving(true);
    const recipients = emailsRaw
      .split(/[,\s;]+/)
      .map((e) => e.trim())
      .filter((e) => /.+@.+\..+/.test(e));
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      project_id: projectId,
      ...s,
      email_recipients: recipients,
      webhook_url: s.webhook_url?.trim() || null,
      updated_by: user?.id,
    };
    const { error } = await supabase
      .from("concession_alert_settings")
      .upsert(payload, { onConflict: "project_id" });
    setSaving(false);
    if (error) toast.error("No se pudo guardar: " + error.message);
    else toast.success("Configuración de alertas guardada");
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-text-secondary">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Alertas de concesiones sincronizadas</h3>
      </div>

      <div className="space-y-3 text-sm">
        <label className="flex items-center justify-between gap-3">
          <span>Alertar cambio de <strong>estado</strong></span>
          <input type="checkbox" checked={s.status_change_enabled}
            onChange={(e) => setS({ ...s, status_change_enabled: e.target.checked })} />
        </label>

        <label className="flex items-center justify-between gap-3">
          <span>Alertar cambio de <strong>titular</strong></span>
          <input type="checkbox" checked={s.holder_change_enabled}
            onChange={(e) => setS({ ...s, holder_change_enabled: e.target.checked })} />
        </label>

        <label className="flex items-center justify-between gap-3">
          <span>Alertar variación de <strong>área (ha)</strong></span>
          <input type="checkbox" checked={s.area_change_enabled}
            onChange={(e) => setS({ ...s, area_change_enabled: e.target.checked })} />
        </label>

        <div className="flex items-center justify-between gap-3 pl-4">
          <span className="text-text-secondary">Umbral mínimo (%)</span>
          <input type="number" min={0} max={100} step={0.5}
            disabled={!s.area_change_enabled}
            value={s.area_change_threshold_pct}
            onChange={(e) => setS({ ...s, area_change_threshold_pct: Number(e.target.value) || 0 })}
            className="w-24 rounded border border-border bg-background px-2 py-1 text-right" />
        </div>
      </div>

      <div className="border-t border-border pt-4 space-y-3 text-sm">
        <label className="flex items-center justify-between gap-3">
          <span>Notificar por <strong>email</strong></span>
          <input type="checkbox" checked={s.email_notify}
            onChange={(e) => setS({ ...s, email_notify: e.target.checked })} />
        </label>
        <input
          type="text"
          disabled={!s.email_notify}
          placeholder="correo1@dominio.com, correo2@…"
          value={emailsRaw}
          onChange={(e) => setEmailsRaw(e.target.value)}
          className="w-full rounded border border-border bg-background px-2 py-1.5"
        />

        <div>
          <label className="block mb-1 text-text-secondary">Webhook URL (opcional)</label>
          <input
            type="url"
            placeholder="https://hooks.slack.com/…  o  https://tu-servidor/alerts"
            value={s.webhook_url ?? ""}
            onChange={(e) => setS({ ...s, webhook_url: e.target.value })}
            className="w-full rounded border border-border bg-background px-2 py-1.5"
          />
          <p className="mt-1 text-xs text-text-secondary">
            Recibirá un POST JSON con la alerta cada vez que se dispare.
          </p>
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Guardar configuración
      </button>
    </div>
  );
}
