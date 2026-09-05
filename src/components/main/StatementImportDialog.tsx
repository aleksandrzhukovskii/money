import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Ban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatCents } from '@/lib/format'
import { buildPreview, parseStatementFile, type Preview } from '@/lib/statementImport'
import type { Database } from 'sql.js'

interface StatementImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  db: Database | null
  onConfirm: (preview: Preview) => void
}

export function StatementImportDialog({
  open,
  onOpenChange,
  db,
  onConfirm,
}: StatementImportDialogProps) {
  const [text, setText] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)

  function reset() {
    setText('')
    setParseError(null)
    setPreview(null)
  }

  function handleAnalyse(raw: string) {
    setText(raw)
    setParseError(null)
    setPreview(null)
    if (!raw.trim() || !db) return
    try {
      setPreview(buildPreview(db, parseStatementFile(raw)))
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    handleAnalyse(await file.text())
    e.target.value = ''
  }

  const blocked = (preview?.errors.length ?? 0) > 0
  const importable = preview?.rows.length ?? 0

  const rateWarnings = useMemo(
    () => preview?.rows.filter((r) => r.rateSource === 'none').length ?? 0,
    [preview],
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import statement</DialogTitle>
          <DialogDescription>
            Paste the JSON produced by the statement tool, or pick the file. Nothing is
            written until you approve it, and no new budgets, incomes or spending types
            are ever created.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto max-h-[65vh]">
          <textarea
            value={text}
            onChange={(e) => handleAnalyse(e.target.value)}
            placeholder='{"version": 1, "rows": [ ... ] }'
            spellCheck={false}
            className="w-full h-28 rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />

          <div className="flex items-center gap-2">
            <input
              id="statement-file"
              type="file"
              accept=".json"
              onChange={handleFile}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('statement-file')?.click()}
            >
              Choose file
            </Button>
            {text && (
              <Button variant="ghost" size="sm" onClick={reset}>
                Clear
              </Button>
            )}
          </div>

          {parseError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {parseError}
            </p>
          )}

          {preview && (
            <>
              <p className="text-xs text-muted-foreground">
                {preview.rows.length + preview.errors.length} rows
                {preview.dateFrom && ` · ${preview.dateFrom} to ${preview.dateTo}`}
              </p>

              {blocked && (
                <section className="rounded-md border border-red-200 bg-red-50 p-3">
                  <h3 className="flex items-center gap-1.5 text-sm font-medium text-red-800">
                    <Ban className="size-4" />
                    {preview.errors.length} row{preview.errors.length === 1 ? '' : 's'} cannot be
                    imported
                  </h3>
                  <p className="mt-1 text-xs text-red-700">
                    Every name must already exist in the app. Fix these in the tool and export
                    again — nothing here will be imported until they're resolved.
                  </p>
                  <ul className="mt-2 space-y-0.5 text-xs text-red-800">
                    {preview.errors.slice(0, 12).map((e, i) => (
                      <li key={i}>
                        <span className="text-red-500">
                          sheet row {e.sourceLines.join(', ') || '?'}:
                        </span>{' '}
                        {e.message}
                      </li>
                    ))}
                    {preview.errors.length > 12 && (
                      <li className="text-red-500">…and {preview.errors.length - 12} more</li>
                    )}
                  </ul>
                </section>
              )}

              {preview.budgetDeltas.length > 0 && (
                <section>
                  <h3 className="mb-1.5 text-sm font-medium">Budget changes</h3>
                  <div className="rounded-md border border-gray-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-xs text-muted-foreground">
                          <th className="px-3 py-1.5 text-left font-medium">Budget</th>
                          <th className="px-3 py-1.5 text-right font-medium">Now</th>
                          <th className="px-3 py-1.5 text-right font-medium">Change</th>
                          <th className="px-3 py-1.5 text-right font-medium">After</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.budgetDeltas.map((b) => (
                          <tr key={b.name} className="border-b border-gray-100 last:border-0">
                            <td className="px-3 py-1.5 truncate">{b.name}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                              {formatCents(b.current, b.currency)}
                            </td>
                            <td
                              className={`px-3 py-1.5 text-right tabular-nums ${
                                b.delta < 0 ? 'text-red-600' : 'text-emerald-600'
                              }`}
                            >
                              {b.delta > 0 ? '+' : ''}
                              {formatCents(b.delta, b.currency)}
                            </td>
                            <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                              {formatCents(b.projected, b.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {preview.budgetDeltas.some((b) => b.projected < 0) && (
                    <p className="mt-1 text-xs text-amber-700">
                      One or more budgets end up negative — worth a second look.
                    </p>
                  )}
                </section>
              )}

              {preview.warnings.length > 0 && (
                <section className="rounded-md border border-amber-200 bg-amber-50 p-3">
                  <h3 className="flex items-center gap-1.5 text-sm font-medium text-amber-800">
                    <AlertTriangle className="size-4" />
                    {preview.warnings.length} warning
                    {preview.warnings.length === 1 ? '' : 's'}
                  </h3>
                  <ul className="mt-1.5 space-y-0.5 text-xs text-amber-800">
                    {preview.warnings.slice(0, 8).map((w, i) => (
                      <li key={i}>
                        <span className="text-amber-600">
                          sheet row {w.sourceLines.join(', ') || '?'}:
                        </span>{' '}
                        {w.message}
                      </li>
                    ))}
                    {preview.warnings.length > 8 && (
                      <li className="text-amber-600">
                        …and {preview.warnings.length - 8} more
                      </li>
                    )}
                  </ul>
                  {rateWarnings > 0 && (
                    <p className="mt-1.5 text-xs text-amber-700">
                      Rows without a rate still import; statistics convert them at
                      display time as usual.
                    </p>
                  )}
                </section>
              )}

              {!blocked && preview.rows.length > 0 && (
                <details className="rounded-md border border-gray-200 p-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Show the {preview.rows.length} transactions
                  </summary>
                  <ul className="mt-2 space-y-0.5 text-xs">
                    {preview.rows.map((r, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <span className="text-muted-foreground tabular-nums">{r.row.date}</span>
                        <span className="truncate">{r.row.from}</span>
                        <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                        <span className="truncate">{r.row.to}</span>
                        <span className="ml-auto shrink-0 tabular-nums">
                          {r.row.amount.toFixed(2)} {r.row.currency}
                          {r.convertedAmount != null && (
                            <span className="text-muted-foreground">
                              {' '}
                              → {r.convertedAmount.toFixed(2)} {r.convertedCurrency}
                              {r.rateSource === 'database' && ' (rate from app)'}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!preview || blocked || importable === 0}
            onClick={() => preview && onConfirm(preview)}
          >
            Import {importable > 0 ? importable : ''} transaction
            {importable === 1 ? '' : 's'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
