import { Link, useRouter, useSearch } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import { useLogin, useRegister } from "../api/queries";
import { Logo } from "../ui/bits";

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link to="/" className="inline-block">
          <Logo />
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-fg">{title}</h1>
        <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
        <div className="mt-7">{children}</div>
      </div>
    </div>
  );
}

function Field(props: { label: string; name: string; type?: string; autoComplete: string; minLength?: number }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-muted">{props.label}</span>
      <input
        required
        name={props.name}
        type={props.type ?? "text"}
        autoComplete={props.autoComplete}
        minLength={props.minLength}
        className="h-10 rounded-md border border-line bg-panel px-3 text-sm text-fg outline-none focus:border-amber-dim"
      />
    </label>
  );
}

function Submit({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 h-10 rounded-md bg-amber-fill text-sm font-medium text-on-amber disabled:opacity-60"
    >
      {pending ? "One moment…" : children}
    </button>
  );
}

function useAfterAuth() {
  const router = useRouter();
  const { redirect } = useSearch({ strict: false }) as { redirect?: string };
  return () => router.history.push(redirect ?? "/");
}

const formValue = (e: FormEvent<HTMLFormElement>, name: string) =>
  String(new FormData(e.currentTarget).get(name) ?? "");

export function LoginPage() {
  const login = useLogin();
  const done = useAfterAuth();
  const { redirect } = useSearch({ strict: false }) as { redirect?: string };
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to pick up where you left off.">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          login.mutate({ email: formValue(e, "email"), password: formValue(e, "password") }, { onSuccess: done });
        }}
      >
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <Field label="Password" name="password" type="password" autoComplete="current-password" />
        {login.error && <p className="text-sm text-bad">{login.error.message}</p>}
        <Submit pending={login.isPending}>Sign in</Submit>
      </form>
      <p className="mt-6 text-sm text-muted">
        {"New here? "}
        <Link to="/register" search={redirect ? { redirect } : {}} className="text-amber hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}

export function RegisterPage() {
  const register = useRegister();
  const done = useAfterAuth();
  const { redirect } = useSearch({ strict: false }) as { redirect?: string };
  const [mismatch, setMismatch] = useState(false);
  return (
    <AuthShell title="Create your account" subtitle="Keep your progress, and anything you've played here, on any device.">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const password = formValue(e, "password");
          const same = password === formValue(e, "confirm");
          setMismatch(!same);
          if (!same) return;
          register.mutate(
            { display_name: formValue(e, "display_name"), email: formValue(e, "email"), password },
            { onSuccess: done },
          );
        }}
      >
        <Field label="Display name" name="display_name" autoComplete="nickname" />
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <Field label="Password" name="password" type="password" autoComplete="new-password" minLength={8} />
        <Field label="Confirm password" name="confirm" type="password" autoComplete="new-password" minLength={8} />
        {mismatch && <p className="text-sm text-bad">The passwords don't match.</p>}
        {register.error && <p className="text-sm text-bad">{register.error.message}</p>}
        <Submit pending={register.isPending}>Create account</Submit>
      </form>
      <p className="mt-6 text-sm text-muted">
        {"Already have an account? "}
        <Link to="/login" search={redirect ? { redirect } : {}} className="text-amber hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
