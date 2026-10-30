'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Loader2, Pencil, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Controller, useForm, useWatch, type Control } from 'react-hook-form';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ProfileRow } from '@/lib/database.types';
import { formatDate } from '@/lib/format';
import { PERMISSIONS, ROLE_LABELS, type Permission } from '@/lib/permissions';
import {
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
  type CreateUserValues,
  type ResetPasswordValues,
  type UpdateUserValues,
} from '@/lib/validation';
import { createUserAction, resetPasswordAction, updateUserAction } from './actions';

function PermissionsField({
  control,
  disabled,
}: {
  control: Control<CreateUserValues> | Control<UpdateUserValues>;
  disabled: boolean;
}) {
  return (
    <Controller
      control={control as Control<CreateUserValues>}
      name="permissions"
      render={({ field }) => (
        <fieldset className="grid gap-2 rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">Permissions</legend>
          {disabled && <p className="text-xs text-muted-foreground">Un administrateur dispose de toutes les permissions.</p>}
          {PERMISSIONS.map((p) => {
            const checked = disabled || (field.value ?? []).includes(p.key);
            return (
              <div key={p.key} className="flex items-start gap-2">
                <Checkbox
                  id={`perm-${p.key}`}
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(value) => {
                    const current = new Set<Permission>(field.value ?? []);
                    if (value === true) current.add(p.key);
                    else current.delete(p.key);
                    field.onChange([...current]);
                  }}
                  className="mt-0.5"
                />
                <Label htmlFor={`perm-${p.key}`} className="flex-col items-start gap-0.5 font-normal">
                  <span className="font-medium">{p.label}</span>
                  <span className="text-xs text-muted-foreground">{p.description}</span>
                </Label>
              </div>
            );
          })}
        </fieldset>
      )}
    />
  );
}

function CreateUserDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { fullName: '', email: '', password: '', role: 'cashier', permissions: [] },
  });
  const { errors } = form.formState;
  const role = useWatch({ control: form.control, name: 'role' });

  const submit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await createUserAction(values);
      if (!result.ok) {
        for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (messages?.[0]) form.setError(field as keyof CreateUserValues, { message: messages[0] });
        }
        toast.error(result.error);
        return;
      }
      toast.success('Compte créé. Communiquez le mot de passe à l’utilisateur en main propre.');
      onClose();
      router.refresh();
    }),
  );

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Nouvel utilisateur</DialogTitle>
            <DialogDescription>Le compte est actif immédiatement. Mot de passe : 10 caractères minimum, lettres et chiffres.</DialogDescription>
          </DialogHeader>
          <Field label="Nom complet" htmlFor="u-name" error={errors.fullName?.message}>
            <Input id="u-name" autoComplete="off" {...form.register('fullName')} />
          </Field>
          <Field label="E-mail" htmlFor="u-email" error={errors.email?.message}>
            <Input id="u-email" type="email" autoComplete="off" {...form.register('email')} />
          </Field>
          <Field label="Mot de passe provisoire" htmlFor="u-password" error={errors.password?.message}>
            <Input id="u-password" type="text" autoComplete="new-password" {...form.register('password')} />
          </Field>
          <Field label="Rôle" htmlFor="u-role">
            <NativeSelect id="u-role" {...form.register('role')}>
              <option value="cashier">{ROLE_LABELS.cashier}</option>
              <option value="admin">{ROLE_LABELS.admin}</option>
            </NativeSelect>
          </Field>
          <PermissionsField control={form.control} disabled={role === 'admin'} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Créer le compte
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, isSelf, onClose }: { user: ProfileRow; isSelf: boolean; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<UpdateUserValues>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      id: user.id,
      fullName: user.full_name,
      role: user.role,
      permissions: user.permissions as Permission[],
      isActive: user.is_active,
    },
  });
  const { errors } = form.formState;
  const role = useWatch({ control: form.control, name: 'role' });

  const submit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await updateUserAction(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Utilisateur mis à jour.');
      onClose();
      router.refresh();
    }),
  );

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Modifier {user.full_name || user.email}</DialogTitle>
            <DialogDescription>{user.email}</DialogDescription>
          </DialogHeader>
          <Field label="Nom complet" htmlFor="e-name" error={errors.fullName?.message}>
            <Input id="e-name" {...form.register('fullName')} />
          </Field>
          <Field label="Rôle" htmlFor="e-role" hint={isSelf ? 'Vous ne pouvez pas modifier votre propre rôle.' : undefined}>
            {isSelf ? (
              <Input id="e-role" value={ROLE_LABELS[user.role]} readOnly />
            ) : (
              <NativeSelect id="e-role" {...form.register('role')}>
                <option value="cashier">{ROLE_LABELS.cashier}</option>
                <option value="admin">{ROLE_LABELS.admin}</option>
              </NativeSelect>
            )}
          </Field>
          <PermissionsField control={form.control} disabled={role === 'admin'} />
          <Controller
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="e-active" className="flex-col items-start gap-0.5">
                  Compte actif
                  <span className="text-xs font-normal text-muted-foreground">
                    Un compte désactivé ne peut plus se connecter ; son historique est conservé.
                  </span>
                </Label>
                <Switch id="e-active" checked={field.value} onCheckedChange={field.onChange} disabled={isSelf} />
              </div>
            )}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PasswordDialog({ user, onClose }: { user: ProfileRow; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { id: user.id, password: '' },
  });
  const submit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await resetPasswordAction(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Mot de passe modifié.');
      onClose();
    }),
  );
  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Nouveau mot de passe</DialogTitle>
            <DialogDescription>Pour {user.full_name || user.email}. 10 caractères minimum, lettres et chiffres.</DialogDescription>
          </DialogHeader>
          <Field label="Mot de passe" htmlFor="p-password" error={form.formState.errors.password?.message}>
            <Input id="p-password" type="text" autoComplete="new-password" {...form.register('password')} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UsersManager({ users, currentUserId, canManageAuth }: { users: ProfileRow[]; currentUserId: string; canManageAuth: boolean }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ProfileRow | null>(null);
  const [password, setPassword] = useState<ProfileRow | null>(null);
  const permissionLabel = new Map<string, string>(PERMISSIONS.map((p) => [p.key, p.label]));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {!canManageAuth ? (
          <p className="rounded-md bg-warning px-3 py-2 text-sm text-warning-foreground">
            Création de comptes et mots de passe indisponibles : SUPABASE_SERVICE_ROLE_KEY n’est pas configurée.
          </p>
        ) : (
          <span />
        )}
        <Button onClick={() => setCreating(true)} disabled={!canManageAuth}>
          <UserPlus /> Nouvel utilisateur
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Utilisateur</TableHead>
            <TableHead>Rôle</TableHead>
            <TableHead>Permissions</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Créé le</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>
                <p className="font-medium">
                  {u.full_name || '—'} {u.id === currentUserId && <span className="text-xs text-muted-foreground">(vous)</span>}
                </p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </TableCell>
              <TableCell className="whitespace-nowrap">{ROLE_LABELS[u.role]}</TableCell>
              <TableCell>
                {u.role === 'admin' ? (
                  <span className="text-xs text-muted-foreground">Toutes</span>
                ) : u.permissions.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Caisse et ses ventes</span>
                ) : (
                  <div className="flex max-w-xs flex-wrap gap-1">
                    {u.permissions.map((p) => (
                      <Badge key={p} variant="secondary">
                        {permissionLabel.get(p) ?? p}
                      </Badge>
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell>{u.is_active ? <Badge variant="success">Actif</Badge> : <Badge variant="destructive">Désactivé</Badge>}</TableCell>
              <TableCell className="whitespace-nowrap">{formatDate(u.created_at)}</TableCell>
              <TableCell className="text-right whitespace-nowrap">
                <Button variant="ghost" size="icon-sm" onClick={() => setEditing(u)} aria-label={`Modifier ${u.full_name}`}>
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setPassword(u)}
                  disabled={!canManageAuth}
                  aria-label={`Changer le mot de passe de ${u.full_name}`}
                >
                  <KeyRound />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {creating && <CreateUserDialog onClose={() => setCreating(false)} />}
      {editing && <EditUserDialog user={editing} isSelf={editing.id === currentUserId} onClose={() => setEditing(null)} />}
      {password && <PasswordDialog user={password} onClose={() => setPassword(null)} />}
    </>
  );
}
