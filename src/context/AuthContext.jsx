import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

useEffect(() => {
  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
      // ✅ Server-side validation of the stored token
      const { error } = await supabase.auth.getUser();
      if (error) {
        // Token corrupted/expired/revoked → clean logout
        await supabase.auth.signOut();
        setUser(null);
      } else {
        setUser(session.user);
      }
    } else {
      setUser(null);
    }
    setLoading(false);
  };
  init();

  const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') setUser(null);
    else if (session) setUser(session.user);
  });

  return () => listener.subscription.unsubscribe();
}, []);

  const signUp = async (email, password, username) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } }
    });
    return { data, error };
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}