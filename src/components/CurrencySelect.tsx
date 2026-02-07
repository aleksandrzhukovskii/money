import { useState, useMemo } from 'react'
import { useCurrencies } from '@/hooks/useCurrencies'
import { useDatabase } from '@/hooks/useDatabase'
import { getActiveUserCurrencies } from '@/db/queries/exchangeRates'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Check, ChevronsUpDown } from 'lucide-react'

interface CurrencySelectProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function CurrencySelect({ value, onChange, placeholder = 'Select currency' }: CurrencySelectProps) {
  const { db } = useDatabase()
  const { currencies, loading } = useCurrencies()
  const [open, setOpen] = useState(false)

  const usedCodes = useMemo(() => {
    if (!db) return new Set<string>()
    return new Set(getActiveUserCurrencies(db))
  }, [db])

  const usedCurrencies = currencies.filter((c) => usedCodes.has(c.code))
  const otherCurrencies = currencies.filter((c) => !usedCodes.has(c.code))

  const selectedLabel = currencies.find((c) => c.code === value)
  const displayText = selectedLabel
    ? `${selectedLabel.code} — ${selectedLabel.name}`
    : loading ? 'Loading...' : placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{displayText}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search currency..." />
          <CommandList>
            <CommandEmpty>No currency found.</CommandEmpty>
            {usedCurrencies.length > 0 && (
              <CommandGroup heading="Used">
                {usedCurrencies.map((c) => (
                  <CommandItem
                    key={c.code}
                    value={`${c.code} ${c.name}`}
                    onSelect={() => { onChange(c.code); setOpen(false) }}
                  >
                    <Check className={`mr-2 h-4 w-4 ${value === c.code ? 'opacity-100' : 'opacity-0'}`} />
                    {c.code} — {c.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading={usedCurrencies.length > 0 ? 'All' : undefined}>
              {otherCurrencies.map((c) => (
                <CommandItem
                  key={c.code}
                  value={`${c.code} ${c.name}`}
                  onSelect={() => { onChange(c.code); setOpen(false) }}
                >
                  <Check className={`mr-2 h-4 w-4 ${value === c.code ? 'opacity-100' : 'opacity-0'}`} />
                  {c.code} — {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
