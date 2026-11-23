import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useI18n } from '@/i18n';

const NotFound = () => {
  const location = useLocation();
  const { t } = useI18n();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="mb-4 text-3xl sm:text-4xl font-bold text-foreground">404</h1>
        <p className="mb-4 text-lg sm:text-xl text-muted-foreground">{t("Oups ! Page non trouvée", "Oops! Page not found")}</p>
        <a href="/" className="text-primary underline hover:text-primary/80 text-sm sm:text-base">
          {t("Retourner à l'accueil", 'Back to home')}
        </a>
      </div>
    </div>
  );
};

export default NotFound;