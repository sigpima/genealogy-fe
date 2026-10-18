import AuthHeader from '@/components/auth/AuthHeader';
import Login from './components/loginForm';

export default function LoginPage() {
  return (
    <div className="flex h-screen min-h-full items-center justify-center bg-app px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <AuthHeader
          heading="Login to your account"
          paragraph="Tài khoản do quản trị viên của họ tạo hoặc gửi link mời cho bạn."
        />
        <Login />
      </div>
    </div>
  );
}
