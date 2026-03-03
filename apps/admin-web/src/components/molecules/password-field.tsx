'use client';

import {
  Button,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@telumi/ui';
import { HugeiconsIcon } from '@hugeicons/react';
import { EyeIcon, ViewOffIcon } from '@hugeicons/core-free-icons';
import { useState } from 'react';
import { type Control, type FieldPath, type FieldValues } from 'react-hook-form';

type PasswordFieldProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  labelRight?: React.ReactNode;
  placeholder: string;
  autoComplete?: React.HTMLInputAutoCompleteAttribute;
  belowInput?: React.ReactNode;
};

export function PasswordField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  labelRight,
  placeholder,
  autoComplete = 'current-password',
  belowInput,
}: PasswordFieldProps<TFieldValues>) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="relative flex flex-col gap-1">
          <div className="flex items-baseline justify-between mt-2.5 mb-1.5">
            <FormLabel className="text-sm font-medium cursor-pointer text-foreground transition-all duration-150 ease-in-out">
              {label}
            </FormLabel>
            <FormMessage className="text-[11px] font-medium text-destructive mt-0 leading-none" />
          </div>
          {labelRight && (
            <div className="absolute top-2.5 right-0">
              {labelRight}
            </div>
          )}
          <FormControl>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder={placeholder}
                autoComplete={autoComplete}
                className="flex w-full border border-input bg-transparent shadow-none transition-colors h-[46px] rounded-xl px-4 text-base md:text-sm focus-visible:ring-[0.5px] focus-visible:ring-offset-0 focus-visible:border-foreground pr-10 [&:-webkit-autofill]:bg-transparent [&:-webkit-autofill]:shadow-[0_0_0_30px_white_inset] [&:-webkit-autofill]:text-fill-color-[black]"
                {...field}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-1/2 -translate-y-1/2 right-1 flex items-center h-8 w-8 hover:bg-transparent"
                onClick={() => setShowPassword((previousState) => !previousState)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? (
                  <HugeiconsIcon icon={ViewOffIcon} size={16} className="text-muted-foreground" />
                ) : (
                  <HugeiconsIcon icon={EyeIcon} size={16} className="text-muted-foreground" />
                )}
              </Button>
            </div>
          </FormControl>
          {belowInput && (
            <div className="flex justify-end mt-1">
              {belowInput}
            </div>
          )}
        </FormItem>
      )}
    />
  );
}
