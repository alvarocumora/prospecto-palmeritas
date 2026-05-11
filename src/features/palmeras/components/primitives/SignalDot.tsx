type SignalDotProps = {
  tone: "teal" | "gold" | "alert";
};

export function SignalDot({ tone }: SignalDotProps) {
  const toneClass = {
    teal: "bg-teal",
    gold: "bg-gold",
    alert: "bg-alert",
  }[tone];

  return <span className={`inline-block h-2 w-2 rounded-full ${toneClass}`} />;
}
