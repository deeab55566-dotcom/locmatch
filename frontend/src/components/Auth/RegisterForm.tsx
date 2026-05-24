import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { RegisterCredentials } from '@/types/models';
import { validateEmail, validatePassword } from '@/utils/helpers';

export const RegisterForm: React.FC = () => {
  const { register, isLoading, error } = useAuth();
  const [formData, setFormData] = useState<RegisterCredentials>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
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
    if (!formData.firstName) errors.firstName = 'First name is required';
    if (!formData.lastName) errors.lastName = 'Last name is required';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      await register(formData);
    } catch (_) {}
  };

  const isFormFilled = formData.email && formData.password && formData.firstName && formData.lastName;

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '0' }}>
        <div className="input-float">
          <input
            id="firstName"
            type="text"
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            placeholder=" "
            disabled={isLoading}
            autoComplete="given-name"
          />
          <label htmlFor="firstName">First Name</label>
          {validationErrors.firstName && (
            <span className="error">{validationErrors.firstName}</span>
          )}
        </div>

        <div className="input-float">
          <input
            id="lastName"
            type="text"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            placeholder=" "
            disabled={isLoading}
            autoComplete="family-name"
          />
          <label htmlFor="lastName">Last Name</label>
          {validationErrors.lastName && (
            <span className="error">{validationErrors.lastName}</span>
          )}
        </div>
      </div>

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
        <label htmlFor="email">Mobile Number or Email</label>
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
          autoComplete="new-password"
        />
        <label htmlFor="password">Password</label>
        {validationErrors.password && (
          <span className="error">{validationErrors.password}</span>
        )}
      </div>

      <p style={{ fontSize: '12px', color: 'var(--ig-secondary)', textAlign: 'center', margin: '12px 0' }}>
        People who use our service may have uploaded your contact information to FriendsFinder.
      </p>

      {error && <div className="error-message">{error}</div>}

      <button
        type="submit"
        disabled={isLoading || !isFormFilled}
        className="btn btn-primary"
      >
        {isLoading ? 'Signing up...' : 'Sign Up'}
      </button>
    </form>
  );
};
