import { GST_TAX_RATES } from "@/types/bills"

export type ParsedInvoiceItem = {
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
}

export type ParsedInvoice = {
  vendorName: string
  vendorEmail: string
  vendorPhone: string
  vendorTaxId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  customerTaxId: string
  billNumber: string
  invoiceDate: string | null
  invoiceDateVerified: boolean
  dueDate: string | null
  currency: string
  subtotal: number | null
  totalGst: number | null
  grandTotal: number | null
  confidence: number
  requiresReview: boolean
  reviewReason: string
  items: ParsedInvoiceItem[]
}

type KnownVendor = {
  name: string
}

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
}

function nearestGst(rate: number) {
  return GST_TAX_RATES.reduce((best, candidate) =>
    Math.abs(candidate - rate) < Math.abs(best - rate) ? candidate : best
  )
}

export function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(
      /\b(pvt|pvt ltd|private|limited|ltd|llp|inc|llc|co|company)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim()
}

function toIsoDate(year: number, month: number, day: number) {
  if (year < 100) year += year >= 70 ? 1900 : 2000
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return date.toISOString().slice(0, 10)
}

export function parseInvoiceDate(raw: string) {
  return parseLooseDate(raw)
}

function parseLooseDate(raw: string) {
  const value = raw.trim()
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) {
    return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  }

  const numeric = value.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/)
  if (numeric) {
    const first = Number(numeric[1])
    const second = Number(numeric[2])
    const year = Number(numeric[3])
    if (first > 12) return toIsoDate(year, second, first)
    if (second > 12) return toIsoDate(year, first, second)
    return toIsoDate(year, second, first)
  }

  const named = value.match(
    /^(\d{1,2})[\s.\-]([A-Za-z]{3,9})[\s.\-,]+(\d{2,4})$/
  )
  if (named) {
    const month = MONTHS[named[2].toLowerCase()]
    if (!month) return null
    return toIsoDate(Number(named[3]), month, Number(named[1]))
  }

  return null
}

function parseMoney(raw: string) {
  const cleaned = raw.replace(/[^0-9.]/g, "")
  if (!cleaned) return null
  const amount = Number(cleaned)
  return Number.isFinite(amount) ? amount : null
}

function labeledValue(text: string, labels: RegExp) {
  const match = text.match(labels)
  return match?.[1]?.trim() ?? ""
}

function firstEmail(text: string) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? ""
}

function firstPhone(text: string) {
  const match = text.match(/(?:\+?91[\s-]?)?[6-9]\d{9}/)
  return match?.[0]?.replace(/\s+/g, "") ?? ""
}

function firstGstin(text: string) {
  return (
    text.match(
      /\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/i
    )?.[0] ?? ""
  ).toUpperCase()
}

