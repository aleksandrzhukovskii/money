import { useState } from 'react'
import { useAppStore } from '@/stores/app'
import { formatCents, formatCentsShort } from '@/lib/format'
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

export interface ComboboxItem {
  id: number
  type: 'income' | 'budget' | 'spending'
  name: string
  currency: string
  /** Display amount in cents */
  displayAmount: number
  /** e.g. "earned", "balance", "spent" */
  amountLabel: string
}

export interface ComboboxGroup {
  type: 'income' | 'budget' | 'spending'
  heading: string
}

interface EntityComboboxProps {
  label: string
  items: ComboboxItem[]
  value: { type: string; id: number } | null
  onChange: (key: { type: string; id: number } | null) => void
  groups: ComboboxGroup[]
  placeholder?: string
}

export function EntityCombobox({ label, items, value, onChange, groups, placeholder = 'Select...' }: EntityComboboxProps) {
  const [open, setOpen] = useState(false)
  const compact = useAppStore(s => s.compactAmounts)
  const fmt = compact ? formatCentsShort : formatCents

  const selected = value ? items.find(i => i.type === value.type && i.id === value.id) : null

  const displayText = selected
    ? `${selected.name} (${selected.currency})`
    : placeholder

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
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
            <CommandInput placeholder="Search..." />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              {groups.map(group => {
                const groupItems = items.filter(i => i.type === group.type)
                if (groupItems.length === 0) return null
                return (
                  <CommandGroup key={group.type} heading={group.heading}>
                    {groupItems.map(item => {
                      const isSelected = value?.type === item.type && value?.id === item.id
                      const amountColor = item.amountLabel === 'balance'
                        ? item.displayAmount >= 0 ? 'text-emerald-600' : 'text-red-600'
                        : item.amountLabel === 'spent' ? 'text-red-600' : 'text-emerald-600'
                      return (
                        <CommandItem
                          key={`${item.type}-${item.id}`}
                          value={`${item.type}-${item.id} ${item.name}`}
                          onSelect={() => {
                            onChange({ type: item.type, id: item.id })
                            setOpen(false)
                          }}
                        >
                          <Check className={`mr-2 h-4 w-4 shrink-0 ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                          <span className="truncate flex-1">{item.name}</span>
                          <span className={`ml-2 text-xs shrink-0 ${amountColor}`}>
                            {fmt(item.displayAmount, item.currency)}
                          </span>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                )
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
