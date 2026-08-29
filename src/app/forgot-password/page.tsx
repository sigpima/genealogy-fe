import AuthHeader from '@/components/auth/AuthHeader';
import ForgotPasswordForm from './components/forgotPasswordForm';

export default function ForgotPasswordPage() {
  return (
    <div className="flex h-screen min-h-full items-center justify-center bg-app px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <AuthHeader
          heading="Quên mật khẩu"
          paragraph="Đã nhớ mật khẩu? "
          linkName="Đăng nhập"
          linkUrl="/login"
        />
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
