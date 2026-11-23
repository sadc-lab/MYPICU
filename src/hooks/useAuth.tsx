import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { tr } from '@/i18n';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string, role: 'manager' | 'worker') => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            role: role
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        toast.success(tr('Compte créé ! Vérifiez vos courriels pour confirmer votre compte.', 'Account created successfully! Please check your email to verify your account.'));
        navigate('/auth/login');
      }

      return { error: null };
    } catch (error: any) {
      console.error('Sign up error:', error);
      toast.error(error.message || tr('Impossible de créer le compte', 'Failed to create account'));
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.session) {
        toast.success(tr('Connexion réussie !', 'Successfully logged in!'));
        navigate('/');
      }

      return { error: null };
    } catch (error: any) {
      console.error('Sign in error:', error);
      toast.error(error.message || tr('Échec de la connexion', 'Failed to log in'));
      return { error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast.success(tr('Déconnexion réussie', 'Successfully logged out'));
      navigate('/auth/login');
      return { error: null };
    } catch (error: any) {
      console.error('Sign out error:', error);
      toast.error(error.message || tr('Échec de la déconnexion', 'Failed to log out'));
      return { error };
    }
  };

  return {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut
  };
};
