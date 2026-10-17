'use client';

import { useState } from 'react';
import FormAction from '@/components/FormAction';
import Input from '@/components/Input';
import { TOO_MANY_ATTEMPTS } from '@/lib/auth/session';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        setError(response.status === 429 ? TOO_MANY_ATTEMPTS : 'Không thể gửi yêu cầu. Vui lòng thử lại.');
        return;
      }
      setSubmitted(true);
    } catch {
      setError('Không thể kết nối tới máy chủ. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <p className="mt-8 text-center text-sm text-default">
        Nếu email này tồn tại, chúng tôi đã gửi một liên kết đặt lại mật khẩu. Vui lòng
        kiểm tra hộp thư của bạn.
      </p>
    );
  }

  return (
    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
      <Input
        handleChange={(e) => setEmail(e.target.value)}
        value={email}
        labelText="Email address"
        labelFor="email-address"
        id="email-address"
        name="email"
        type="email"
        isRequired
        placeholder="Email address"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <FormAction text={isSubmitting ? 'Đang gửi...' : 'Gửi liên kết đặt lại'} />
    </form>
  );
}
