import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AutumnLeaves from '../components/AutumnLeaves';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await signIn(email, password);
    if (error) {
      setError(error.message);
    } else {
      navigate('/dashboard');
    }
    setLoading(false);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-page-cream p-4">
      <AutumnLeaves />
      <div className="relative z-10 animate-fade-in-up bg-parchment p-8 sm:p-10 rounded-sm shadow-cozy max-w-md w-full border border-coffee-cream/30">
        <p className="eyebrow text-center mb-2">Stars Hollow, Connecticut</p>
        <h2 className="font-display text-3xl text-yale-blue text-center">
          Welcome <span className="italic text-maple-rust">Back</span>
        </h2>
        <div className="mx-auto mt-4 mb-6 h-px w-10 bg-gilmore-gold/50" />

        {error && (
          <p className="text-maple-rust text-sm mb-4 text-center font-body">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-ui text-[0.65rem] uppercase tracking-widest text-coffee-cream mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2.5 border border-coffee-cream/30 rounded-sm bg-page-cream text-library-ink font-body focus:outline-none focus:ring-2 focus:ring-maple-rust/25 focus:border-maple-rust transition-colors"
              required
            />
          </div>
          <div>
            <label className="block font-ui text-[0.65rem] uppercase tracking-widest text-coffee-cream mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2.5 border border-coffee-cream/30 rounded-sm bg-page-cream text-library-ink font-body focus:outline-none focus:ring-2 focus:ring-maple-rust/25 focus:border-maple-rust transition-colors"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yale-blue text-page-cream py-2.5 rounded-sm font-ui text-xs uppercase tracking-widest hover:bg-maple-rust transition-colors disabled:opacity-50"
          >
            {loading ? 'Entering...' : 'Log In'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-3 font-body text-sm text-coffee-cream">
          <p>
            Don't have an account?{' '}
            <Link to="/signup" className="text-maple-rust hover:underline">
              Sign up
            </Link>
          </p>
          <p>
            <Link to="/forgot-password" className="text-yale-blue hover:text-maple-rust hover:underline text-xs uppercase tracking-widest">
              Forgot your password?
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}