'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import FormAction from '@/components/FormAction';
import Input from '@/components/Input';

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Liên kết không hợp lệ. Vui lòng yêu cầu đặt lại mật khẩu lại.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      if (!response.ok) {
        setError('Liên kết đã hết hạn hoặc không hợp lệ. Vui lòng yêu cầu liên kết mới.');
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
      <Input
        handleChange={(e) => setNewPassword(e.target.value)}
        value={newPassword}
        labelText="New password"
        labelFor="new-password"
        id="new-password"
        name="new-password"
        type="password"
        isRequired
        placeholder="Mật khẩu mới"
      />
      <Input
        handleChange={(e) => setConfirmPassword(e.target.value)}
        value={confirmPassword}
        labelText="Confirm new password"
        labelFor="confirm-new-password"
        id="confirm-new-password"
        name="confirm-new-password"
        type="password"
        isRequired
        placeholder="Xác nhận mật khẩu mới"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <FormAction text={isSubmitting ? 'Đang lưu...' : 'Đặt lại mật khẩu'} />
    </form>
  );
}
