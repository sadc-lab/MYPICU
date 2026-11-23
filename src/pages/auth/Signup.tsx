import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, UserCog } from 'lucide-react';
import { tr } from '@/i18n';

const Signup = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">{tr("Créer votre compte", "Create your account")}</h1>
          <p className="text-muted-foreground">{tr("Choisissez votre type de compte pour commencer", "Choose your account type to get started")}</p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="hover:border-primary transition-colors">
            <CardHeader>
              <div className="flex items-center justify-center mb-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserCog className="h-8 w-8 text-primary" />
                </div>
              </div>
              <CardTitle className="text-center">{tr("Compte Gestionnaire", "Manager account")}</CardTitle>
              <CardDescription className="text-center">
                {tr('Accès complet pour gérer les équipes, les patients et les paramètres du système', 'Full access to manage teams, patients and system settings')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ {tr('Gérer tous les dossiers patients', 'Manage all patient records')}</li>
                <li>✓ {tr('Gestion des équipes', 'Team management')}</li>
                <li>✓ {tr('Accès aux analyses et rapports', 'Access to analytics and reports')}</li>
                <li>✓ {tr('Configuration du système', 'System configuration')}</li>
              </ul>
              <Link to="/auth/manager-signup" className="block">
                <Button className="w-full">{tr("S'inscrire en tant que Gestionnaire", 'Sign up as a Manager')}</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:border-primary transition-colors">
            <CardHeader>
              <div className="flex items-center justify-center mb-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-8 w-8 text-primary" />
                </div>
              </div>
              <CardTitle className="text-center">{tr("Compte Soignant", "Clinician account")}</CardTitle>
              <CardDescription className="text-center">
                {tr('Accès aux soins des patients et aux tâches opérationnelles quotidiennes', 'Access to patient care and daily operational tasks')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ {tr('Voir les patients assignés', 'View assigned patients')}</li>
                <li>✓ {tr('Mettre à jour les dossiers patients', 'Update patient records')}</li>
                <li>✓ {tr('Enregistrer les signes vitaux', 'Record vital signs')}</li>
                <li>✓ {tr("Communiquer avec l'équipe", 'Communicate with the team')}</li>
              </ul>
              <Link to="/auth/worker-signup" className="block">
                <Button className="w-full" variant="outline">{tr("S'inscrire en tant que Soignant", 'Sign up as a Clinician')}</Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 text-center text-sm">
          {tr('Vous avez déjà un compte ?', 'Already have an account?')}{' '}
          <Link to="/auth/login" className="text-primary hover:underline">
            {tr('Se connecter', 'Sign in')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Signup;