const BUYER_LABEL =
  /consignee|bill\s*to|billed\s*to|buyer\s*\(|buyer \(bill|details of (?:receiver|buyer|recipient)|customer\s*name|ship\s*to|place\s*of\s*supply/i

function sellerSection(text: string) {
  return text.split(BUYER_LABEL)[0]
}

function buyerSection(text: string) {
  const match = text.match(BUYER_LABEL)
  if (!match || match.index == null) return ""
  const rest = text.slice(match.index + match[0].length)
  const end = rest.search(
    /\n\s*(?:invoice\s*(?:no|num(?:ber)?|#)|description of (?:goods|services)|particulars|hsn\/?sac|s\.?\s*no\b|sl\.?\s*no|amount chargeable|taxable value)/i
  )
  return (end >= 0 ? rest.slice(0, end) : rest.slice(0, 600)).trim()
}

function findKnownParty(text: string, parties: KnownVendor[]) {
  const normalized = normalizeName(text)
  return parties
    .filter((party) => {
      const current = normalizeName(party.name)
      return current.length >= 3 && normalized.includes(current)
    })
    .sort(
      (a, b) => normalizeName(b.name).length - normalizeName(a.name).length
    )[0]?.name ?? ""
}

function isDifferentParty(name: string, other: string) {
  const left = normalizeName(name)
  const right = normalizeName(other)
  if (left.length < 3) return false
  if (!right) return true
  return left !== right && !left.includes(right) && !right.includes(left)
}

function isBoilerplateLine(line: string) {
  return /^(tax\s*invoice|invoice|original|duplicate|e-?invoice|irn|ack(?:nowledgement)?\s*no|computer generated)/i.test(
    line
  )
}

function isAddressLike(line: string) {
  return /shop\.?\s*no|gstin|uin:|state name|e-?mail|phone|mobile|address|pin\s*code|floor|building|plot no|road|hyderabad|secunderabad|telangana/i.test(
    line
  )
}

function companyLike(line: string) {
  return /\b(pvt\.?\s*ltd\.?|private\s+limited|limited|ltd\.?|llp|inc\.?|llc|enterprises|traders|supplies|solutions|industries|centre|center)\b/i.test(
    line
  )
}

function findVendorName(text: string, knownVendors: KnownVendor[]) {
  const seller = sellerSection(text)
  const normalizedSeller = normalizeName(seller)
  const known = knownVendors.find((vendor) => {
    const current = normalizeName(vendor.name)
    return current.length >= 3 && normalizedSeller.includes(current)
  })
  if (known) return known.name

  const labeled = labeledValue(
    seller,
    /(?:supplier|seller|vendor|from|billed\s*by|tax\s*invoice\s*from|(?:^|\n)\s*for)[:\s]+([^\n]{3,80})/i
  )
  if (
    labeled &&
    !/tax\s*invoice|original|duplicate/i.test(labeled) &&
    !isAddressLike(labeled)
  ) {
    return labeled.replace(/\s+/g, " ").trim()
  }

  const lines = seller
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)

  const company = lines.find(
    (line) =>
      companyLike(line) &&
      !isBoilerplateLine(line) &&
      !isAddressLike(line) &&
      !/invoice\s*no/i.test(line)
  )
  if (company) return company

  return (
    lines.find(
      (line) =>
        line.length >= 4 &&
        line.length <= 80 &&
        !isBoilerplateLine(line) &&
        !isAddressLike(line) &&
        !/invoice|date|phone|email|address|gstin/i.test(line)
    ) ?? ""
  )
}

function partyNameFromSection(section: string) {
  const labeled = labeledValue(
    section,
    /(?:customer|client|buyer|consignee|bill\s*to|billed\s*to)[:\s]+([^\n]{3,80})/i
  )
  if (
    labeled &&
    !/tax\s*invoice|original|duplicate/i.test(labeled) &&
    !isAddressLike(labeled)
  ) {
    return labeled.replace(/\s+/g, " ").trim()
  }

  const lines = section
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)

  const company = lines.find(
    (line) =>
      companyLike(line) &&
      !isBoilerplateLine(line) &&
      !isAddressLike(line) &&
      !/invoice\s*no/i.test(line)
  )
  if (company) return company

  return (
    lines.find(
      (line) =>
        line.length >= 4 &&
        line.length <= 80 &&
        !isBoilerplateLine(line) &&
        !isAddressLike(line) &&
        !/invoice|date|phone|email|address|gstin/i.test(line)
    ) ?? ""
  )
}

function findCustomerName(
  text: string,
  knownCustomers: KnownVendor[],
  sellerName: string
) {
  const buyer = buyerSection(text)
  if (buyer) {
    const known = findKnownParty(buyer, knownCustomers)
    if (known && isDifferentParty(known, sellerName)) return known

    const named = partyNameFromSection(buyer)
    if (named && isDifferentParty(named, sellerName)) return named
  }

  const knownAnywhere = findKnownParty(text, knownCustomers)
  if (knownAnywhere && isDifferentParty(knownAnywhere, sellerName)) {
    return knownAnywhere
  }
  return ""
}

function detectCurrency(text: string) {
  const totalLine =
    text.match(
      /(?:grand\s*total|invoice\s*total|amount\s*payable|(?<![a-z])total(?!\s*in\s*words))[^\n]{0,48}/i
    )?.[0] ?? ""

  const scored = [
    { code: "USD", pattern: /\$|usd|united states dollar/i },
    { code: "EUR", pattern: /€|eur\b|euro/i },
    { code: "GBP", pattern: /£|gbp\b|pound sterling/i },
    { code: "AED", pattern: /\baed\b|dirham/i },
    { code: "INR", pattern: /₹|\binr\b|\brs\.?\b|rupee/i },
  ] as const

  for (const candidate of scored) {
    if (candidate.pattern.test(totalLine)) return candidate.code
  }
  for (const candidate of scored) {
    if (candidate.pattern.test(text)) return candidate.code
  }
  return "INR"
}

function looksLikeBillNumber(value: string) {
  const cleaned = value.replace(/[^\w/.-]/g, "")
  if (!cleaned || cleaned.length > 32) return false
  if (!/\d/.test(cleaned)) return false
  if (/^(invoice|tax|gstin|dated|date|hsn|sac|total)$/i.test(cleaned)) {
    return false
  }
  return true
}

function findBillNumber(text: string, fileName?: string) {
  const labeled = text.match(
    /(?:invoice|bill|tax\s*invoice|inv)\s*(?:no|num(?:ber)?|#)\.?\s*[:.]?\s*([A-Z0-9][A-Z0-9/._-]{1,})/i
  )?.[1]
  if (labeled && looksLikeBillNumber(labeled)) return labeled

  const stem = fileName?.replace(/\.[^.]+$/, "") ?? ""
  if (looksLikeBillNumber(stem) && /^[A-Z0-9][A-Z0-9._-]{2,}$/i.test(stem)) {
    return stem
  }
  return ""
}

function findLabeledDate(text: string, labels: RegExp) {
  const match = text.match(labels)
  return match?.[1] ? parseLooseDate(match[1]) : null
}

function documentGst(text: string) {
  const percent =
    text.match(/igst\s*0?\s*\(?\s*(\d{1,2})\s*%/i) ??
    text.match(/\b(?:cgst|sgst|utgst)\s*0?\s*\(?\s*(\d{1,2})\s*%/i) ??
    text.match(/(?<![a-z])gst(?!in)\s*0?\s*\(?\s*(\d{1,2})\s*%/i)

  if (percent) return nearestGst(Number(percent[1]))

  const cgst = Number(text.match(/\bcgst\b[^%\n]{0,12}(\d{1,2})\s*%/i)?.[1] ?? 0)
  const sgst = Number(text.match(/\bsgst\b[^%\n]{0,12}(\d{1,2})\s*%/i)?.[1] ?? 0)
  if (cgst || sgst) return nearestGst(cgst + sgst)

  if (/without payment of tax|\blut\b|export under/i.test(text)) return 0

  return null
}

function isYear(value: number) {
  return Number.isInteger(value) && value >= 1900 && value <= 2100
}

function isHsn(value: string) {
  return /^\d{4,8}$/.test(value)
}

function isSummaryLine(line: string) {
  return /^(sub\s*total|taxable|igst|cgst|sgst|utgst|gst|round\s*off|grand\s*total|amount\s*payable|amount chargeable|total\s*in\s*words|amount\s*in\s*words|total\b)/i.test(
    line
  )
}

function isHsnBreakupLine(line: string) {
  if (/hsn\/?sac/i.test(line) && /(?:taxable|cgst|sgst|igst|tax amount)/i.test(line)) {
    return true
  }
  return /^\d{4,8}\s+[\d,]/.test(line) && /\d\s*%/.test(line)
}

function isJunkDescription(line: string) {
  return /^(sno|sl\.?\s*no|item|description|hsn|sac|qty|quantity|rate|amount|particulars|page\s+\d|no\.?\s*\(incl)/i.test(
    line
  )
}

function hasProductName(value: string) {
  return /[A-Za-z]{3,}/.test(value.replace(/\b(nos|pcs|hsn|sac|gst|cgst|sgst|igst)\b/gi, ""))
}

function trailingMoney(line: string) {
  const match = line.match(/((?:[$₹]|rs\.?|inr)?\s*[\d,]+\.\d{2})\s*$/i)
  if (!match || match.index == null) return null
  const amount = parseMoney(match[1])
  if (amount == null) return null
  return {
    amount,
    rest: line.slice(0, match.index).trim(),
  }
}

const UNIT_TOKEN = "NOS|PCS|PC|UNT|UNITS?|KG|MTR|BOX|SET|QTY"

function normalizeGoodsLine(line: string) {
  return line
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2")
    .replace(/([\d,]+\.\d{2})(\d+)/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
}

function parseTallyGoodsRow(
  line: string,
  taxRate: number
): ParsedInvoiceItem | null {
  const normalized = normalizeGoodsLine(line)
  const match = normalized.match(
    new RegExp(
      `^(\\d{1,3})\\s+(.+?)\\s+([\\d,]+\\.\\d{2})\\s+(?:${UNIT_TOKEN})?\\s*([\\d,]+\\.\\d{2})\\s+(\\d+(?:\\.\\d+)?)\\s*(?:${UNIT_TOKEN})?\\s+(\\d{4,8})$`,
      "i"
    )
  )
  if (!match) return null

  const description = match[2].replace(/\s+/g, " ").trim()
  const rate = parseMoney(match[4])
  const quantity = Number(match[5])
  if (!hasProductName(description) || rate == null || !Number.isFinite(quantity)) {
    return null
  }

  return {
    description,
    quantity: Math.max(1, Math.round(quantity) || 1),
    unitPrice: rate,
    taxRate,
  }
}

function parseAmountRow(line: string, taxRate: number): ParsedInvoiceItem | null {
  const tally = parseTallyGoodsRow(line, taxRate)
  if (tally) return tally

  const normalized = normalizeGoodsLine(line)
  if (isHsnBreakupLine(normalized) || /^\d{4,8}\s+/.test(normalized)) return null

  const money = trailingMoney(normalized)
  if (!money || money.amount <= 0) return null

  let rest = money.rest
  rest = rest.replace(/\s+\d{1,2}\s*%$/i, "").trim()

  const hsn = rest.match(/\s(\d{4,8})$/)
  if (hsn) rest = rest.slice(0, -hsn[0].length).trim()

  const qtyRate = rest.match(/\s+(\d+(?:\.\d+)?)\s+([\d,]+\.?\d{0,2})$/)
  let quantity = 1
  let unitPrice = money.amount
  if (qtyRate) {
    const qty = Number(qtyRate[1])
    const rate = parseMoney(qtyRate[2])
    if (
      rate != null &&
      !isYear(qty) &&
      !isHsn(qtyRate[1]) &&
      !isHsn(qtyRate[2].replace(/,/g, ""))
    ) {
      quantity = Math.max(1, Math.round(qty) || 1)
      unitPrice = rate
      rest = rest.slice(0, -qtyRate[0].length).trim()
    }
  }

  rest = rest.replace(/^\d{1,3}\s+/, "").trim()
  if (
    rest.length < 3 ||
    isJunkDescription(rest) ||
    isSummaryLine(rest) ||
    !hasProductName(rest)
  ) {
    return null
  }

  return {
    description: rest.replace(/\s+/g, " "),
    quantity,
    unitPrice,
    taxRate,
  }
}

function isContinuationLine(line: string) {
  return (
    !/^\d{1,3}\s/.test(line) &&
    !trailingMoney(line) &&
    !isSummaryLine(line) &&
    !isHsnBreakupLine(line) &&
    !isJunkDescription(line) &&
    hasProductName(line) &&
    line.length <= 80 &&
    !/gstin|state name|amount chargeable|declaration|bank name|authorised|company.?s pan|terms of delivery/i.test(
      line
    )
  )
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function readInvoiceSummary(text: string) {
  const amount = (pattern: RegExp) => {
    const raw = text.match(pattern)?.[1]
    return raw ? parseMoney(raw) : null
  }
  const subtotal = amount(/sub\s*total[^\d]{0,12}([\d,]+\.\d{2})/i)
  const sgst = amount(/\bsgst\s*@?\s*[\d.]+%\s*₹?\s*([\d,]+\.\d{2})/i)
  const cgst = amount(/\bcgst\s*@?\s*[\d.]+%\s*₹?\s*([\d,]+\.\d{2})/i)
  const igst = amount(/\bigst\s*@?\s*[\d.]+%\s*₹?\s*([\d,]+\.\d{2})/i)
  const grand = amount(
    /(?:sgst|cgst|igst)@[^\n]*\n\s*total[^\d]{0,12}([\d,]+\.\d{2})/i
  )
  const totalGst =
    sgst == null && cgst == null && igst == null
      ? null
      : round2((sgst ?? 0) + (cgst ?? 0) + (igst ?? 0))
  return { subtotal, totalGst, grand }
}

function gstForBase(base: number, taxRate: number) {
  if (taxRate <= 0) return 0
  if (taxRate % 2 === 0) {
    const half = round2((base * (taxRate / 2)) / 100)
    return round2(half * 2)
  }
  return round2((base * taxRate) / 100)
}

/** Unit price and GST are separate columns. The smaller trailing amount is GST, never the rate. */
function parseVyaparItems(text: string): ParsedInvoiceItem[] {
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
  const items: ParsedInvoiceItem[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const row = lines[index].match(
      /^(\d{1,3})\s+(.+?)\s+(\d+(?:\.\d+)?)\s+(?:-|sqf|nos|pcs|pc|unt|units?|kg|mtr|box|set|qty)\s+₹\s*([\d,]+\.\d{2})\s+₹\s*([\d,]+\.\d{2})$/i
    )
    if (!row) continue

    const description = row[2].replace(/\s+/g, " ").trim()
    const quantity = Number(row[3])
    const unitPrice = parseMoney(row[4])
    const gstAmount = parseMoney(row[5])
    const rateLine = lines[index + 1]?.match(
      /^\((\d+(?:\.\d+)?)%\)\s*₹\s*([\d,]+\.\d{2})$/i
    )
    const statedTotal = rateLine ? parseMoney(rateLine[2]) : null
    if (
      !unitPrice ||
      !gstAmount ||
      gstAmount >= unitPrice ||
      !hasProductName(description) ||
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      continue
    }

    const base = round2(quantity * unitPrice)
    if (statedTotal != null && Math.abs(round2(base + gstAmount) - statedTotal) > 1) {
      continue
    }

    const taxRate = rateLine
      ? nearestGst(Number(rateLine[1]))
      : nearestGst((gstAmount / base) * 100)
    if (Math.abs(gstForBase(base, taxRate) - gstAmount) > 1) continue

    items.push({
      description,
      quantity: Math.max(1, Math.round(quantity) || 1),
      unitPrice,
      taxRate,
    })
    if (rateLine) index += 1
  }

  return items
}

function parseLineItems(text: string, taxRate: number): ParsedInvoiceItem[] {
  const priced = parseVyaparItems(text)
  if (priced.length) return priced

  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)

  const headerIndex = lines.findIndex((line) =>
    /(?:s\.?\s*no|sno|sl\.?\s*no).*(?:item|description|particulars|goods)/i.test(
      line
    )
  )
  const body = headerIndex >= 0 ? lines.slice(headerIndex + 1) : lines
  const items: ParsedInvoiceItem[] = []

  for (const line of body) {
    if (isHsnBreakupLine(line) || /amount chargeable|tax amount \(in words\)|company.?s pan/i.test(line)) {
      if (items.length) break
      continue
    }
    if (isSummaryLine(line) || /total\s*in\s*words|authorized\s+signature|payment\s+terms/i.test(line)) {
      if (items.length) break
      continue
    }
    if (items.length && isContinuationLine(line)) {
      const last = items[items.length - 1]
      last.description = `${last.description} ${line}`.replace(/\s+/g, " ").trim()
      continue
    }
    const item = parseAmountRow(line, taxRate)
    if (item) items.push(item)
  }

  if (items.length) return items

  const grandTotal = parseMoney(
    labeledValue(
      text,
      /(?:grand\s*total|invoice\s*total|amount\s*payable|net\s*payable|(?<![a-z])total(?!\s*in\s*words))[^\d$₹]{0,12}((?:[$₹]|rs\.?|inr)?\s*[\d,]+(?:\.\d{1,2})?)/i
    )
  )

  if (grandTotal && grandTotal > 0) {
    return [
      {
        description: "Invoice total",
        quantity: 1,
        unitPrice: grandTotal,
        taxRate: 0,
      },
    ]
  }

  return []
}

export function parseInvoiceText(
  text: string,
  options?: {
    fileName?: string
    knownVendors?: KnownVendor[]
    knownCustomers?: KnownVendor[]
  }
): ParsedInvoice {
  const cleaned = text.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ")
  const seller = sellerSection(cleaned)
  const buyer = buyerSection(cleaned)
  const vendorName = findVendorName(cleaned, options?.knownVendors ?? [])
  const labeledInvoiceDate = findLabeledDate(
    cleaned,
    /(?:invoice\s*date|bill\s*date|date\s*of\s*invoice|inv\.?\s*date|dated)[:\s]+([0-9A-Za-z/.\- ,]{6,20})/i
  )
  const bareDate = findLabeledDate(
    cleaned,
    /(?:^|\n)\s*Date[:\s]+([0-9]{1,2}[\/.\-][0-9]{1,2}[\/.\-][0-9]{2,4})/i
  )
  const invoiceDate = labeledInvoiceDate ?? bareDate
  const currency = detectCurrency(cleaned)
  const statedGst = documentGst(cleaned)
  const taxRate = statedGst ?? (currency === "INR" ? 18 : 0)

  let dueDate = findLabeledDate(
    cleaned,
    /(?:due\s*date|payment\s*due|pay\s*by)[:\s]+([0-9A-Za-z/.\- ,]{6,20})/i
  )
  if (
    !dueDate &&
    invoiceDate &&
    /due on receipt|upon receipt of invoice|payment to be made upon receipt/i.test(
      cleaned
    )
  ) {
    dueDate = invoiceDate
  }

  const summary = readInvoiceSummary(cleaned)
  let items = parseLineItems(cleaned, taxRate)
  const lineSubtotal = round2(
    items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  )
  const lineGst = round2(
    items.reduce(
      (sum, item) => sum + gstForBase(item.quantity * item.unitPrice, item.taxRate),
      0
    )
  )
  const lineGrand = round2(lineSubtotal + lineGst)
  const reasons: string[] = []
  if (summary.subtotal != null && Math.abs(lineSubtotal - summary.subtotal) > 1) {
    reasons.push(
      `Line subtotal ${lineSubtotal} does not match invoice subtotal ${summary.subtotal}`
    )
  }
  if (summary.totalGst != null && Math.abs(lineGst - summary.totalGst) > 1) {
    reasons.push(
      `Line GST ${lineGst} does not match invoice GST ${summary.totalGst}`
    )
  }
  if (summary.grand != null && Math.abs(lineGrand - summary.grand) > 1) {
    reasons.push(
      `Calculated total ${lineGrand} does not match invoice total ${summary.grand}`
    )
  }
  const gstUsedAsPrice = items.some((item) => {
    const gst = gstForBase(item.quantity * item.unitPrice, item.taxRate)
    return gst > 0 && Math.abs(item.unitPrice - gst) <= 1 && item.unitPrice < lineGrand
  })
  if (gstUsedAsPrice) {
    reasons.push("GST amount was read as the unit price")
  }
  if (reasons.length) items = []

  let confidence = items.length ? 92 : 50
  if (items.length && reasons.length === 0) {
    confidence = summary.grand != null || summary.subtotal != null ? 98 : 96
  }
  if (!invoiceDate) confidence = Math.min(confidence, 80)
  const requiresReview = reasons.length > 0 || confidence < 95

  return {
    vendorName,
    vendorEmail: firstEmail(seller) || firstEmail(cleaned),
    vendorPhone: firstPhone(seller) || firstPhone(cleaned),
    vendorTaxId: firstGstin(seller) || firstGstin(cleaned),
    customerName: findCustomerName(
      cleaned,
      options?.knownCustomers ?? [],
      vendorName
    ),
    customerEmail: firstEmail(buyer),
    customerPhone: firstPhone(buyer),
    customerTaxId: firstGstin(buyer),
    billNumber: findBillNumber(cleaned, options?.fileName),
    invoiceDate,
    invoiceDateVerified: Boolean(invoiceDate),
    dueDate,
    currency,
    subtotal: summary.subtotal ?? (items.length ? lineSubtotal : null),
    totalGst: summary.totalGst ?? (items.length ? lineGst : null),
    grandTotal: summary.grand ?? (items.length ? lineGrand : null),
    confidence,
    requiresReview,
    reviewReason: reasons.join(". "),
    items,
  }
}
