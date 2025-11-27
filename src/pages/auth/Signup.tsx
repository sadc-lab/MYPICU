import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, UserCog } from 'lucide-react';

const Signup = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Créer votre compte</h1>
          <p className="text-muted-foreground">Choisissez votre type de compte pour commencer</p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="hover:border-primary transition-colors">
            <CardHeader>
              <div className="flex items-center justify-center mb-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserCog className="h-8 w-8 text-primary" />
                </div>
              </div>
              <CardTitle className="text-center">Compte Gestionnaire</CardTitle>
              <CardDescription className="text-center">
                Accès complet pour gérer les équipes, les patients et les paramètres du système
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ Gérer tous les dossiers patients</li>
                <li>✓ Gestion des équipes</li>
                <li>✓ Accès aux analyses et rapports</li>
                <li>✓ Configuration du système</li>
              </ul>
              <Link to="/auth/manager-signup" className="block">
                <Button className="w-full">S'inscrire en tant que Gestionnaire</Button>
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
              <CardTitle className="text-center">Compte Soignant</CardTitle>
              <CardDescription className="text-center">
                Accès aux soins des patients et aux tâches opérationnelles quotidiennes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ Voir les patients assignés</li>
                <li>✓ Mettre à jour les dossiers patients</li>
                <li>✓ Enregistrer les signes vitaux</li>
                <li>✓ Communiquer avec l'équipe</li>
              </ul>
              <Link to="/auth/worker-signup" className="block">
                <Button className="w-full" variant="outline">S'inscrire en tant que Soignant</Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 text-center text-sm">
          Vous avez déjà un compte ?{' '}
          <Link to="/auth/login" className="text-primary hover:underline">
            Se connecter
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Signup;