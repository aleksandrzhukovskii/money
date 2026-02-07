import { create } from 'zustand'
import type { Tag } from '@/types/database'
import { getTags, insertTag, updateTag, deleteTag } from '@/db/queries/tags'
import type { Database } from 'sql.js'

interface TagsState {
  items: Tag[]
  load: (db: Database) => void
  add: (db: Database, data: { name: string; color?: string }) => number
  update: (db: Database, id: number, data: Partial<Pick<Tag, 'name' | 'color'>>) => void
  remove: (db: Database, id: number) => void
}

export const useTagsStore = create<TagsState>((set) => ({
  items: [],
  load: (db) => {
    set({ items: getTags(db) })
  },
  add: (db, data) => {
    const id = insertTag(db, data)
    set({ items: getTags(db) })
    return id
  },
  update: (db, id, data) => {
    updateTag(db, id, data)
    set({ items: getTags(db) })
  },
  remove: (db, id) => {
    deleteTag(db, id)
    set({ items: getTags(db) })
  },
}))
