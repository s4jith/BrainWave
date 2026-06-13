"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@components/ui/Button";
import { Input } from "@components/ui/Input";
import { AuthService } from "@services/AuthService";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  type ForgotPasswordFormValues,
  type ResetPasswordFormValues,
} from "../schemas/auth.schemas";

type Step = "request" | "reset" | "done";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");

  const requestForm = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const resetForm = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: "", otp: "", newPassword: "", confirmPassword: "" },
  });

  const requestMutation = useMutation({
    mutationFn: (values: ForgotPasswordFormValues) =>
      AuthService.forgotPassword(values.email.trim().toLowerCase()),
    onSuccess: (data, variables) => {
      if (data.success) {
        setEmail(variables.email);
        resetForm.setValue("email", variables.email);
        setStep("reset");
      }
    },
  });

  const resetMutation = useMutation({
    mutationFn: (values: ResetPasswordFormValues) =>
      AuthService.resetPassword(values.email, values.otp, values.newPassword),
    onSuccess: (data) => {
      if (data.success) setStep("done");
    },
  });

  if (step === "done") {
    return (
      <div className="w-full max-w-md text-center">
        <h1 className="mb-3 text-3xl font-bold text-slate-900">Password reset</h1>
        <p className="mb-6 text-slate-500">
          Your password was updated. You can now sign in with the new password.
        </p>
        <Button size="lg" className="w-full" onClick={() => router.replace("/login")}>
          Back to sign in
        </Button>
      </div>
    );
  }

  if (step === "reset") {
    return (
      <form
        onSubmit={resetForm.handleSubmit((v) => resetMutation.mutate(v))}
        className="w-full max-w-md space-y-4"
      >
        <h1 className="text-3xl font-bold text-slate-900">Enter OTP</h1>
        <p className="text-sm text-slate-500">We sent a one-time code to {email}.</p>
        <Input
          placeholder="OTP"
          error={resetForm.formState.errors.otp?.message}
          {...resetForm.register("otp")}
        />
        <Input
          type="password"
          placeholder="New password"
          error={resetForm.formState.errors.newPassword?.message}
          {...resetForm.register("newPassword")}
        />
        <Input
          type="password"
          placeholder="Confirm new password"
          error={resetForm.formState.errors.confirmPassword?.message}
          {...resetForm.register("confirmPassword")}
        />
        {resetMutation.data && !resetMutation.data.success ? (
          <p className="text-sm text-red-500">{resetMutation.data.error}</p>
        ) : null}
        <Button type="submit" size="lg" className="w-full" loading={resetMutation.isPending}>
          Reset password
        </Button>
      </form>
    );
  }

  return (
    <form
      onSubmit={requestForm.handleSubmit((v) => requestMutation.mutate(v))}
      className="w-full max-w-md space-y-4"
    >
      <h1 className="text-3xl font-bold text-slate-900">Forgot password?</h1>
      <p className="text-sm text-slate-500">
        Enter your email and we'll send you a one-time code to reset your password.
      </p>
      <Input
        type="email"
        placeholder="Your email"
        error={requestForm.formState.errors.email?.message}
        {...requestForm.register("email")}
      />
      {requestMutation.data && !requestMutation.data.success ? (
        <p className="text-sm text-red-500">{requestMutation.data.error}</p>
      ) : null}
      <Button type="submit" size="lg" className="w-full" loading={requestMutation.isPending}>
        Send code
      </Button>
    </form>
  );
}
