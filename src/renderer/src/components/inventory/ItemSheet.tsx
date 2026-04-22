import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { InventoryItem } from '../../types/inventory'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '../ui/sheet'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Checkbox } from '../ui/checkbox'
import { cn } from '../../lib/utils'

interface ItemSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: InventoryItem | null
  vendors: string[]
  categories: string[]
  binLocations: string[]
  palletNumbers: string[]
  onSubmit: (data: Omit<InventoryItem, 'id'>) => Promise<void>
}

type FormData = {
  itemCode: string
  description: string
  vendor: string
  category: string
  prefVendor: string
  binLocation: string
  palletNumber: string
  onHand: string
  reorderPt: string
  order: string
  onPO: string
  nextDeliv: string
  salesPerWeek: string
  trackExpiry: boolean
  lotTracking: EditableLot[]
}

type EditableLot = {
  key: string
  lotNumber: string
  expiryDate: string
  quantity: string
}

const emptyForm: FormData = {
  itemCode: '', description: '', vendor: '', category: '', prefVendor: '',
  binLocation: '', palletNumber: '',
  onHand: '0', reorderPt: '', order: '', onPO: '0', nextDeliv: '', salesPerWeek: '0',
  trackExpiry: false, lotTracking: [],
}

function createLotKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createEditableLot(
  lot?: Partial<{ lotNumber: string; expiryDate: string; quantity: number | string }>,
  fallbackQuantity = ''
): EditableLot {
  return {
    key: createLotKey(),
    lotNumber: lot?.lotNumber ?? '',
    expiryDate: lot?.expiryDate ?? '',
    quantity: lot?.quantity != null ? String(lot.quantity) : fallbackQuantity,
  }
}

function toFormData(item: InventoryItem): FormData {
  return {
    itemCode: item.itemCode,
    description: item.description,
    vendor: item.vendor,
    category: item.category ?? '',
    prefVendor: item.prefVendor ?? '',
    binLocation: item.binLocation ?? '',
    palletNumber: item.palletNumber ?? '',
    onHand: String(item.onHand),
    reorderPt: item.reorderPt != null ? String(item.reorderPt) : '',
    order: item.order != null ? String(item.order) : '',
    onPO: String(item.onPO),
    nextDeliv: item.nextDeliv ?? '',
    salesPerWeek: String(item.salesPerWeek),
    trackExpiry: (item.lotTracking?.length ?? 0) > 0,
    lotTracking: (item.lotTracking ?? []).map((lot) => createEditableLot(lot)),
  }
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {label}{required && <span className="text-destructive ml-0.5">*</span>}
    </Label>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <FieldLabel label={label} required={required} />
      {children}
    </div>
  )
}

