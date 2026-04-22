import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp as initializeAdminApp,
} from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}

  const entries = {}
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const eq = line.indexOf('=')
    if (eq === -1) continue

    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    entries[key] = value
  }

  return entries
}

function parseCsvLine(line) {
  const values = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (character === ',' && !inQuotes) {
      values.push(current)
      current = ''
      continue
    }

    current += character
  }

  values.push(current)
  return values
}

function normalizeItemCode(value) {
  const cleaned = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

  if (/^\d+$/.test(cleaned)) return cleaned.replace(/^0+/, '') || '0'
  return cleaned
}

function normalizeDescription(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\(closed system\)/g, ' closed system ')
    .replace(/closed system/g, ' closed system ')
    .replace(/sol'n/g, 'solution')
    .replace(/soln/g, 'solution')
    .replace(/wwater/g, 'water')
    .replace(/ml\(/g, 'ml (')
    .replace(/[^a-z0-9]+/g, '')
}

function sortNaturally(values) {
  return [...values].sort((left, right) =>
    left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
  )
}

function joinUnique(values) {
  const unique = sortNaturally(
    [...new Set(values.map((value) => String(value).trim()).filter(Boolean))]
  )

  return unique.length > 0 ? unique.join(', ') : null
}

function diceCoefficient(left, right) {
  if (!left || !right) return 0
  if (left === right) return 1
  if (left.length < 2 || right.length < 2) return 0

  const bigrams = new Map()
  for (let index = 0; index < left.length - 1; index += 1) {
    const bigram = left.slice(index, index + 2)
    bigrams.set(bigram, (bigrams.get(bigram) ?? 0) + 1)
  }

  let intersection = 0
  for (let index = 0; index < right.length - 1; index += 1) {
    const bigram = right.slice(index, index + 2)
    const count = bigrams.get(bigram) ?? 0
    if (count > 0) {
      bigrams.set(bigram, count - 1)
      intersection += 1
    }
  }

  return (2 * intersection) / (left.length + right.length - 2)
}

function parseReferenceRows(csvRaw) {
  const rows = []
  let currentBinLocation = ''
  let currentPalletNumber = ''

  for (const line of csvRaw.split(/\r?\n/)) {
    if (!line.trim()) continue

    const columns = parseCsvLine(line)
    if (columns.every((value) => value.trim() === '')) continue

    const binLocationRaw = (columns[0] ?? '').trim()
    const palletRaw = (columns[1] ?? '').trim()
    const itemCode = (columns[2] ?? '').trim()
    const description = (columns[3] ?? '').trim()

    if (binLocationRaw && binLocationRaw.toLowerCase() !== 'bin location') {
      currentBinLocation = binLocationRaw
      currentPalletNumber = ''
    }

    if (palletRaw) currentPalletNumber = palletRaw

    if (!itemCode && !description) continue
    if (description.toLowerCase() === '#n/a') continue
    if (!currentBinLocation && !currentPalletNumber) continue

    rows.push({
      itemCode,
      description,
      binLocation: currentBinLocation,
      palletNumber: currentPalletNumber,
    })
  }

  return rows
}

function buildReferenceIndex(rows) {
  const grouped = new Map()

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
      binLocations: new Set(),
      palletNumbers: new Set(),
    }

    if (row.binLocation.trim()) current.binLocations.add(row.binLocation.trim())
    if (row.palletNumber.trim()) current.palletNumbers.add(row.palletNumber.trim())

    grouped.set(key, current)
  }

  const references = [...grouped.values()].map((entry) => ({
    itemCode: entry.itemCode,
    description: entry.description,
    normalizedItemCode: entry.normalizedItemCode,
    normalizedDescription: entry.normalizedDescription,
    binLocation: joinUnique([...entry.binLocations]),
    palletNumber: joinUnique([...entry.palletNumbers]),
  }))

  const byItemCode = new Map()
  const byDescription = new Map()

  for (const reference of references) {
    if (reference.normalizedItemCode) {
      byItemCode.set(reference.normalizedItemCode, [
        ...(byItemCode.get(reference.normalizedItemCode) ?? []),
        reference,
      ])
    }

    if (reference.normalizedDescription) {
      byDescription.set(reference.normalizedDescription, [
        ...(byDescription.get(reference.normalizedDescription) ?? []),
        reference,
      ])
    }
  }

  return { references, byItemCode, byDescription }
}

function chooseByDescription(candidates, normalizedDescription) {
  if (candidates.length === 1 || !normalizedDescription) return candidates[0]

  let best = candidates[0]
  let bestScore = diceCoefficient(normalizedDescription, best.normalizedDescription)

  for (let index = 1; index < candidates.length; index += 1) {
    const candidate = candidates[index]
    const score = diceCoefficient(normalizedDescription, candidate.normalizedDescription)
    if (score > bestScore) {
      best = candidate
      bestScore = score
    }
  }

  return best
}

