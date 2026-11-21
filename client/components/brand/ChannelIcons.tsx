/* WhatsApp and Messenger line icons, drawn on Lucide's 24px grid and stroke (Lucide has no brand icons). */
const BUBBLE =
  "M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719";

type IconProps = { className?: string; strokeWidth?: number };

function Icon({ className = "size-5", strokeWidth = 1.5, d }: IconProps & { d: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      <path d={BUBBLE} />
      <path d={d} />
    </svg>
  );
}

export function WhatsAppIcon(props: IconProps) {
  return <Icon {...props} d="M9.2 8.2c-.4.3-.7.8-.6 1.4.4 2.6 2.4 4.7 5 5.3.6.1 1.2-.2 1.5-.7l.3-.6-1.9-1-.8.8a4.2 4.2 0 0 1-2.2-2.2l.8-.8-1-1.9Z" />;
}

export function MessengerIcon(props: IconProps) {
  return <Icon {...props} d="m7.5 13.5 3-3.25 2.75 2 3.25-2.75-3 3.25-2.75-2Z" />;
}
