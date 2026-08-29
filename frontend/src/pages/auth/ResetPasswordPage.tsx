import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../../services/apiServices';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setTokenError('Missing reset token. Please request a new password reset link.');
    }
  }, [token]);

  const mutation = useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: () => {
      setIsSuccess(true);
      setErrorMsg('');
      toast.success("Password reset successfully");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Failed to reset password. Please try again.';
      const code = err.response?.data?.code;
      
      if (code === 'INVALID_TOKEN' || code === 'USED_TOKEN' || code === 'EXPIRED_TOKEN') {
        setTokenError(msg);
      } else {
        setErrorMsg(msg);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }
    
    if (password.includes(' ')) {
      setErrorMsg('Password must not contain spaces.');
      return;
    }
    
    if (!token) return;

    mutation.mutate({ token, password });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
            IN
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          Create new password
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-900 py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100 dark:border-gray-800">
          
          {tokenError ? (
            <div className="text-center space-y-4">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30">
                <span className="text-red-600 dark:text-red-400 font-bold text-xl">!</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Link Invalid or Expired</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tokenError}
              </p>
              <div className="pt-4 space-y-3">
                <Link to="/forgot-password" className="flex w-full justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700">
                  Request new link
                </Link>
                <Link to="/login" className="block text-sm font-medium text-brand-600 hover:text-brand-500 mt-3">
                  Return to login
                </Link>
              </div>
            </div>
          ) : isSuccess ? (
            <div className="text-center space-y-4">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Password Reset Complete</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Your password has been successfully reset. All previous sessions have been logged out for your security.
              </p>
              <div className="pt-4">
                <Link to="/login" className="flex w-full justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700">
                  Sign in with new password
                </Link>
              </div>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              {errorMsg && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-3 rounded-lg text-sm border border-red-100 dark:border-red-900">
                  {errorMsg}
                </div>
              )}

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-300">
                <p className="font-semibold mb-1">Password Requirements:</p>
                <ul className="list-disc list-inside space-y-0.5 text-blue-700/80 dark:text-blue-300/80 text-xs">
                  <li>Minimum 8 characters</li>
                  <li>At least 1 uppercase and 1 lowercase letter</li>
                  <li>At least 1 number and 1 special character</li>
                  <li>No spaces</li>
                  <li>Must not equal username or email</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  New Password
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full pl-10 pr-10 px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm text-gray-900 dark:text-white"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Confirm New Password
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="appearance-none block w-full pl-10 px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm text-gray-900 dark:text-white"
                    placeholder="Confirm new password"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={mutation.isPending}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50"
                >
                  {mutation.isPending ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
