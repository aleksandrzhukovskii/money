import { useState } from 'react'
import { useDatabase } from '@/hooks/useDatabase'
import { useTagsStore } from '@/stores/tags'
import { Badge } from '@/components/ui/badge'
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
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react'

interface TagPickerProps {
  selectedTagIds: number[]
  onChange: (ids: number[]) => void
}

export function TagPicker({ selectedTagIds, onChange }: TagPickerProps) {
  const { db, persistDebounced } = useDatabase()
  const { items: tags, add } = useTagsStore()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  function toggle(tagId: number) {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId))
    } else {
      onChange([...selectedTagIds, tagId])
    }
  }

  function handleCreate() {
    if (!db || !search.trim()) return
    const name = search.trim()
    // Avoid duplicates
    const existing = tags.find(t => t.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      if (!selectedTagIds.includes(existing.id)) {
        onChange([...selectedTagIds, existing.id])
      }
    } else {
      const id = add(db, { name })
      persistDebounced()
      onChange([...selectedTagIds, id])
    }
    setSearch('')
  }

  const selectedTags = tags.filter(t => selectedTagIds.includes(t.id))
  const noMatch = search.trim() && !tags.some(t => t.name.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="justify-between font-normal w-full"
          >
            <span className="truncate text-sm">
              {selectedTagIds.length === 0
                ? 'Select tags...'
                : `${selectedTagIds.length} tag${selectedTagIds.length > 1 ? 's' : ''}`}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search or create..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {tags
                .filter(t => !search.trim() || t.name.toLowerCase().includes(search.trim().toLowerCase()))
                .map(tag => {
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
              {noMatch && (
                <CommandItem onSelect={handleCreate}>
                  <Plus className="mr-2 h-4 w-4 shrink-0" />
                  Create &quot;{search.trim()}&quot;
                </CommandItem>
              )}
              {!search.trim() && tags.length === 0 && (
                <CommandEmpty>Type to create a tag</CommandEmpty>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.map(tag => (
            <Badge key={tag.id} variant="default" className="cursor-pointer select-none">
              {tag.name}
              <X className="h-3 w-3 ml-1" onClick={() => toggle(tag.id)} />
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
