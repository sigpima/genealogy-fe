'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signupFields } from '@/constants/formFields';
import FormAction from '@/components/FormAction';
import Input from '@/components/Input';

const fields = signupFields;
const fieldsState: { [key: string]: string } = {};
fields.forEach((field) => (fieldsState[field.id] = ''));

export default function Signup() {
  const router = useRouter();
  const [signupState, setSignupState] = useState(fieldsState);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSignupState({ ...signupState, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (signupState['password'] !== signupState['confirm-password']) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: signupState['email-address'],
          password: signupState['password'],
          full_name: signupState['full-name'],
        }),
      });
      if (response.status === 409) {
        setError('Email này đã được đăng ký.');
        return;
      }
      if (!response.ok) {
        setError('Đăng ký thất bại. Vui lòng thử lại.');
        return;
      }
      router.push('/login');
    } catch {
      setError('Không thể kết nối tới máy chủ. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
      <div>
        {fields.map((field) => (
          <Input
            key={field.id}
            handleChange={handleChange}
            value={signupState[field.id]}
            labelText={field.labelText}
            labelFor={field.labelFor}
            id={field.id}
            name={field.name}
            type={field.type}
            isRequired={field.isRequired}
            placeholder={field.placeholder}
          />
        ))}
        {error && <p className="text-sm text-danger">{error}</p>}
        <FormAction text={isSubmitting ? 'Đang đăng ký...' : 'Signup'} />
      </div>
    </form>
  );
}
