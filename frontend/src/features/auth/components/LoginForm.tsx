"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@components/ui/Button";
import { Input } from "@components/ui/Input";
import { loginSchema, type LoginFormValues } from "../schemas/auth.schemas";
import { useLogin } from "../hooks/useLogin";

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const login = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit((values) => login.mutate(values));

  const serverError =
    login.data && !login.data.success
      ? login.data.error
      : login.isError
      ? "Login failed. Please check your credentials and try again."
      : null;

  return (
    <div className="w-full max-w-md">
      <div className="mb-10 text-center">
        <h1 className="mb-3 text-4xl font-bold text-slate-900">Welcome back!</h1>
        <p className="text-slate-500">Sign in with your email and password to continue.</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          type="email"
          placeholder="Your email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Your password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((p) => !p)}
            className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        <div className="text-left">
          <Link href="/forgot-password" className="text-sm text-green-500 hover:text-green-600">
            Forgot password?
          </Link>
        </div>
        {serverError ? (
          <p className="text-center text-sm text-red-500">{serverError}</p>
        ) : null}
        <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
          Sign In
        </Button>
      </form>
      <p className="mt-10 text-center text-sm text-slate-400">
        Please contact your administrator if you need an account.
      </p>
    </div>
  );
}
