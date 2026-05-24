import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { LoginCredentials } from '@/types/models';
import { validateEmail, validatePassword } from '@/utils/helpers';

export const LoginForm: React.FC = () => {
  const { login, isLoading, error } = useAuth();
  const [formData, setFormData] = useState<LoginCredentials>({
    email: '',
    password: '',
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (validationErrors[name]) {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      errors.email = 'Invalid email format';
    }
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (!validatePassword(formData.password)) {
      errors.password = 'Password must be at least 6 characters';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      await login(formData);
    } catch (_) {}
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="input-float">
        <input
          id="email"
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder=" "
          disabled={isLoading}
          autoComplete="email"
        />
        <label htmlFor="email">Phone number, username, or email</label>
        {validationErrors.email && (
          <span className="error">{validationErrors.email}</span>
        )}
      </div>

      <div className="input-float">
        <input
          id="password"
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          placeholder=" "
          disabled={isLoading}
          autoComplete="current-password"
        />
        <label htmlFor="password">Password</label>
        {validationErrors.password && (
          <span className="error">{validationErrors.password}</span>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      <button
        type="submit"
        disabled={isLoading || !formData.email || !formData.password}
        className="btn btn-primary"
        style={{ marginTop: '12px' }}
      >
        {isLoading ? 'Logging in...' : 'Log In'}
      </button>
    </form>
  );
};
