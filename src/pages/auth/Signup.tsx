import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, UserCog } from 'lucide-react';

const Signup = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Create Your Account</h1>
          <p className="text-muted-foreground">Choose your account type to get started</p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="hover:border-primary transition-colors">
            <CardHeader>
              <div className="flex items-center justify-center mb-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserCog className="h-8 w-8 text-primary" />
                </div>
              </div>
              <CardTitle className="text-center">Manager Account</CardTitle>
              <CardDescription className="text-center">
                Full access to manage teams, patients, and system settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ Manage all patient records</li>
                <li>✓ Team management capabilities</li>
                <li>✓ Access to analytics and reports</li>
                <li>✓ System configuration</li>
              </ul>
              <Link to="/auth/manager-signup" className="block">
                <Button className="w-full">Sign up as Manager</Button>
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
              <CardTitle className="text-center">Worker Account</CardTitle>
              <CardDescription className="text-center">
                Access to patient care and daily operational tasks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ View assigned patients</li>
                <li>✓ Update patient records</li>
                <li>✓ Log vital signs and metrics</li>
                <li>✓ Communicate with team</li>
              </ul>
              <Link to="/auth/worker-signup" className="block">
                <Button className="w-full" variant="outline">Sign up as Worker</Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 text-center text-sm">
          Already have an account?{' '}
          <Link to="/auth/login" className="text-primary hover:underline">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Signup;
