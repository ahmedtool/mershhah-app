
interface PageHeaderProps {
  title: string;
  description: string;
  children?: React.ReactNode;
}

export default function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-lg font-black text-gray-900">{title}</h1>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
