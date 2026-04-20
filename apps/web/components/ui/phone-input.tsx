'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import type { Country, FlagProps, Labels } from 'react-phone-number-input';
import PhoneInputPrimitive, {
  getCountryCallingCode,
} from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags';
import ko from 'react-phone-number-input/locale/ko.json';
import 'react-phone-number-input/style.css';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/cn';

type PhoneInputProps = Omit<
  React.ComponentProps<'input'>,
  'onChange' | 'value' | 'ref'
> & {
  value: string;
  onChange: (value: string) => void;
};

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, onChange, value, ...props }, ref) => (
    <PhoneInputPrimitive
      ref={ref as never}
      className={cn('flex', className)}
      labels={ko as Labels}
      defaultCountry="KR"
      flagComponent={FlagComponent}
      countrySelectComponent={CountrySelect}
      inputComponent={InputComponent}
      smartCaret={false}
      value={value || undefined}
      onChange={(v) => onChange(v ?? '')}
      {...props}
    />
  ),
);
PhoneInput.displayName = 'PhoneInput';

const InputComponent = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<'input'>
>(({ className, ...props }, ref) => (
  <Input
    {...props}
    ref={ref}
    className={cn('rounded-s-none rounded-e-lg', className)}
  />
));
InputComponent.displayName = 'InputComponent';

type CountrySelectOption = {
  label: string;
  value: Country;
};

type CountrySelectProps = {
  disabled?: boolean;
  value: Country;
  onChange: (value: Country) => void;
  options: CountrySelectOption[];
};

function CountrySelect({
  disabled,
  value,
  onChange,
  options,
}: CountrySelectProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="flex h-11 gap-1 rounded-s-lg rounded-e-none px-3"
          disabled={disabled}
          aria-label={
            value
              ? `국가 선택: ${(ko as Record<string, string>)[value] ?? value}`
              : '국가 선택'
          }
        >
          <FlagComponent
            country={value}
            countryName={(ko as Record<string, string>)[value] ?? value}
          />
          <ChevronsUpDown
            className={cn(
              '-mr-2 h-4 w-4 opacity-50',
              disabled ? 'hidden' : 'opacity-100',
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="국가 검색..." />
          <CommandList>
            <ScrollArea className="h-72">
              <CommandEmpty>일치하는 국가가 없습니다.</CommandEmpty>
              <CommandGroup>
                {options
                  .filter((option): option is CountrySelectOption =>
                    Boolean(option.value),
                  )
                  .map((option) => (
                    <CommandItem
                      className="gap-2"
                      key={option.value}
                      onSelect={() => onChange(option.value)}
                    >
                      <FlagComponent
                        country={option.value}
                        countryName={option.label}
                      />
                      <span className="flex-1 text-sm">{option.label}</span>
                      <span className="text-sm text-gray-500">
                        +{getCountryCallingCode(option.value)}
                      </span>
                      <Check
                        className={cn(
                          'ml-auto h-4 w-4',
                          option.value === value ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                    </CommandItem>
                  ))}
              </CommandGroup>
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function FlagComponent({ country, countryName }: FlagProps) {
  const Flag = flags[country];
  return (
    <span className="flex h-4 w-6 overflow-hidden rounded-sm bg-gray-100">
      {Flag ? <Flag title={countryName} /> : null}
    </span>
  );
}

export { PhoneInput };
export type { PhoneInputProps };
