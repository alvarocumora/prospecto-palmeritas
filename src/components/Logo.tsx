import logoMark from "@/assets/geocapitals-mark.png";

type LogoProps = {
  size?: number;
  showText?: boolean;
  textClassName?: string;
  className?: string;
};

export function Logo({ size = 24, showText = true, textClassName = "", className = "" }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src={logoMark}
        alt="Geocapitals"
        width={size}
        height={size}
        className="object-contain"
        style={{ width: size, height: size }}
      />
      {showText && (
        <span className={`font-mono font-bold tracking-tight ${textClassName}`}>
          GEOCAPITALS
        </span>
      )}
    </span>
  );
}