function findFuzzyReference(normalizedItemCode, normalizedDescription, references) {
  if (!normalizedDescription) return null

  let best = null
  let bestScore = 0
  let secondBestScore = 0

  for (const reference of references) {
    const descriptionScore = diceCoefficient(normalizedDescription, reference.normalizedDescription)
    const codeScore = normalizedItemCode
      ? reference.normalizedItemCode === normalizedItemCode
        ? 1
        : reference.normalizedItemCode &&
            (reference.normalizedItemCode.includes(normalizedItemCode) ||
              normalizedItemCode.includes(reference.normalizedItemCode))
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
  if (bestScore < 0.88 || bestScore - secondBestScore < 0.04) return null

  return best
}

function findBestReference(item, index) {
  const normalizedItemCode = normalizeItemCode(item.itemCode)
  const normalizedDescription = normalizeDescription(item.description)

  const codeCandidates = normalizedItemCode
    ? index.byItemCode.get(normalizedItemCode) ?? []
    : []

  if (codeCandidates.length > 0) {
    return chooseByDescription(codeCandidates, normalizedDescription)
  }

  const descriptionCandidates = normalizedDescription
    ? index.byDescription.get(normalizedDescription) ?? []
    : []

  if (descriptionCandidates.length > 0) {
    return chooseByDescription(descriptionCandidates, normalizedDescription)
  }

  return findFuzzyReference(normalizedItemCode, normalizedDescription, index.references)
}

function cleanStoredValue(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function loadServiceAccount(env) {
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON)
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.')
    }
  }

  const credentialPath = env.FIREBASE_SERVICE_ACCOUNT_PATH ?? env.GOOGLE_APPLICATION_CREDENTIALS
  if (!credentialPath) return null

  const resolvedPath = path.isAbsolute(credentialPath)
    ? credentialPath
    : path.resolve(process.cwd(), credentialPath)

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Service account file not found: ${resolvedPath}`)
  }

  try {
    return JSON.parse(fs.readFileSync(resolvedPath, 'utf8'))
  } catch {
    throw new Error(`Service account file is not valid JSON: ${resolvedPath}`)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const csvArg = args.find((arg) => !arg.startsWith('--'))

  const env = {
    ...loadEnvFile(path.join(repoRoot, '.env')),
    ...loadEnvFile(path.join(repoRoot, '.env.local')),
    ...process.env,
  }

  const serviceAccount = loadServiceAccount(env)
  const projectId =
    env.FIREBASE_PROJECT_ID ?? env.VITE_FIREBASE_PROJECT_ID ?? serviceAccount?.project_id ?? null

  if (!serviceAccount && !env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error(
      'Missing admin credentials. Set FIREBASE_SERVICE_ACCOUNT_PATH, FIREBASE_SERVICE_ACCOUNT_JSON, or GOOGLE_APPLICATION_CREDENTIALS.'
    )
  }

  const csvPath = csvArg
    ? path.resolve(process.cwd(), csvArg)
    : path.join(repoRoot, 'bin-location and pallet.csv')

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`)
  }

  const csvRaw = fs.readFileSync(csvPath, 'utf8')
  const index = buildReferenceIndex(parseReferenceRows(csvRaw))

  if (index.references.length === 0) {
    throw new Error('No usable rows were parsed from the CSV file.')
  }

  const app =
    getApps()[0] ??
    initializeAdminApp({
      credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
      ...(projectId ? { projectId } : {}),
    })

  const db = getFirestore(app)
  const inventorySnapshot = await db.collection('inventory').get()

  let scanned = 0
  let matched = 0
  const updates = []

  for (const itemDoc of inventorySnapshot.docs) {
    const data = itemDoc.data()
    if ((data.rowType ?? 'item') !== 'item') continue

    scanned += 1

    const reference = findBestReference(
      {
        itemCode: String(data.itemCode ?? ''),
        description: String(data.description ?? ''),
      },
      index
    )

    if (!reference) continue
    matched += 1

    const nextBinLocation = reference.binLocation ?? null
    const nextPalletNumber = reference.palletNumber ?? null
    const currentBinLocation = cleanStoredValue(data.binLocation)
    const currentPalletNumber = cleanStoredValue(data.palletNumber)

    if (
      currentBinLocation === nextBinLocation &&
      currentPalletNumber === nextPalletNumber
    ) {
      continue
    }

    updates.push({
      id: itemDoc.id,
      binLocation: nextBinLocation,
      palletNumber: nextPalletNumber,
    })
  }

  if (!dryRun) {
    const chunkSize = 400
    for (let indexStart = 0; indexStart < updates.length; indexStart += chunkSize) {
      const batch = db.batch()
      const chunk = updates.slice(indexStart, indexStart + chunkSize)

      for (const update of chunk) {
        batch.update(db.collection('inventory').doc(update.id), {
          binLocation: update.binLocation,
          palletNumber: update.palletNumber,
        })
      }

      await batch.commit()
    }
  }

  if (dryRun) {
    console.log('Dry run mode: no Firestore documents were updated.')
  }
  console.log(`Scanned inventory items: ${scanned}`)
  console.log(`Matched inventory items: ${matched}`)
  console.log(`${dryRun ? 'Would update' : 'Updated'} inventory items: ${updates.length}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
