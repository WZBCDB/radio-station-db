"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface AuthFormProps {
  mode: "login" | "register";
}

export default function AuthForm({ mode }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        if (password !== confirmPassword) {
          setError("Passwords do not match");
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError("Password needs at least 6 characters");
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-5">
      <div className="bg-white rounded-xl p-10 shadow-2xl w-full max-w-md">
        <h1 className="text-indigo-500 text-3xl font-bold text-center mb-7">
          Radio Station DB
        </h1>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 border-l-4 border-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <div className="mb-4">
              <label className="block mb-1.5 text-sm font-semibold text-gray-700">
                Display Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full p-2.5 border-2 border-gray-200 rounded-md focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>
          )}

          <div className="mb-4">
            <label className="block mb-1.5 text-sm font-semibold text-gray-700">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@university.edu"
              className="w-full p-2.5 border-2 border-gray-200 rounded-md focus:outline-none focus:border-indigo-500 text-sm"
            />
          </div>

          <div className="mb-4">
            <label className="block mb-1.5 text-sm font-semibold text-gray-700">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              className="w-full p-2.5 border-2 border-gray-200 rounded-md focus:outline-none focus:border-indigo-500 text-sm"
            />
          </div>

          {mode === "register" && (
            <div className="mb-4">
              <label className="block mb-1.5 text-sm font-semibold text-gray-700">
                Confirm Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                className="w-full p-2.5 border-2 border-gray-200 rounded-md focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full p-3 bg-indigo-500 text-white rounded-md font-semibold hover:bg-indigo-600 transition disabled:opacity-50"
          >
            {loading
              ? "Please wait..."
              : mode === "register"
                ? "Create Account"
                : "Sign In"}
          </button>
        </form>

        <p className="text-center mt-5 text-sm text-gray-500">
          {mode === "register" ? (
            <>
              Already have an account?{" "}
              <Link href="/login" className="text-indigo-500 font-semibold">
                Sign In
              </Link>
            </>
          ) : (
            <>
              Need an account?{" "}
              <Link href="/register" className="text-indigo-500 font-semibold">
                Register
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
