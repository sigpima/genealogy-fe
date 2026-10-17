'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { signupFields } from '@/constants/formFields';
import FormAction from '@/components/FormAction';
import Input from '@/components/Input';
import {
  signupNotice,
  signupResultMessage,
  type AccountStatus,
  type SiteInfo,
} from '@/lib/auth/session';

const fields = signupFields;
const fieldsState: { [key: string]: string } = {};
fields.forEach((field) => (fieldsState[field.id] = ''));

export default function Signup() {
  const router = useRouter();
  const [signupState, setSignupState] = useState(fieldsState);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/site/info')
      .then((response) =>
        response.ok ? (response.json() as Promise<SiteInfo>) : null,
      )
      .then(setSiteInfo)
      .catch(() => setSiteInfo(null));
  }, []);
  const isClosed = siteInfo?.registration === 'closed';
  const notice = signupNotice(siteInfo);

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
      if (response.status === 403) {
        setError(
          'Đăng ký tài khoản đang đóng. Hãy nhờ quản trị viên tạo tài khoản cho bạn.',
        );
        return;
      }
      if (!response.ok) {
        setError('Đăng ký thất bại. Vui lòng thử lại.');
        return;
      }
      const created = (await response.json()) as { status: AccountStatus };
      const message = signupResultMessage(created.status);
      if (message) {
        setSuccess(message);
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
      {success ? (
        <p
          role="status"
          className="rounded-lg bg-surface-muted p-4 text-sm text-default"
        >
          {success}
        </p>
      ) : (
        <div>
          {notice && (
            <p
              role="note"
              className="mb-4 rounded-lg bg-surface-muted p-3 text-sm text-muted"
            >
              {notice}
            </p>
          )}
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
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          {!isClosed && (
            <FormAction text={isSubmitting ? 'Đang đăng ký...' : 'Signup'} />
          )}
        </div>
      )}
    </form>
  );
}
