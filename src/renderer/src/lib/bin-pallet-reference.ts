import binPalletCsvRaw from '../../../../bin-location and pallet.csv?raw'
import type { InventoryItem } from '../types/inventory'

interface ReferenceRow {
  itemCode: string
  description: string
  binLocation: string
  palletNumber: string
}

interface BinPalletReference {
  itemCode: string
  description: string
  normalizedItemCode: string
  normalizedDescription: string
  binLocations: string[]
  palletNumbers: string[]
}

type MatchStrategy = 'item-code' | 'description' | 'fuzzy'

export interface BinPalletMatch {
  binLocation: string | null
  palletNumber: string | null
  strategy: MatchStrategy
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase()
}

export function normalizeItemCode(value: string): string {
  const cleaned = normalizeText(value).replace(/[^a-z0-9]/g, '')
  if (/^\d+$/.test(cleaned)) return cleaned.replace(/^0+/, '') || '0'
  return cleaned
}

export function normalizeDescription(value: string): string {
  return normalizeText(value)
    .replace(/\(closed system\)/g, ' closed system ')
    .replace(/closed system/g, ' closed system ')
    .replace(/sol'n/g, 'solution')
    .replace(/soln/g, 'solution')
    .replace(/wwater/g, 'water')
    .replace(/ml\(/g, 'ml (')
    .replace(/[^a-z0-9]+/g, '')
}

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      values.push(current)
      current = ''
      continue
    }

    current += char
  }

  values.push(current)
  return values
}

function parseReferenceRows(csvRaw: string): ReferenceRow[] {
  const rows: ReferenceRow[] = []
  const lines = csvRaw.split(/\r?\n/)
  let currentBinLocation = ''
  let currentPallet = ''

  for (const line of lines) {
    if (!line.trim()) continue

    const columns = parseCsvLine(line)
    if (columns.every((value) => value.trim() === '')) continue

    const binLocationRaw = (columns[0] ?? '').trim()
    const palletRaw = (columns[1] ?? '').trim()
    const itemCode = (columns[2] ?? '').trim()
    const description = (columns[3] ?? '').trim()

    if (binLocationRaw && normalizeText(binLocationRaw) !== 'bin location') {
      currentBinLocation = binLocationRaw
      currentPallet = ''
    }

    if (palletRaw) currentPallet = palletRaw

    if (!itemCode && !description) continue
    if (normalizeText(description) === '#n/a') continue

    if (!currentBinLocation && !currentPallet) continue

    rows.push({
      itemCode,
      description,
      binLocation: currentBinLocation,
      palletNumber: currentPallet,
    })
  }

  return rows
}

function sortNaturally(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
}

function joinUnique(values: string[]): string | null {
  const unique = sortNaturally([...new Set(values.map((value) => value.trim()).filter(Boolean))])
  return unique.length > 0 ? unique.join(', ') : null
}

function buildReference(rows: ReferenceRow[]): BinPalletReference[] {
  const grouped = new Map<string, {
    itemCode: string
    description: string
    normalizedItemCode: string
    normalizedDescription: string
    binLocations: Set<string>
    palletNumbers: Set<string>
  }>()

  for (const row of rows) {
    const normalizedItemCode = normalizeItemCode(row.itemCode)
    const normalizedDescription = normalizeDescription(row.description)
    if (!normalizedItemCode && !normalizedDescription) continue

    const key = `${normalizedItemCode}|${normalizedDescription}`
    const current = grouped.get(key) ?? {
      itemCode: row.itemCode,
      description: row.description,
      normalizedItemCode,
      normalizedDescription,
      binLocations: new Set<string>(),
      palletNumbers: new Set<string>(),
    }

    if (row.binLocation.trim()) current.binLocations.add(row.binLocation.trim())
    if (row.palletNumber.trim()) current.palletNumbers.add(row.palletNumber.trim())

    grouped.set(key, current)
  }

  return [...grouped.values()].map((entry) => ({
    itemCode: entry.itemCode,
    description: entry.description,
    normalizedItemCode: entry.normalizedItemCode,
    normalizedDescription: entry.normalizedDescription,
    binLocations: sortNaturally([...entry.binLocations]),
    palletNumbers: sortNaturally([...entry.palletNumbers]),
  }))
}

function diceCoefficient(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0

  const bigrams = new Map<string, number>()
  for (let i = 0; i < a.length - 1; i += 1) {
    const bigram = a.slice(i, i + 2)
    bigrams.set(bigram, (bigrams.get(bigram) ?? 0) + 1)
  }

  let intersection = 0
  for (let i = 0; i < b.length - 1; i += 1) {
    const bigram = b.slice(i, i + 2)
    const count = bigrams.get(bigram) ?? 0
    if (count > 0) {
      bigrams.set(bigram, count - 1)
      intersection += 1
    }
  }

  return (2 * intersection) / (a.length + b.length - 2)
}

