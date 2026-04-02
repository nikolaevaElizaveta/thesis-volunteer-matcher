interface Props {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
  className?: string;
}

const VARIANTS = {
  default: "bg-primary-light text-indigo-700",
  success: "bg-accent-light text-emerald-700",
  warning: "bg-warning-light text-amber-700",
  danger: "bg-danger-light text-red-700",
};

export default function Badge({
  children,
  variant = "default",
  className = "",
}: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${VARIANTS[variant]} ${className}`.trim()}
    >
      {children}
    </span>
  );
}
