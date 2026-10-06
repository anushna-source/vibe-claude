'use client';

import { Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Input } from '@/components/ui/input';

export interface SearchInputProps {
  placeholder?: string;
  label?: string;
}

/**
 * Writes the term into the URL, so the result is linkable and shareable and
 * paging keeps the filter. Submits on enter rather than on every keystroke.
 */
export function SearchInput({ placeholder = 'Search', label = 'Search' }: SearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get('q') ?? '');

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const next = new URLSearchParams(searchParams.toString());
    if (value.trim()) next.set('q', value.trim());
    else next.delete('q');
    // A new search starts at the first page.
    next.delete('page');

    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <form onSubmit={onSubmit} role="search" className="relative w-full sm:max-w-xs">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        name="q"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
        }}
        className="pl-9"
      />
    </form>
  );
}
