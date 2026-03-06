import { useEffect, useState } from 'react'
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
import { cn } from '../../lib/utils'

interface ItemSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: InventoryItem | null
  vendors: string[]
  categories: string[]
  onSubmit: (data: Omit<InventoryItem, 'id'>) => Promise<void>
}

type FormData = {
  itemCode: string
  description: string
  vendor: string
  category: string
  prefVendor: string
  onHand: string
  reorderPt: string
  order: string
  onPO: string
  nextDeliv: string
  salesPerWeek: string
}

const emptyForm: FormData = {
  itemCode: '', description: '', vendor: '', category: '', prefVendor: '',
  onHand: '0', reorderPt: '', order: '', onPO: '0', nextDeliv: '', salesPerWeek: '0',
}

function toFormData(item: InventoryItem): FormData {
  return {
    itemCode: item.itemCode,
    description: item.description,
    vendor: item.vendor,
    category: item.category ?? '',
    prefVendor: item.prefVendor ?? '',
    onHand: String(item.onHand),
    reorderPt: item.reorderPt != null ? String(item.reorderPt) : '',
    order: item.order != null ? String(item.order) : '',
    onPO: String(item.onPO),
    nextDeliv: item.nextDeliv ?? '',
    salesPerWeek: String(item.salesPerWeek),
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

export function ItemSheet({ open, onOpenChange, item, vendors, categories, onSubmit }: ItemSheetProps): JSX.Element {
  const isEdit = item != null
  const [form, setForm] = useState<FormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  useEffect(() => {
    if (open) {
      setForm(item ? toFormData(item) : emptyForm)
      setErrors({})
    }
  }, [open, item])

  function set(key: keyof FormData, value: string): void {
    setForm(prev => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const e: Partial<Record<keyof FormData, string>> = {}
    if (!form.itemCode.trim()) e.itemCode = 'Required'
    if (!form.description.trim()) e.description = 'Required'
    if (!form.vendor.trim()) e.vendor = 'Required'
    if (form.onHand !== '' && isNaN(Number(form.onHand))) e.onHand = 'Must be a number'
    if (form.salesPerWeek !== '' && isNaN(Number(form.salesPerWeek))) e.salesPerWeek = 'Must be a number'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      await onSubmit({
        itemCode: form.itemCode.trim(),
        description: form.description.trim(),
        vendor: form.vendor.trim(),
        category: form.category.trim(),
        prefVendor: form.prefVendor.trim(),
        onHand: Number(form.onHand) || 0,
        reorderPt: form.reorderPt.trim() !== '' ? Number(form.reorderPt) : null,
        order: form.order.trim() !== '' ? Number(form.order) : null,
        onPO: Number(form.onPO) || 0,
        nextDeliv: form.nextDeliv.trim(),
        salesPerWeek: Number(form.salesPerWeek) || 0,
        rowType: 'item',
      })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md flex flex-col p-0">
        <SheetHeader className="shrink-0">
          <SheetTitle>{isEdit ? 'Edit Item' : 'Add New Item'}</SheetTitle>
          <SheetDescription>
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
                  className={cn('h-8 text-xs', errors.itemCode && 'border-destructive')}
                />
                {errors.itemCode && <p className="text-[10px] text-destructive">{errors.itemCode}</p>}
              </Field>
              <Field label="Vendor" required>
                <Input
                  value={form.vendor}
                  onChange={e => set('vendor', e.target.value)}
                  list="vendor-list"
                  placeholder="Vendor name"
                  className={cn('h-8 text-xs', errors.vendor && 'border-destructive')}
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
                className={cn('h-8 text-xs', errors.description && 'border-destructive')}
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
                  className="h-8 text-xs"
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
                  className="h-8 text-xs"
                />
              </Field>
            </div>

            <div className="border-t pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Stock & Sales</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="On Hand">
                  <Input
                    type="number"
                    value={form.onHand}
                    onChange={e => set('onHand', e.target.value)}
                    className={cn('h-8 text-xs font-mono', errors.onHand && 'border-destructive')}
                  />
                  {errors.onHand && <p className="text-[10px] text-destructive">{errors.onHand}</p>}
                </Field>
                <Field label="Reorder Point">
                  <Input
                    type="number"
                    value={form.reorderPt}
                    onChange={e => set('reorderPt', e.target.value)}
                    placeholder="Optional"
                    className="h-8 text-xs font-mono"
                  />
                </Field>
                <Field label="On PO">
                  <Input
                    type="number"
                    value={form.onPO}
                    onChange={e => set('onPO', e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </Field>
                <Field label="Order Qty">
                  <Input
                    type="number"
                    value={form.order}
                    onChange={e => set('order', e.target.value)}
                    placeholder="Optional"
                    className="h-8 text-xs font-mono"
                  />
                </Field>
                <Field label="Sales / Week">
                  <Input
                    type="number"
                    step="0.1"
                    value={form.salesPerWeek}
                    onChange={e => set('salesPerWeek', e.target.value)}
                    className={cn('h-8 text-xs font-mono', errors.salesPerWeek && 'border-destructive')}
                  />
                  {errors.salesPerWeek && <p className="text-[10px] text-destructive">{errors.salesPerWeek}</p>}
                </Field>
                <Field label="Next Delivery">
                  <Input
                    value={form.nextDeliv}
                    onChange={e => set('nextDeliv', e.target.value)}
                    placeholder="e.g. 2025-04-01"
                    className="h-8 text-xs"
                  />
                </Field>
              </div>
            </div>
          </div>

          <SheetFooter className="shrink-0">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
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
