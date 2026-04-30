type EmptyStateProps = {
  title: string;
  description: string;
  className?: string;
};

export function EmptyState({
  title,
  description,
  className = "animate-fade-in-up animate-delay-300",
}: EmptyStateProps) {
  return (
    <article className={`panel space-y-2 ${className}`.trim()}>
      <p className="eyebrow">{title}</p>
      <p className="text-sm leading-7 text-muted">{description}</p>
    </article>
  );
}
