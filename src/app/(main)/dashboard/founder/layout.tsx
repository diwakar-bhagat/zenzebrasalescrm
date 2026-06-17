import { ReactNode } from "react";

export default function FounderLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full flex-col bg-background min-h-screen">
      {children}
    </div>
  );
}
