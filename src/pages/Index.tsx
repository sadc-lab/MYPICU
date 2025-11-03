import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Index = () => {
  const { user, signOut } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome to MyPICU</CardTitle>
          <CardDescription>
            You're successfully logged in as {user?.email}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">User Details:</p>
            <p className="text-sm"><strong>Email:</strong> {user?.email}</p>
            <p className="text-sm"><strong>Role:</strong> {user?.user_metadata?.role || 'Not set'}</p>
            <p className="text-sm"><strong>Name:</strong> {user?.user_metadata?.full_name || 'Not set'}</p>
          </div>
          <Button onClick={signOut} variant="outline" className="w-full">
            Log Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
