import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';
import { useI18n } from '@/i18n';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const navigate = useNavigate();
  const { t } = useI18n();

  useEffect(() => {
    // Check if we have a recovery session from the URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');

    if (type === 'recovery') {
      setIsValidSession(true);
    }

    // Also listen for auth state changes (recovery event)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsValidSession(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error(t('Les mots de passe ne correspondent pas.', 'Passwords do not match.'));
      return;
    }

    if (password.length < 6) {
      toast.error(t('Le mot de passe doit contenir au moins 6 caractères.', 'Password must be at least 6 characters.'));
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      toast.success(t('Mot de passe réinitialisé avec succès !', 'Password reset successfully!'));
      navigate('/auth/login');
    } catch (error: any) {
      console.error('Update password error:', error);
      toast.error(error.message || t('Erreur lors de la réinitialisation du mot de passe.', 'Error resetting the password.'));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isValidSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">{t("Lien invalide", "Invalid link")}</CardTitle>
            <CardDescription className="text-center">
              {t('Ce lien de réinitialisation est invalide ou a expiré. Veuillez en demander un nouveau.', 'This reset link is invalid or has expired. Please request a new one.')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate('/auth/forgot-password')}>
              {t('Demander un nouveau lien', 'Request a new link')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-2">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">{t("Nouveau mot de passe", "New password")}</CardTitle>
          <CardDescription className="text-center">
            {t('Choisissez un nouveau mot de passe pour votre compte', 'Choose a new password for your account')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">{t("Nouveau mot de passe", "New password")}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t("Au moins 6 caractères", "At least 6 characters")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("Confirmer le mot de passe", "Confirm password")}</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder={t("Confirmez votre mot de passe", "Confirm your password")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t('Réinitialisation...', 'Resetting...') : t('Réinitialiser le mot de passe', 'Reset password')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
