import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface DataLoadingOverlayProps {
  isLoading: boolean;
  label?: string;
  variant?: "overlay" | "skeleton" | "inline";
  children: React.ReactNode;
}

export const DataLoadingOverlay = ({
  isLoading,
  label = "Chargement des données...",
  variant = "overlay",
  children,
}: DataLoadingOverlayProps) => {
  if (!isLoading) return <>{children}</>;

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{label}</span>
      </div>
    );
  }

  if (variant === "skeleton") {
    return (
      <div className="space-y-3 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{label}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // overlay variant
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-card/80 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-lg">
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card px-4 py-2 rounded-full border shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{label}</span>
        </div>
      </div>
      <div className="opacity-30 pointer-events-none">
        {children}
      </div>
    </div>
  );
};
