'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerStep1Schema, type RegisterStep1Input } from '@grabit/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from '@/components/ui/form';
import { PasswordInput } from '@/components/auth/password-input';

interface SignupStep1Props {
  onComplete: (data: RegisterStep1Input) => void;
  defaultValues: RegisterStep1Input | null;
}

export function SignupStep1({ onComplete, defaultValues }: SignupStep1Props) {
  const form = useForm<RegisterStep1Input>({
    resolver: zodResolver(registerStep1Schema),
    defaultValues: defaultValues ?? {
      email: '',
      password: '',
      passwordConfirm: '',
    },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  function onSubmit(data: RegisterStep1Input) {
    onComplete(data);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>이메일 <span className="text-error">*</span></FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="이메일을 입력해주세요"
                  autoComplete="email"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>비밀번호 <span className="text-error">*</span></FormLabel>
              <FormControl>
                <PasswordInput
                  placeholder="비밀번호를 입력해주세요"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormDescription>8자 이상, 영문+숫자+특수문자 포함</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="passwordConfirm"
          render={({ field }) => (
            <FormItem>
              <FormLabel>비밀번호 확인 <span className="text-error">*</span></FormLabel>
              <FormControl>
                <PasswordInput
                  placeholder="비밀번호를 다시 입력해주세요"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="pt-2">
          <Button type="submit" size="lg" className="w-full">
            다음
          </Button>
        </div>
      </form>
    </Form>
  );
}
