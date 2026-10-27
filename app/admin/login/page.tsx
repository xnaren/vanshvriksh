// Admin sign-in — separate from the passwordless user login. The
// admin signs in with a username + password + OTP code, all checked
// server-side against environment variables on first use, then
// against hashed values in admin_settings (see lib/admin-auth.ts).
// No credential is ever rendered here or stored in the browser.
import { adminLogin } from "../actions";

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-1">Admin console</h1>
      <p className="text-stone-600 mb-6 text-sm">
        Sign in with the admin username, password and code. This session
        is separate from regular user sign-in and lasts 12 hours.
      </p>
      {searchParams.error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
          {searchParams.error}
        </div>
      )}
      <form action={adminLogin} className="card space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Admin username</label>
          <input name="username" autoComplete="username" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Code</label>
          <input
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
          />
        </div>
        <button type="submit">Sign in as admin</button>
      </form>
      <p className="text-xs text-stone-500 mt-4">
        Regular user?{" "}
        <a href="/login" className="text-emerald-700 underline">
          Go to user sign-in
        </a>
      </p>
    </div>
  );
}
