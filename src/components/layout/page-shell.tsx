type PageShellProps = {
  title: string
  greeting?: string
  description?: string
  children?: React.ReactNode
}

export function PageShell({
  title,
  greeting,
  description,
  children,
}: PageShellProps) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        {greeting ? (
          <p className="text-lg font-medium tracking-tight">{greeting}</p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children ?? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed bg-muted/30 p-12 text-center">
          <div className="max-w-sm space-y-2">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-sm text-muted-foreground">
              Module workspace ready. Connect data sources to populate this
              view.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
