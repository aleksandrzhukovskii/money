import { Input } from '@/components/ui/input'

interface FilterInputProps {
  value: string
  onChange: (value: string) => void
}

export function FilterInput({ value, onChange }: FilterInputProps) {
  return (
    <Input
      type="text"
      placeholder="Filter (| or , for OR)"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mb-3 h-8 w-full text-base"
    />
  )
}
