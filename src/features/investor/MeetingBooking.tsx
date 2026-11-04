/** Agendamiento de reunión con el equipo de estructuración (solicitud, confirmada por correo). */
import { useMemo, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Check } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { requestMeeting, MEETING_TOPICS, type MeetingTopic } from "@/lib/investor/meeting.functions";

const SLOTS = ["09:30", "11:00", "12:30", "15:00", "16:30", "18:00"];

function nextBusinessDays(n: number) {
  const out: Date[] = [];
  const d = new Date();
  while (out.length < n) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) out.push(new Date(d));
  }
  return out;
}
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const input =
  "h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-sm text-content focus:outline-none focus:ring-2 focus:ring-accent-brand";

export function MeetingBooking({
  open,
  onOpenChange,
  initialTopic = "general",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialTopic?: MeetingTopic;
}) {
  const send = useServerFn(requestMeeting);
  const days = useMemo(() => nextBusinessDays(10), []);
  const [topic, setTopic] = useState<MeetingTopic>(initialTopic);
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [err, setErr] = useState("");

  const ready = date && slot && name.trim().length >= 2 && /\S+@\S+\.\S+/.test(email);

  async function submit() {
    setState("sending");
    try {
      await send({ data: { name, email, phone: phone || null, topic, date, slot, message: message || null } });
      setState("done");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
      setState("error");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-xl overflow-y-auto overflow-x-hidden [&>*]:min-w-0 bg-surface text-content">
        <DialogTitle className="font-display text-2xl">Agendar reunión</DialogTitle>
        <DialogDescription className="text-sm text-content-muted">
          Equipo de estructuración · Valle Escondido SpA. Hora de Santiago; confirmamos por correo.
        </DialogDescription>

        {state === "done" ? (
          <div className="space-y-3 py-6 text-center">
            <Check className="mx-auto h-10 w-10 text-accent-brand" />
            <p className="font-display text-xl">Solicitud recibida</p>
            <p className="text-sm text-content-muted">
              Propuesta: {date} a las {slot}. Te escribiremos a {email} para confirmar.
            </p>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="mt-2 h-11 rounded-sm border border-hairline px-5 text-sm"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <div className="min-w-0 space-y-5">
            <fieldset className="min-w-0">
              <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted">Tema</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(MEETING_TOPICS) as MeetingTopic[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTopic(k)}
                    className={`min-h-11 rounded-sm border px-3 py-2 text-left text-sm ${topic === k ? "border-accent-brand bg-accent-brand/10" : "border-hairline"}`}
                  >
                    {MEETING_TOPICS[k]}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="min-w-0">
              <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted">Día</legend>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {days.map((d) => (
                  <button
                    key={iso(d)}
                    type="button"
                    onClick={() => setDate(iso(d))}
                    className={`min-h-14 min-w-16 shrink-0 rounded-sm border px-2 text-center text-xs ${date === iso(d) ? "border-accent-brand bg-accent-brand/10" : "border-hairline"}`}
                  >
                    <span className="block capitalize">{d.toLocaleDateString("es-CL", { weekday: "short" })}</span>
                    <span className="block font-display text-lg">{d.getDate()}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="min-w-0">
              <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted">Hora</legend>
              <div className="grid grid-cols-3 gap-2">
                {SLOTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSlot(s)}
                    className={`h-11 rounded-sm border text-sm ${slot === s ? "border-accent-brand bg-accent-brand/10" : "border-hairline"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={input} placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre" />
              <input className={input} type="email" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Correo" />
              <input className={`${input} sm:col-span-2`} placeholder="Teléfono (opcional)" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Teléfono" />
              <textarea
                className={`${input} h-20 py-2 sm:col-span-2`}
                placeholder="¿Qué te gustaría revisar? (opcional)"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                aria-label="Mensaje"
              />
            </div>
            {state === "error" && <p className="text-sm text-destructive">{err}</p>}
            <button
              type="button"
              disabled={!ready || state === "sending"}
              onClick={submit}
              className="h-11 w-full rounded-sm bg-im-gold text-[11px] font-semibold uppercase tracking-[0.2em] text-surface-inverse disabled:opacity-50"
            >
              {state === "sending" ? "Enviando…" : "Solicitar reunión"}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function BookMeetingButton({
  topic,
  className,
  children,
}: {
  topic?: MeetingTopic;
  className?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex h-11 items-center gap-2 rounded-sm border border-hairline px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-content hover:border-accent-brand"
        }
      >
        <CalendarDays className="h-4 w-4" />
        {children ?? "Agendar reunión"}
      </button>
      <MeetingBooking open={open} onOpenChange={setOpen} initialTopic={topic} />
    </>
  );
}
