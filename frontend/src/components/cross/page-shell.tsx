import type { ReactNode } from "react";
export function PageShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className={`mx-auto w-full max-w-[1500px] px-4 py-8 lg:px-6 lg:py-10 ${className}`}>
      {children}
    </main>
  );
}
