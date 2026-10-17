'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { loginFields } from '@/constants/formFields';
import FormAction from '@/components/FormAction';
import { loginErrorMessage } from '@/lib/auth/session';
import FormExtra from '@/components/FormExtra';
import Input from '@/components/Input';

const fields = loginFields;
const fieldsState: { [key: string]: string } = {};
fields.forEach((field) => (fieldsState[field.id] = ''));

export default function Login() {
  const router = useRouter();
  const [loginState, setLoginState] = useState(fieldsState);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoginState({ ...loginState, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginState['email-address'],
          password: loginState['password'],
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        setError(loginErrorMessage(response.status, body?.detail));
        return;
      }
      router.push('/');
    } catch {
      setError('Không thể kết nối tới máy chủ. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
      <div className="-space-y-px">
        {fields.map((field) => (
          <Input
            key={field.id}
            handleChange={handleChange}
            value={loginState[field.id]}
            labelText={field.labelText}
            labelFor={field.labelFor}
            id={field.id}
            name={field.name}
            type={field.type}
            isRequired={field.isRequired}
            placeholder={field.placeholder}
          />
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <FormExtra />
      <FormAction text={isSubmitting ? 'Đang đăng nhập...' : 'Login'} />
    </form>
  );
}
