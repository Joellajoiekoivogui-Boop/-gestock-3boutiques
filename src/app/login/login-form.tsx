'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { loginAction } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { loginSchema, type LoginInput } from '@/lib/validation';

export function LoginForm({ next, initialError }: { next: string | null; initialError: string | null }) {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [pending, startTransition] = useTransition();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await loginAction(values, next);
        if (result && !result.ok) setError(result.error);
      } catch (e) {
        // Une redirection réussie n'arrive jamais ici ; seules les vraies
        // erreurs réseau le font.
        if (e instanceof Error && !e.message.includes('NEXT_REDIRECT')) {
          setError('Connexion au serveur impossible. Vérifiez votre connexion puis réessayez.');
        } else {
          throw e;
        }
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {error && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <Field label="Adresse e-mail" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          autoFocus
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          {...form.register('email')}
        />
      </Field>
      <Field label="Mot de passe" htmlFor="password" error={errors.password?.message}>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            className="pr-10"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
            {...form.register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {pending ? 'Connexion…' : 'Se connecter'}
      </Button>
    </form>
  );
}
