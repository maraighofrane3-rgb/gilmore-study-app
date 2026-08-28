import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/update-password', // We can build this later if needed
    });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Check your email for the password reset link.' });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-parchment p-4">
      <div className="w-full max-w-md bg-page-cream p-8 rounded-sm border border-coffee-cream/20 shadow-cozy animate-fade-in-up">
        <Link to="/login" className="flex items-center gap-2 text-coffee-cream hover:text-maple-rust font-ui text-sm transition-colors mb-6">
          <ArrowLeft size={16} /> Back to Login
        </Link>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-yale-blue/10 text-yale-blue mb-4">
            <Mail size={24} />
          </div>
          <h1 className="font-display text-3xl text-yale-blue">Forgot Password?</h1>
          <p className="font-body text-sm text-coffee-cream mt-2">Enter your email and we'll send you a link to reset it.</p>
        </div>

        {message.text && (
          <div className={`p-3 rounded-sm border flex items-center gap-2 font-ui text-sm mb-4 ${
            message.type === 'success' ? 'bg-porch-sage/10 border-porch-sage/30 text-porch-sage' : 'bg-maple-rust/10 border-maple-rust/30 text-maple-rust'
          }`}>
            <CheckCircle size={16} /> {message.text}
          </div>
        )}

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block font-ui text-xs uppercase tracking-widest text-coffee-cream mb-1">Email Address</label>
            <input 
              type="email" required value={email} 
              onChange={e => setEmail(e.target.value)}
              className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body"
              placeholder="scholar@yale.edu"
            />
          </div>
          <button 
            type="submit" disabled={loading}
            className="w-full bg-maple-rust text-page-cream py-3 rounded-sm font-ui text-xs uppercase tracking-widest hover:bg-yale-blue transition-colors disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
      </div>
    </div>
  );
}