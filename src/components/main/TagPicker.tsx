import { useState } from 'react'
import { useDatabase } from '@/hooks/useDatabase'
import { useTagsStore } from '@/stores/tags'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Plus, X } from 'lucide-react'

interface TagPickerProps {
  selectedTagIds: number[]
  onChange: (ids: number[]) => void
}

export function TagPicker({ selectedTagIds, onChange }: TagPickerProps) {
  const { db, persistDebounced } = useDatabase()
  const { items: tags, add } = useTagsStore()
  const [showInput, setShowInput] = useState(false)
  const [newTagName, setNewTagName] = useState('')

  function toggleTag(tagId: number) {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId))
    } else {
      onChange([...selectedTagIds, tagId])
    }
  }

  function handleAddTag() {
    if (!db || !newTagName.trim()) {
      setShowInput(false)
      setNewTagName('')
      return
    }
    const id = add(db, { name: newTagName.trim() })
    persistDebounced()
    onChange([...selectedTagIds, id])
    setNewTagName('')
    setShowInput(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    } else if (e.key === 'Escape') {
      setShowInput(false)
      setNewTagName('')
    }
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {tags.map((tag) => {
        const selected = selectedTagIds.includes(tag.id)
        return (
          <Badge
            key={tag.id}
            variant={selected ? 'default' : 'outline'}
            className="cursor-pointer select-none"
            onClick={() => toggleTag(tag.id)}
          >
            {tag.name}
            {selected && <X className="h-3 w-3 ml-1" />}
          </Badge>
        )
      })}
      {showInput ? (
        <Input
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleAddTag}
          placeholder="Tag name"
          className="h-7 w-28 text-base"
          autoFocus
        />
      ) : (
        <Badge
          variant="outline"
          className="cursor-pointer border-dashed"
          onClick={() => setShowInput(true)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Tag
        </Badge>
      )}
    </div>
  )
}
