'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save, Trash2, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useTransition } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Logo } from '@/components/app/logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { SettingsRow } from '@/lib/database.types';
import { RECEIPT_FORMATS } from '@/lib/receipt';
import { IMAGE_TYPES, settingsSchema, validateImage, type SettingsFormOutput, type SettingsFormValues } from '@/lib/validation';
import { removeLogoAction, saveSettingsAction, uploadLogoAction } from './actions';

export function LogoCard({ settings }: { settings: SettingsRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    const invalid = validateImage(file);
    if (invalid || !file) {
      if (invalid) toast.error(invalid);
      return;
    }
    const data = new FormData();
    data.set('logo', file);
    startTransition(async () => {
      const result = await uploadLogoAction(data);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success('Logo mis à jour.');
        router.refresh();
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await removeLogoAction();
      if (!result.ok) toast.error(result.error);
      else {
        toast.success('Logo retiré.');
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logo officiel</CardTitle>
        <CardDescription>
          Téléversez le fichier fourni par MassaGui Fils (PNG ou WebP sur fond transparent de préférence). Il est affiché tel
          quel, sans déformation, sur la connexion, le menu et l’en-tête.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-4">
        <div className="flex size-24 items-center justify-center rounded-lg border bg-white p-2">
          <Logo logoUrl={settings.logo_url} name={settings.name} size={80} />
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={input} type="file" accept={IMAGE_TYPES.join(',')} onChange={upload} className="sr-only" id="logo-file" />
          <Button type="button" onClick={() => input.current?.click()} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Upload />} {settings.logo_url ? 'Remplacer' : 'Téléverser'}
          </Button>
          {settings.logo_url && (
            <Button type="button" variant="outline" onClick={remove} disabled={pending}>
              <Trash2 /> Retirer
            </Button>
          )}
        </div>
        {!settings.logo_url && (
          <p className="w-full text-xs text-muted-foreground">
            Aucun logo téléversé : un monogramme provisoire « MG » est affiché.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function SettingsForm({ settings }: { settings: SettingsRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<SettingsFormValues, unknown, SettingsFormOutput>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: settings.name,
      tagline: settings.tagline ?? '',
      address: settings.address ?? '',
      phone: settings.phone ?? '',
      email: settings.email ?? '',
      currency: settings.currency,
      receiptFooter: settings.receipt_footer ?? '',
      receiptFormat: settings.receipt_format,
      receiptPrefix: settings.receipt_prefix,
      stockEnabled: settings.stock_enabled,
      posShowImages: settings.pos_show_images,
      timezone: settings.timezone,
    },
  });
  const { errors, isDirty } = form.formState;

  const submit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await saveSettingsAction(values);
      if (!result.ok) {
        for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (messages?.[0]) form.setError(field as keyof SettingsFormValues, { message: messages[0] });
        }
        toast.error(result.error);
        return;
      }
      toast.success('Paramètres enregistrés.');
      form.reset(form.getValues());
      router.refresh();
    }),
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Établissement</CardTitle>
          <CardDescription>Ces informations figurent sur les reçus. Laissez vide ce que vous ne souhaitez pas afficher.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom de l’établissement" htmlFor="s-name" error={errors.name?.message}>
            <Input id="s-name" {...form.register('name')} />
          </Field>
          <Field label="Activité (sous-titre)" htmlFor="s-tagline" error={errors.tagline?.message}>
            <Input id="s-tagline" placeholder="Hôtellerie — Restaurant" {...form.register('tagline')} />
          </Field>
          <Field label="Adresse" htmlFor="s-address" error={errors.address?.message} className="sm:col-span-2">
            <Input id="s-address" {...form.register('address')} />
          </Field>
          <Field label="Téléphone" htmlFor="s-phone" error={errors.phone?.message}>
            <Input id="s-phone" type="tel" {...form.register('phone')} />
          </Field>
          <Field label="E-mail professionnel" htmlFor="s-email" error={errors.email?.message}>
            <Input id="s-email" type="email" {...form.register('email')} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reçus et devise</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Devise" htmlFor="s-currency" hint="Code à 3 lettres. Montants sans décimales (adapté au GNF)." error={errors.currency?.message}>
            <Input id="s-currency" maxLength={3} {...form.register('currency')} />
          </Field>
          <Field label="Format d’impression par défaut" htmlFor="s-format">
            <NativeSelect id="s-format" {...form.register('receiptFormat')}>
              {RECEIPT_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field
            label="Préfixe des numéros de reçu"
            htmlFor="s-prefix"
            hint="Ex. MG → MG-2026-000001. S’applique aux ventes suivantes."
            error={errors.receiptPrefix?.message}
          >
            <Input id="s-prefix" maxLength={6} {...form.register('receiptPrefix')} />
          </Field>
          <Field label="Fuseau horaire" htmlFor="s-tz" hint="Africa/Conakry pour la Guinée." error={errors.timezone?.message}>
            <Input id="s-tz" {...form.register('timezone')} />
          </Field>
          <Field label="Texte de pied de reçu" htmlFor="s-footer" error={errors.receiptFooter?.message} className="sm:col-span-2">
            <Textarea id="s-footer" rows={2} {...form.register('receiptFooter')} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stocks et caisse</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Controller
            control={form.control}
            name="stockEnabled"
            render={({ field }) => (
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="s-stock" className="flex-col items-start gap-0.5">
                  Gestion des stocks
                  <span className="text-xs font-normal text-muted-foreground">
                    Désactivée : aucune vente n’est bloquée ni ne décrémente le stock.
                  </span>
                </Label>
                <Switch id="s-stock" checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />
          <Controller
            control={form.control}
            name="posShowImages"
            render={({ field }) => (
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="s-images" className="flex-col items-start gap-0.5">
                  Photos des produits à la caisse
                  <span className="text-xs font-normal text-muted-foreground">Désactivez pour une caisse plus compacte et plus légère.</span>
                </Label>
                <Switch id="s-images" checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <Button type="submit" size="lg" disabled={pending || !isDirty} className="shadow-md">
          {pending ? <Loader2 className="animate-spin" /> : <Save />} Enregistrer les paramètres
        </Button>
      </div>
    </form>
  );
}
