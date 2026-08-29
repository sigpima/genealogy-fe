export default function FormExtra() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <input id="remember-me" name="remember-me" type="checkbox" className="size-4 rounded border-default" />
        <label htmlFor="remember-me" className="ml-2 block text-sm text-default">
          Remember me
        </label>
      </div>

      <div className="text-sm">
        <a href="#" className="font-medium accent-text hover:underline">
          Forgot your password?
        </a>
      </div>
    </div>
  );
}