export function ItemSheet({
  open,
  onOpenChange,
  item,
  vendors,
  categories,
  binLocations,
  palletNumbers,
  onSubmit,
}: ItemSheetProps): JSX.Element {
  const isEdit = item != null
  const [form, setForm] = useState<FormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [lotErrors, setLotErrors] = useState<Array<Partial<Record<'expiryDate' | 'quantity', string>>>>([])

  useEffect(() => {
    if (open) {
      setForm(item ? toFormData(item) : emptyForm)
      setSubmitError(null)
      setErrors({})
      setLotErrors([])
    }
  }, [open, item])

  function set(key: keyof FormData, value: string): void {
    setForm(prev => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  function updateLot(index: number, key: keyof Omit<EditableLot, 'key'>, value: string): void {
    setForm(prev => {
      const lotTracking = [...prev.lotTracking]
      lotTracking[index] = { ...lotTracking[index], [key]: value }
      return { ...prev, lotTracking }
    })
    if (errors.lotTracking) setErrors(prev => ({ ...prev, lotTracking: undefined }))
    if (lotErrors[index]?.[key as 'expiryDate' | 'quantity']) {
      setLotErrors(prev => {
        const next = [...prev]
        next[index] = { ...next[index], [key]: undefined }
        return next
      })
    }
  }

  function addLot(prefillQuantity = ''): void {
    setForm(prev => ({
      ...prev,
      trackExpiry: true,
      lotTracking: [...prev.lotTracking, createEditableLot(undefined, prefillQuantity)],
    }))
    if (errors.lotTracking) setErrors(prev => ({ ...prev, lotTracking: undefined }))
  }

  function removeLot(index: number): void {
    setForm(prev => ({
      ...prev,
      lotTracking: prev.lotTracking.filter((_, lotIndex) => lotIndex !== index),
    }))
    setLotErrors(prev => prev.filter((_, lotIndex) => lotIndex !== index))
  }

  function setTrackExpiry(checked: boolean): void {
    setForm(prev => ({
      ...prev,
      trackExpiry: checked,
      lotTracking:
        checked && prev.lotTracking.length === 0
          ? [createEditableLot(undefined, prev.onHand !== '0' ? prev.onHand : '')]
          : prev.lotTracking,
    }))
    if (!checked) {
      setErrors(prev => ({ ...prev, lotTracking: undefined }))
      setLotErrors([])
    }
  }

  const trackedQuantityPreview = useMemo(
    () => form.lotTracking.reduce((sum, lot) => sum + (Number(lot.quantity) || 0), 0),
    [form.lotTracking]
  )
  const onHandPreview = Number(form.onHand) || 0
  const coveragePercentPreview = form.trackExpiry && onHandPreview > 0
    ? Number(((trackedQuantityPreview / onHandPreview) * 100).toFixed(1))
    : null

  function validate(): boolean {
    const e: Partial<Record<keyof FormData, string>> = {}
    const nextLotErrors: Array<Partial<Record<'expiryDate' | 'quantity', string>>> = []
    if (!form.itemCode.trim()) e.itemCode = 'Required'
    if (!form.description.trim()) e.description = 'Required'
    if (!form.vendor.trim()) e.vendor = 'Required'
    if (form.onHand !== '' && isNaN(Number(form.onHand))) e.onHand = 'Must be a number'
    if (form.salesPerWeek !== '' && isNaN(Number(form.salesPerWeek))) e.salesPerWeek = 'Must be a number'
    if (form.trackExpiry) {
      const activeLots = form.lotTracking.filter(
        (lot) => lot.lotNumber.trim() || lot.expiryDate.trim() || lot.quantity.trim() !== ''
      )
      if (activeLots.length === 0) {
        e.lotTracking = 'Add at least one lot or turn off expiry tracking.'
      }

      form.lotTracking.forEach((lot, index) => {
        const hasContent = lot.lotNumber.trim() || lot.expiryDate.trim() || lot.quantity.trim() !== ''
        if (!hasContent) return

        const rowErrors: Partial<Record<'expiryDate' | 'quantity', string>> = {}
        if (!lot.expiryDate.trim()) rowErrors.expiryDate = 'Required'
        if (lot.quantity.trim() === '' || isNaN(Number(lot.quantity))) rowErrors.quantity = 'Must be a number'
        else if (Number(lot.quantity) < 0) rowErrors.quantity = 'Cannot be negative'

        nextLotErrors[index] = rowErrors
      })
    }
    setErrors(e)
    setLotErrors(nextLotErrors)
    return Object.keys(e).length === 0 && nextLotErrors.every(row => !row || Object.keys(row).length === 0)
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setSubmitError(null)
    try {
      const lotTracking = form.trackExpiry
        ? form.lotTracking
          .filter((lot) => lot.lotNumber.trim() || lot.expiryDate.trim() || lot.quantity.trim() !== '')
          .map((lot) => ({
            lotNumber: lot.lotNumber.trim(),
            expiryDate: lot.expiryDate.trim(),
            quantity: Number(lot.quantity) || 0,
          }))
        : []

      await onSubmit({
        itemCode: form.itemCode.trim(),
        description: form.description.trim(),
        vendor: form.vendor.trim(),
        category: form.category.trim(),
        prefVendor: form.prefVendor.trim(),
        binLocation: form.binLocation.trim() || null,
        palletNumber: form.palletNumber.trim() || null,
        onHand: Number(form.onHand) || 0,
        reorderPt: form.reorderPt.trim() !== '' ? Number(form.reorderPt) : null,
        order: form.order.trim() !== '' ? Number(form.order) : null,
        onPO: Number(form.onPO) || 0,
        nextDeliv: form.nextDeliv.trim(),
        salesPerWeek: Number(form.salesPerWeek) || 0,
        lotTracking,
        rowType: 'item',
      })
      onOpenChange(false)
    } catch (error) {
      setSubmitError(
        error instanceof Error && error.message.trim()
          ? error.message
          : (isEdit ? 'Unable to save item changes.' : 'Unable to add item.')
      )
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'h-8 text-xs bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder:text-gray-500'
  const monoInputCls = 'h-8 text-xs font-mono bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-md flex flex-col p-0 bg-white dark:bg-gray-900 dark:border-gray-800"
      >
        <SheetHeader className="shrink-0 px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-800">
          <SheetTitle className="dark:text-gray-100">
            {isEdit ? 'Edit Item' : 'Add New Item'}
          </SheetTitle>
          <SheetDescription className="dark:text-gray-400">
            {isEdit
              ? `Editing ${item!.itemCode} — ${item!.description}`
              : 'Fill in the details to add a new inventory item.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Identity */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Item Code" required>
                <Input
                  value={form.itemCode}
                  onChange={e => set('itemCode', e.target.value)}
                  placeholder="e.g. 1A 424/28"
                  className={cn(inputCls, errors.itemCode && 'border-destructive')}
                />
                {errors.itemCode && <p className="text-[10px] text-destructive">{errors.itemCode}</p>}
              </Field>
              <Field label="Vendor" required>
                <Input
                  value={form.vendor}
                  onChange={e => set('vendor', e.target.value)}
                  list="vendor-list"
                  placeholder="Vendor name"
                  className={cn(inputCls, errors.vendor && 'border-destructive')}
                />
                <datalist id="vendor-list">
                  {vendors.map(v => <option key={v} value={v} />)}
                </datalist>
                {errors.vendor && <p className="text-[10px] text-destructive">{errors.vendor}</p>}
              </Field>
            </div>

            <Field label="Description" required>
              <Input
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Full item description"
                className={cn(inputCls, errors.description && 'border-destructive')}
              />
              {errors.description && <p className="text-[10px] text-destructive">{errors.description}</p>}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <Input
                  value={form.category}
                  onChange={e => set('category', e.target.value)}
                  list="category-list"
                  placeholder="e.g. MiniSol"
                  className={inputCls}
                />
                <datalist id="category-list">
                  {categories.map(c => <option key={c} value={c} />)}
                </datalist>
              </Field>
              <Field label="Pref. Vendor">
                <Input
                  value={form.prefVendor}
                  onChange={e => set('prefVendor', e.target.value)}
                  list="vendor-list"
                  placeholder="Preferred vendor"
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Bin Location">
                <Input
                  value={form.binLocation}
                  onChange={e => set('binLocation', e.target.value)}
                  list="bin-location-list"
                  placeholder="e.g. A (1-4)"
                  className={inputCls}
                />
                <datalist id="bin-location-list">
                  {binLocations.map((binLocation) => <option key={binLocation} value={binLocation} />)}
                </datalist>
              </Field>
              <Field label="Pallet Number">
                <Input
                  value={form.palletNumber}
                  onChange={e => set('palletNumber', e.target.value)}
                  list="pallet-number-list"
                  placeholder="e.g. 3"
                  className={inputCls}
                />
                <datalist id="pallet-number-list">
                  {palletNumbers.map((palletNumber) => <option key={palletNumber} value={palletNumber} />)}
                </datalist>
              </Field>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Stock &amp; Sales</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="On Hand">
                  <Input
                    type="number"
                    value={form.onHand}
                    onChange={e => set('onHand', e.target.value)}
                    className={cn(monoInputCls, errors.onHand && 'border-destructive')}
                  />
                  {errors.onHand && <p className="text-[10px] text-destructive">{errors.onHand}</p>}
                </Field>
                <Field label="Reorder Point">
                  <Input
                    type="number"
                    value={form.reorderPt}
                    onChange={e => set('reorderPt', e.target.value)}
                    placeholder="Optional"
                    className={monoInputCls}
                  />
                </Field>
                <Field label="On PO">
                  <Input
                    type="number"
                    value={form.onPO}
                    onChange={e => set('onPO', e.target.value)}
                    className={monoInputCls}
                  />
                </Field>
                <Field label="Order Qty">
                  <Input
                    type="number"
                    value={form.order}
                    onChange={e => set('order', e.target.value)}
                    placeholder="Optional"
                    className={monoInputCls}
                  />
                </Field>
                <Field label="Sales / Week">
                  <Input
                    type="number"
                    step="0.1"
                    value={form.salesPerWeek}
                    onChange={e => set('salesPerWeek', e.target.value)}
                    className={cn(monoInputCls, errors.salesPerWeek && 'border-destructive')}
                  />
                  {errors.salesPerWeek && <p className="text-[10px] text-destructive">{errors.salesPerWeek}</p>}
                </Field>
                <Field label="Next Delivery">
                  <Input
                    value={form.nextDeliv}
                    onChange={e => set('nextDeliv', e.target.value)}
                    placeholder="e.g. 2025-04-01"
                    className={inputCls}
                  />
                </Field>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Expiry &amp; Lot Tracking</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Manage editable lot quantities and expiry dates for this product.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-charcoal-800 dark:text-gray-100">
                  <Checkbox
                    checked={form.trackExpiry}
                    onCheckedChange={(checked) => setTrackExpiry(checked === true)}
                  />
                  Track expiry
                </label>
              </div>

              {form.trackExpiry ? (
                <div className="space-y-3">
                  <div className="rounded-md border border-blue-100 bg-blue-50/70 px-3 py-2 dark:border-blue-900/60 dark:bg-blue-950/20">
                    <div className="flex flex-wrap items-center gap-3 text-[11px]">
                      <span className="font-semibold text-brand dark:text-blue-300">
                        {form.lotTracking.length} lot{form.lotTracking.length !== 1 ? 's' : ''}
                      </span>
                      <span className="text-muted-foreground">
                        Tracked qty: <span className="font-mono text-charcoal-800 dark:text-gray-100">{trackedQuantityPreview.toLocaleString()}</span>
                      </span>
                      <span className="text-muted-foreground">
                        On hand: <span className="font-mono text-charcoal-800 dark:text-gray-100">{onHandPreview.toLocaleString()}</span>
                      </span>
                      <span className="text-muted-foreground">
                        Coverage:{' '}
                        <span className="font-mono text-charcoal-800 dark:text-gray-100">
                          {coveragePercentPreview != null ? `${coveragePercentPreview}%` : 'N/A'}
                        </span>
                      </span>
                    </div>
                  </div>

                  {errors.lotTracking && <p className="text-[10px] text-destructive">{errors.lotTracking}</p>}

                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {form.lotTracking.map((lot, index) => (
                      <div
                        key={lot.key}
                        className="rounded-md border border-silver-200 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-gray-800/40"
                      >
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Lot {index + 1}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                            onClick={() => removeLot(index)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <div className="grid gap-3">
                          <Field label="Lot Number">
                            <Input
                              value={lot.lotNumber}
                              onChange={e => updateLot(index, 'lotNumber', e.target.value)}
                              placeholder="Optional"
                              className={monoInputCls}
                            />
                          </Field>

                          <div className="grid grid-cols-2 gap-3">
                            <Field label="Expiry Date" required>
                              <Input
                                type="date"
                                value={lot.expiryDate}
                                onChange={e => updateLot(index, 'expiryDate', e.target.value)}
                                className={cn(inputCls, lotErrors[index]?.expiryDate && 'border-destructive')}
                              />
                              {lotErrors[index]?.expiryDate && <p className="text-[10px] text-destructive">{lotErrors[index].expiryDate}</p>}
                            </Field>

                            <Field label="Quantity" required>
                              <Input
                                type="number"
                                min="0"
                                value={lot.quantity}
                                onChange={e => updateLot(index, 'quantity', e.target.value)}
                                className={cn(monoInputCls, lotErrors[index]?.quantity && 'border-destructive')}
                              />
                              {lotErrors[index]?.quantity && <p className="text-[10px] text-destructive">{lotErrors[index].quantity}</p>}
                            </Field>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => addLot(form.onHand !== '0' ? form.onHand : '')}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add lot
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Expiry tracking is off for this item. Turn it on to manage lot-specific expiry dates.
                </p>
              )}
            </div>
          </div>

          <SheetFooter className="shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-800 dark:bg-gray-900">
            {submitError && (
              <p role="alert" className="w-full text-xs text-destructive mb-1">
                {submitError}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Item'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
