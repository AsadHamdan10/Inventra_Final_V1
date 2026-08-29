import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { authApi } from '../../services/apiServices';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authApi.login(form);
      setAuth(data.user, data.accessToken);
      toast.success(`Welcome back, ${data.user.companyName}!`);
      if (data.user.forcePasswordChange) {
        navigate('/change-password');
      } else {
        navigate(data.user.role === 'super_admin' ? '/admin' : '/');
      }
    } catch (err: any) {
      let message: string;
      if (err.response) {
        message =
          err.response.data?.error ||
          err.response.data?.message ||
          'Login failed. Please try again.';
      } else {
        // No response received — network/server unreachable.
        message = 'Unable to connect to server. Please try again.';
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Sign in</h2>
        <p className="text-sm text-gray-500 mt-0.5">Enter your credentials to continue</p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Username or Email
        </label>
        <input
          className="input"
          type="text"
          placeholder="your@email.com"
          value={form.username}
          onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
          required
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Password
        </label>
        <div className="relative">
          <input
            className="input pr-10"
            type={showPass ? 'text' : 'password'}
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            required
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            onClick={() => setShowPass((s) => !s)}
          >
            {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
        <LogIn size={16} />
        {loading ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="text-center text-sm text-gray-500">
        Don't have an account?{' '}
        <Link to="/register" className="text-brand-600 hover:text-brand-700 font-medium">
          Register
        </Link>
      </p>
      <div className="mt-4 text-center text-sm"><Link to="/forgot-password" className="text-brand-600 hover:text-brand-500 font-medium">Forgot your password?</Link></div>
            </form>
  );
}