'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState, type ReactNode } from 'react';
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Path,
  type Resolver,
} from 'react-hook-form';
import type { ZodType } from 'zod';
import { FormField } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

/**
 * Create and edit for the reference lists. The three resources differ only by
 * their fields, so they share one dialog rather than three near-identical ones.
 * Validation uses the same zod schema the API applies.
 */

export interface FieldSpec {
  name: string;
  label: string;
  hint?: string;
  /** A select renders its options; anything else is a text input. */
  options?: readonly { value: string; label: string }[];
  placeholder?: string;
}

export interface RecordFormDialogProps<T extends FieldValues> {
  title: string;
  description?: string;
  trigger: ReactNode;
  schema: ZodType<T>;
  fields: readonly FieldSpec[];
  defaultValues: DefaultValues<T>;
  submitLabel: string;
  action: (values: T) => Promise<{ error: string } | void>;
}

export function RecordFormDialog<T extends FieldValues>({
  title,
  description,
  trigger,
  schema,
  fields,
  defaultValues,
  submitLabel,
  action,
}: RecordFormDialogProps<T>) {
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  /**
   * The form is driven generically, so it is typed loosely inside and narrowed
   * at the boundary. zod has already validated the values by the time `action`
   * receives them, so the assertion holds.
   */
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FieldValues>({
    // The schema is chosen at runtime, so its generics cannot line up with the
    // resolver's. zod still validates; only the typing is widened here.
    resolver: zodResolver(
      schema as unknown as Parameters<typeof zodResolver>[0],
    ) as Resolver<FieldValues>,
    defaultValues: defaultValues as DefaultValues<FieldValues>,
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await action(values as T);

    if (result?.error) {
      // Includes the API's refusals, e.g. a category code that is already in use.
      setFormError(result.error);
      return;
    }

    setOpen(false);
    reset(defaultValues as DefaultValues<FieldValues>);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setFormError(null);
          reset(defaultValues as DefaultValues<FieldValues>);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {formError ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {formError}
            </p>
          ) : null}

          {fields.map((field) => {
            const message = errors[field.name as Path<T>]?.message;

            return (
              <FormField
                key={field.name}
                id={field.name}
                label={field.label}
                {...(field.hint ? { hint: field.hint } : {})}
                {...(typeof message === 'string' ? { error: message } : {})}
              >
                {field.options ? (
                  <select
                    id={field.name}
                    aria-invalid={Boolean(message)}
                    className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none aria-invalid:border-destructive"
                    {...register(field.name as Path<T>)}
                  >
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id={field.name}
                    aria-invalid={Boolean(message)}
                    {...(field.placeholder ? { placeholder: field.placeholder } : {})}
                    {...register(field.name as Path<T>)}
                  />
                )}
              </FormField>
            );
          })}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm" disabled={isSubmitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
