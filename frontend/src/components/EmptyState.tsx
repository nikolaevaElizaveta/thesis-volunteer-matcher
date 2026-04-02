import { Inbox } from "lucide-react";

interface Props {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export default function EmptyState({ title, description, children }: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <Inbox size={40} className="mb-4 text-muted" />
      <p className="text-base font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-muted">{description}</p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
