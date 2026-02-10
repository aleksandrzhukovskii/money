import { useState } from 'react'
import { useTagsStore } from '@/stores/tags'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Check, ChevronsUpDown, Tag } from 'lucide-react'

interface TagMultiSelectProps {
  selectedTagIds: number[]
  onChange: (ids: number[]) => void
}

export function TagMultiSelect({ selectedTagIds, onChange }: TagMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const { items: tags } = useTagsStore()

  function toggle(tagId: number) {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter(id => id !== tagId))
    } else {
      onChange([...selectedTagIds, tagId])
    }
  }

  const label = selectedTagIds.length === 0
    ? 'All tags'
    : `${selectedTagIds.length} tag${selectedTagIds.length > 1 ? 's' : ''}`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="justify-between font-normal"
        >
          <span className="flex items-center gap-1.5 truncate">
            <Tag className="h-3.5 w-3.5 shrink-0 opacity-50" />
            {label}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search tags..." />
          <CommandList>
            <CommandEmpty>No tags found.</CommandEmpty>
            {tags.map(tag => {
              const selected = selectedTagIds.includes(tag.id)
              return (
                <CommandItem
                  key={tag.id}
                  value={tag.name}
                  onSelect={() => toggle(tag.id)}
                >
                  <Check className={`mr-2 h-4 w-4 shrink-0 ${selected ? 'opacity-100' : 'opacity-0'}`} />
                  {tag.name}
                </CommandItem>
              )
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
