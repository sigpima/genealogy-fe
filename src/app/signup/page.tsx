import AuthHeader from '@/components/auth/AuthHeader';
import Signup from './components/signupForm';

export default function SignupPage() {
  return (
    <div className="flex h-screen min-h-full items-center justify-center bg-app px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <AuthHeader
          heading="Create a new account"
          paragraph="Already have an account? "
          linkName="Login"
          linkUrl="/login"
        />
        <Signup />
      </div>
    </div>
  );
}
