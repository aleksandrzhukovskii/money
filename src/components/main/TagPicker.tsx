import { useState } from 'react'
import { useDatabase } from '@/hooks/useDatabase'
import { useTagsStore } from '@/stores/tags'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
    if (!db || !newTagName.trim()) return
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
        <div className="flex gap-1 items-center">
          <Input
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tag name"
            className="h-7 w-28 text-sm"
          />
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleAddTag} disabled={!newTagName.trim()}>
            Add
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-1" onClick={() => { setShowInput(false); setNewTagName('') }}>
            <X className="h-3 w-3" />
          </Button>
        </div>
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