const references = buildReference(parseReferenceRows(binPalletCsvRaw))
const byItemCode = new Map<string, BinPalletReference[]>()
const byDescription = new Map<string, BinPalletReference[]>()

for (const reference of references) {
  if (reference.normalizedItemCode) {
    byItemCode.set(reference.normalizedItemCode, [...(byItemCode.get(reference.normalizedItemCode) ?? []), reference])
  }
  if (reference.normalizedDescription) {
    byDescription.set(reference.normalizedDescription, [...(byDescription.get(reference.normalizedDescription) ?? []), reference])
  }
}

const lookupCache = new Map<string, BinPalletMatch | null>()

function chooseByDescription(candidates: BinPalletReference[], normalizedDescription: string): BinPalletReference {
  if (candidates.length === 1 || !normalizedDescription) return candidates[0]

  let best = candidates[0]
  let bestScore = diceCoefficient(normalizedDescription, best.normalizedDescription)

  for (let i = 1; i < candidates.length; i += 1) {
    const candidate = candidates[i]
    const score = diceCoefficient(normalizedDescription, candidate.normalizedDescription)
    if (score > bestScore) {
      best = candidate
      bestScore = score
    }
  }

  return best
}

function findFuzzyReference(
  normalizedItemCode: string,
  normalizedDescription: string
): BinPalletReference | null {
  if (!normalizedDescription) return null

  let best: BinPalletReference | null = null
  let bestScore = 0
  let secondBestScore = 0

  for (const reference of references) {
    const descriptionScore = diceCoefficient(normalizedDescription, reference.normalizedDescription)
    const codeScore = normalizedItemCode
      ? reference.normalizedItemCode === normalizedItemCode
        ? 1
        : reference.normalizedItemCode &&
            (reference.normalizedItemCode.includes(normalizedItemCode) || normalizedItemCode.includes(reference.normalizedItemCode))
          ? 0.6
          : 0
      : 0

    const score = descriptionScore * 0.85 + codeScore * 0.15
    if (score > bestScore) {
      secondBestScore = bestScore
      bestScore = score
      best = reference
    } else if (score > secondBestScore) {
      secondBestScore = score
    }
  }

  if (!best) return null

  const scoreGap = bestScore - secondBestScore
  if (bestScore < 0.88 || scoreGap < 0.04) return null

  return best
}

function asMatch(reference: BinPalletReference, strategy: MatchStrategy): BinPalletMatch | null {
  const binLocation = joinUnique(reference.binLocations)
  const palletNumber = joinUnique(reference.palletNumbers)
  if (!binLocation && !palletNumber) return null

  return {
    binLocation,
    palletNumber,
    strategy,
  }
}

export function findBinPalletMatch(item: Pick<InventoryItem, 'itemCode' | 'description'>): BinPalletMatch | null {
  const normalizedItemCode = normalizeItemCode(item.itemCode)
  const normalizedDescription = normalizeDescription(item.description)
  const cacheKey = `${normalizedItemCode}|${normalizedDescription}`

  if (lookupCache.has(cacheKey)) {
    return lookupCache.get(cacheKey) ?? null
  }

  const codeCandidates = normalizedItemCode ? byItemCode.get(normalizedItemCode) ?? [] : []
  if (codeCandidates.length > 0) {
    const match = asMatch(chooseByDescription(codeCandidates, normalizedDescription), 'item-code')
    lookupCache.set(cacheKey, match)
    return match
  }

  const descriptionCandidates = normalizedDescription
    ? byDescription.get(normalizedDescription) ?? []
    : []

  if (descriptionCandidates.length > 0) {
    const match = asMatch(chooseByDescription(descriptionCandidates, normalizedDescription), 'description')
    lookupCache.set(cacheKey, match)
    return match
  }

  const fuzzyReference = findFuzzyReference(normalizedItemCode, normalizedDescription)
  const fuzzyMatch = fuzzyReference ? asMatch(fuzzyReference, 'fuzzy') : null
  lookupCache.set(cacheKey, fuzzyMatch)
  return fuzzyMatch
}

function sanitizeValue(value?: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function withBinPalletReference(item: InventoryItem): InventoryItem {
  const currentBinLocation = sanitizeValue(item.binLocation)
  const currentPalletNumber = sanitizeValue(item.palletNumber)

  if (currentBinLocation && currentPalletNumber) {
    return {
      ...item,
      binLocation: currentBinLocation,
      palletNumber: currentPalletNumber,
    }
  }

  const matched = findBinPalletMatch(item)
  if (!matched) {
    return {
      ...item,
      binLocation: currentBinLocation,
      palletNumber: currentPalletNumber,
    }
  }

  return {
    ...item,
    binLocation: currentBinLocation ?? matched.binLocation,
    palletNumber: currentPalletNumber ?? matched.palletNumber,
  }
}

export function splitMultiValue(value?: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}
