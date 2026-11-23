import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await signIn(email, password);
    setIsLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">{t("Bienvenue", "Welcome")}</CardTitle>
          <CardDescription className="text-center">
            {t("Entrez vos identifiants pour accéder à votre compte", "Enter your credentials to access your account")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("Courriel", "Email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("vous@exemple.com", "you@example.com")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("Mot de passe", "Password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end">
              <Link to="/auth/forgot-password" className="text-xs text-muted-foreground hover:text-primary hover:underline">
                {t("Mot de passe oublié ?", "Forgot password?")}
              </Link>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t('Connexion...', 'Signing in...') : t('Se connecter', 'Sign in')}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            {t("Vous n'avez pas de compte?", "Don't have an account?")}{' '}
            <Link to="/auth/signup" className="text-primary hover:underline">
              {t("S'inscrire", 'Sign up')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
