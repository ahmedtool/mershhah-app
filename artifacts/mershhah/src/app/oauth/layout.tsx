
export default function OAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40 p-4">
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
