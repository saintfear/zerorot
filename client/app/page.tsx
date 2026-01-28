'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authAPI, userAPI } from '@/lib/api';

export default function Home() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    if (token) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = isLogin
        ? await authAPI.login(email, password)
        : await authAPI.signup(email, password, name);

      localStorage.setItem('token', response.data.token);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen antique-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full antique-card rounded-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-typewriter font-bold text-antique-700 mb-2 tracking-wider">ZeroRot</h1>
          <p className="text-antique-600 font-mono text-sm">AI-powered content discovery</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!isLogin && (
            <div>
              <label className="block text-sm font-mono font-semibold text-antique-700 mb-2">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 bg-parchment-light border-2 border-sepia-light rounded focus:ring-2 focus:ring-sepia-dark focus:border-sepia-dark text-antique-800 placeholder-antique-400 font-mono"
                placeholder="Your name"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-mono font-semibold text-antique-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 bg-parchment-light border-2 border-sepia-light rounded focus:ring-2 focus:ring-sepia-dark focus:border-sepia-dark text-antique-800 placeholder-antique-400 font-mono"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-mono font-semibold text-antique-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 bg-parchment-light border-2 border-sepia-light rounded focus:ring-2 focus:ring-sepia-dark focus:border-sepia-dark text-antique-800 placeholder-antique-400 font-mono"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-100 border-2 border-red-300 text-red-800 px-4 py-3 rounded font-mono text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sepia hover:bg-sepia-dark text-antique-50 py-3 rounded font-typewriter font-bold tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
          >
            {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-sepia-dark hover:text-antique-700 text-sm font-mono underline"
          >
            {isLogin
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
