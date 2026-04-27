import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Loader2 } from "lucide-react";
import { toPng } from "html-to-image";
import { toast } from "sonner";

interface ExportImageButtonProps {
  /** CSS selector of the element to capture. Defaults to `main` of the page. */
  targetSelector?: string;
  /** Filename prefix (e.g. "optibrain"). A timestamp is appended. */
  filenamePrefix: string;
  /** Optional label override. */
  label?: string;
}

/**
 * Captures a dashboard section as a PNG image, with patient name automatically
 * masked (any element marked `data-patient-name` is hidden during capture).
 *
 * Designed so a clinician can share a de-identified visual snapshot with the
 * Copilot agent for visual comparison and personalised intervention plans.
 */
export const ExportImageButton = ({
  targetSelector,
  filenamePrefix,
  label = "Exporter en image",
}: ExportImageButtonProps) => {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);

    // Find target node
    const node =
      (targetSelector && (document.querySelector(targetSelector) as HTMLElement | null)) ||
      (document.querySelector("main") as HTMLElement | null) ||
      (document.body as HTMLElement);

    if (!node) {
      toast.error("Impossible de localiser le contenu à exporter");
      setLoading(false);
      return;
    }

    // De-identify: hide all patient-name elements + the export button itself
    const hiddenEls = Array.from(
      document.querySelectorAll<HTMLElement>(
        "[data-patient-name], [data-export-hide]"
      )
    );
    const previousVisibility = hiddenEls.map((el) => el.style.visibility);
    hiddenEls.forEach((el) => {
      el.style.visibility = "hidden";
    });

    try {
      const bgColor = getComputedStyle(document.body).backgroundColor || "#ffffff";
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: bgColor,
        filter: (n) => {
          // Skip nodes explicitly excluded
          if (n instanceof HTMLElement && n.dataset.exportSkip !== undefined) {
            return false;
          }
          return true;
        },
      });

      const link = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      link.download = `${filenamePrefix}_${stamp}.png`;
      link.href = dataUrl;
      link.click();

      toast.success("Image exportée (sans nom patient)");
    } catch (err) {
      console.error("[ExportImageButton] failed:", err);
      toast.error("Échec de l'export image");
    } finally {
      hiddenEls.forEach((el, i) => {
        el.style.visibility = previousVisibility[i];
      });
      setLoading(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleExport}
      disabled={loading}
      data-export-hide
      className="gap-2"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Camera className="h-4 w-4" />
      )}
      {label}
    </Button>
  );
};
