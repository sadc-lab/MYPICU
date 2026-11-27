import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Mail } from 'lucide-react';
import { useI18n, tr } from '@/i18n';

const ForgotPassword = () => {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;

      setEmailSent(true);
      toast.success(tr('Un courriel de réinitialisation a été envoyé.', 'A reset email has been sent.'));
    } catch (error: any) {
      console.error('Reset password error:', error);
      toast.error(error.message || tr("Erreur lors de l'envoi du courriel.", 'Error sending the email.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">{t("Mot de passe oublié", "Forgot password")}</CardTitle>
          <CardDescription className="text-center">
            {emailSent
              ? t('Vérifiez votre boîte de réception', 'Check your inbox')
              : t('Entrez votre adresse courriel pour recevoir un lien de réinitialisation', 'Enter your email address to receive a reset link')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emailSent ? (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("Si un compte existe avec l'adresse", 'If an account exists for')} <strong>{email}</strong>{t(', vous recevrez un courriel avec les instructions pour réinitialiser votre mot de passe.', ', you will receive an email with instructions to reset your password.')}
              </p>
              <Button variant="outline" className="w-full" onClick={() => setEmailSent(false)}>
                {t('Renvoyer le courriel', 'Resend email')}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("Adresse courriel", "Email address")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("vous@exemple.com", "you@example.com")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? t('Envoi en cours...', 'Sending...') : t('Envoyer le lien de réinitialisation', 'Send reset link')}
              </Button>
            </form>
          )}
          <div className="mt-4 text-center">
            <Link to="/auth/login" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" />
              {t('Retour à la connexion', 'Back to sign in')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPassword;
