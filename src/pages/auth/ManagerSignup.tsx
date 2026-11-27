import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { UserCog } from 'lucide-react';
import { tr } from '@/i18n';

const ManagerSignup = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      return;
    }

    setIsLoading(true);
    await signUp(email, password, fullName, 'manager');
    setIsLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <UserCog className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">{tr("Créer un compte Gestionnaire", "Create a Manager account")}</CardTitle>
          <CardDescription className="text-center">
            {tr('Accès complet pour gérer les équipes et les paramètres du système', 'Full access to manage teams and system settings')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">{tr("Nom complet", "Full name")}</Label>
              <Input
                id="fullName"
                type="text"
                placeholder={tr("Jean Dupont", "Jane Doe")}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{tr("Courriel", "Email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={tr("vous@exemple.com", "you@example.com")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{tr("Mot de passe", "Password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{tr("Confirmer le mot de passe", "Confirm password")}</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? tr('Création du compte...', 'Creating account...') : tr('Créer le compte Gestionnaire', 'Create Manager account')}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            {tr('Vous avez déjà un compte ?', 'Already have an account?')}{' '}
            <Link to="/auth/login" className="text-primary hover:underline">
              {tr('Se connecter', 'Sign in')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ManagerSignup;