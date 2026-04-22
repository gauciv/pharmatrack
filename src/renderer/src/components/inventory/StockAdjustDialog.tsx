import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { InventoryItem } from '../../types/inventory'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Label } from '../ui/label'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { cn } from '../../lib/utils'

export type StockAdjustMode = 'stock-in' | 'stock-out'

interface StockAdjustDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: InventoryItem | null
  onSubmit: (item: InventoryItem, mode: StockAdjustMode, quantity: number) => Promise<void>
}

export function StockAdjustDialog({
  open,
  onOpenChange,
  item,
  onSubmit,
}: StockAdjustDialogProps): JSX.Element {
  const [mode, setMode] = useState<StockAdjustMode>('stock-in')
  const [quantityText, setQuantityText] = useState('1')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setSubmitting(false)
      setError(null)
      return
    }

    setMode('stock-in')
    setQuantityText('1')
    setSubmitting(false)
    setError(null)
  }, [open, item?.id])

  const quantity = useMemo(() => {
    const parsed = Number.parseInt(quantityText, 10)
    if (!Number.isFinite(parsed)) return NaN
    return parsed
  }, [quantityText])

  const hasValidQuantity = Number.isFinite(quantity) && quantity > 0
  const currentOnHand = item?.onHand ?? 0
  const delta = hasValidQuantity ? (mode === 'stock-in' ? quantity : -quantity) : 0
  const nextOnHand = currentOnHand + delta
  const stockOutExceedsOnHand = mode === 'stock-out' && hasValidQuantity && quantity > currentOnHand
  const stockOutUnavailable = mode === 'stock-out' && currentOnHand <= 0
  const hasInvalidStockOut = stockOutUnavailable || stockOutExceedsOnHand

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!item || !hasValidQuantity) return

    setSubmitting(true)
    setError(null)

    try {
      await onSubmit(item, mode, quantity)
      onOpenChange(false)
    } catch (err) {
      setError((err as Error).message || 'Unable to adjust stock right now.')
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-silver-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <DialogHeader>
          <DialogTitle className="text-sm">Adjust Stock Level</DialogTitle>
          <DialogDescription className="text-xs">
            {item ? (
              <>
                <span className="font-mono">{item.itemCode}</span> · {item.description}
              </>
            ) : (
              'Select an inventory item to adjust stock.'
            )}
          </DialogDescription>
        </DialogHeader>

        {item && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-md border border-silver-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Current On Hand</p>
              <p className="mt-1 text-lg font-mono font-semibold text-charcoal-800 dark:text-gray-100">
                {item.onHand.toLocaleString()}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="stock-adjust-mode" className="text-xs">Movement</Label>
                <Select
                  value={mode}
                  onValueChange={(value) => setMode(value as StockAdjustMode)}
                  disabled={submitting}
                >
                  <SelectTrigger id="stock-adjust-mode" className="h-9 text-xs">
                    <SelectValue placeholder="Select movement" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stock-in">Stock In (Add)</SelectItem>
                    <SelectItem value="stock-out">Stock Out (Deduct)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="stock-adjust-qty" className="text-xs">Quantity</Label>
                <Input
                  id="stock-adjust-qty"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={quantityText}
                  onChange={(event) => setQuantityText(event.target.value)}
                  disabled={submitting}
                  className="h-9 text-sm font-mono"
                />
              </div>
            </div>

            {!hasValidQuantity && (
              <p className="text-xs text-destructive">Enter a quantity greater than 0.</p>
            )}

            {stockOutUnavailable && (
              <p className="text-xs text-destructive">
                Stock out is unavailable because on hand is 0 or below.
              </p>
            )}

            {stockOutExceedsOnHand && !stockOutUnavailable && (
              <p className="text-xs text-destructive">
                Cannot deduct more than current on hand ({currentOnHand.toLocaleString()}).
              </p>
            )}

            {hasValidQuantity && (
              <div className="rounded-md border border-silver-200 dark:border-gray-700 p-3 space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Preview</p>
                <p className="font-mono text-sm text-charcoal-800 dark:text-gray-100">
                  {currentOnHand.toLocaleString()} {mode === 'stock-in' ? '+' : '-'} {quantity.toLocaleString()} = {nextOnHand.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  This saves as a {mode === 'stock-in' ? 'Stock In' : 'Stock Out'} transaction.
                </p>
                {mode === 'stock-in' && nextOnHand < 0 && (
                  <p className={cn('text-xs font-medium text-amber-700 dark:text-amber-400')}>
                    Result remains negative on hand.
                  </p>
                )}
              </div>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!hasValidQuantity || hasInvalidStockOut || submitting}>
                {submitting ? 'Saving...' : mode === 'stock-in' ? 'Apply Stock In' : 'Apply Stock Out'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}