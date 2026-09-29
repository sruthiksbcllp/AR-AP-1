"use server"

import { revalidatePath } from "next/cache"

import {
  extractInvoiceWithAi,
  invoiceExtractUserError,
} from "@/lib/ap/extract-invoice-ai"
import { normalizeName } from "@/lib/ap/parse-invoice-text"
import { requireOrgContext } from "@/lib/auth/org"
import { DEFAULT_CURRENCY, formatINR, formatMoney } from "@/lib/currency"
import { getHistoricalRateToInr } from "@/lib/fx"
import { calcLineTotal, roundMoney } from "@/types/invoices"

const EXTRACT_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
])

export type ExtractedInvoiceItem = {
  description: string
  quantity: string
  unit_price: string
  tax_rate: string
}

export type ExtractedCustomer = {
  id: string
  name: string
  email: string
  currency: string
}

export type ExtractInvoiceResult =
  | {
      success: true
      customerId: string | null
      newCustomer: ExtractedCustomer | null
      invoiceNumber: string | null
      issueDate: string | null
      dueDate: string | null
      sourceCurrency: string
      sourceTotal: number | null
      fxRate: number | null
      fxAsOf: string | null
      inrTotal: number | null
      needsReview: boolean
      blockSubmit: boolean
      items: ExtractedInvoiceItem[]
      message: string
    }
  | { success: false; error: string }

function resolveMediaType(file: File) {
  if (EXTRACT_MIME.has(file.type)) return file.type
  const name = file.name.toLowerCase()
  if (name.endsWith(".pdf")) return "application/pdf"
  if (name.endsWith(".png")) return "image/png"
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg"
  if (name.endsWith(".webp")) return "image/webp"
  return file.type || "application/octet-stream"
}

function customerPlaceholderEmail(name: string) {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "customer"
  return `${slug}@customers.sbcllp.in`
}

function addDaysIso(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return iso
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export async function extractInvoiceFromUpload(
  formData: FormData
): Promise<ExtractInvoiceResult> {
  const auth = await requireOrgContext()
  if (!auth.ok) return { success: false, error: auth.error }

  const { supabase, orgId, userId } = auth.ctx
  const file = formData.get("attachment")

  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Choose a PDF or image of the customer invoice." }
  }

  if (file.size > 10 * 1024 * 1024) {
    return { success: false, error: "Attachment must be 10MB or smaller." }
  }

  const mediaType = resolveMediaType(file)
  if (!EXTRACT_MIME.has(mediaType)) {
    return {
      success: false,
      error:
        "Upload a PDF, JPG, PNG, or WebP. Word files must be entered by hand.",
    }
  }

  const { data: customers, error: customersError } = await supabase
    .from("contacts")
    .select("id, name, email, currency")
    .eq("type", "customer")
    .eq("org_id", orgId)

  if (customersError) {
    return { success: false, error: customersError.message }
  }

  const knownCustomers = customers ?? []
  const bytes = new Uint8Array(await file.arrayBuffer())

  let extracted
  try {
    extracted = await extractInvoiceWithAi({
      bytes,
      mediaType,
      fileName: file.name,
      knownCustomers: knownCustomers.map((customer) => customer.name),
    })
  } catch (error) {
    console.error("invoice AI extract failed", error)
    return {
      success: false,
      error: invoiceExtractUserError(error),
    }
  }

  const customerName = extracted.customerName.trim()
  const customerEmail = extracted.customerEmail.trim()
  const invoiceNumber = extracted.billNumber.trim() || null
  const issueDate = extracted.invoiceDate
  let dueDate = extracted.dueDate
  if (!dueDate && issueDate) dueDate = addDaysIso(issueDate, 30)

  const sourceCurrency = extracted.currency || DEFAULT_CURRENCY
  const sourceTotal = roundMoney(
    extracted.items.reduce(
      (sum, item) =>
        sum + calcLineTotal(item.quantity, item.unitPrice, item.taxRate),
      0
    )
  )
  let fxNote: string | null = null
  let amountMultiplier = 1
  let needsReview = false
  let fxRate: number | null = null
  let fxAsOf: string | null = null
  let inrTotal: number | null =
    sourceCurrency === DEFAULT_CURRENCY ? sourceTotal : null

  if (sourceCurrency !== DEFAULT_CURRENCY) {
    if (!extracted.invoiceDateVerified || !extracted.invoiceDate) {
      needsReview = true
      fxNote = `Needs review: the invoice date could not be verified, so ${sourceCurrency} was not converted to INR.`
    } else {
      const quote = await getHistoricalRateToInr(
        sourceCurrency,
        extracted.invoiceDate
      )
      if (!quote) {
        needsReview = true
        fxNote = `Needs review: no ${sourceCurrency}-to-INR rate for invoice date ${extracted.invoiceDate}. Amounts were not converted.`
      } else {
        amountMultiplier = quote.rate
        fxRate = quote.rate
        fxAsOf = quote.asOf
        inrTotal = roundMoney(sourceTotal * quote.rate)
        const rateDate =
          quote.asOf === extracted.invoiceDate
            ? extracted.invoiceDate
            : `${extracted.invoiceDate}, market rate ${quote.asOf}`
        fxNote = `Invoice is ${sourceCurrency}. Converted ${formatMoney(sourceTotal, sourceCurrency)} at ${formatINR(quote.rate)} per ${sourceCurrency} (${rateDate}) → ${formatINR(inrTotal)}.`
      }
    }
  }

  const items = extracted.items
    .map((item) => {
      const description = item.description.trim()
      if (!description || !Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
        return null
      }
      return {
        description,
        quantity: String(Math.max(1, Math.round(item.quantity) || 1)),
        unit_price: String(roundMoney(item.unitPrice * amountMultiplier)),
        tax_rate: String(item.taxRate),
      } satisfies ExtractedInvoiceItem
    })
    .filter((item): item is ExtractedInvoiceItem => item !== null)

  let customerId: string | null = null
  let newCustomer: ExtractedCustomer | null = null

  if (customerName) {
    const wanted = normalizeName(customerName)
    const match = knownCustomers.find((customer) => {
      const current = normalizeName(customer.name)
      return (
        current === wanted ||
        current.includes(wanted) ||
        wanted.includes(current)
      )
    })

    if (match) {
      customerId = match.id
    } else {
      const email = customerEmail.includes("@")
        ? customerEmail
        : customerPlaceholderEmail(customerName)
      const { data: created, error: createError } = await supabase
        .from("contacts")
        .insert({
          org_id: orgId,
          type: "customer",
          name: customerName,
          email,
          phone: extracted.customerPhone.trim() || null,
          tax_id: extracted.customerTaxId.trim() || null,
          currency: sourceCurrency,
        })
        .select("id, name, email, currency")
        .single()

      if (!createError && created) {
        customerId = created.id
        newCustomer = {
          id: created.id,
          name: created.name,
          email: created.email,
          currency: created.currency,
        }
        await supabase.from("audit_logs").insert({
          org_id: orgId,
          user_id: userId,
          action: "contact.create",
          entity: "contacts",
          entity_id: created.id,
          changes_json: {
            after: {
              source: "invoice-ai",
              name: customerName,
              email,
            },
          },
        })
        revalidatePath("/dashboard/contacts")
        revalidatePath("/dashboard/ar")
        revalidatePath("/dashboard/ar/new")
      }
    }
  }

  const filled = [
    customerId ? "customer" : null,
    invoiceNumber ? "invoice number" : null,
    issueDate ? "issue date" : null,
    dueDate ? "due date" : null,
    items.length ? "line items" : null,
  ].filter(Boolean)

  return {
    success: true,
    customerId,
    newCustomer,
    invoiceNumber,
    issueDate,
    dueDate,
    sourceCurrency,
    sourceTotal: extracted.items.length ? sourceTotal : null,
    fxRate,
    fxAsOf,
    inrTotal,
    needsReview,
    blockSubmit: extracted.requiresReview || needsReview,
    items,
    message: [
      extracted.requiresReview
        ? `${extracted.reviewReason || "Invoice totals do not reconcile."} Correct the invoice before creating it.`
        : null,
      needsReview
        ? `${fxNote ?? "Needs review."} Customer, invoice number, dates, and line items were filled from the invoice. Convert to INR after review — do not submit unconverted amounts.`
        : null,
      !extracted.requiresReview && !needsReview && filled.length
        ? `${fxNote ? `${fxNote} ` : ""}Filled ${filled.join(", ")} from the invoice. Review before creating it.`
        : null,
      !extracted.requiresReview && !needsReview && !filled.length
        ? "Invoice details could not be found. Enter them manually."
        : null,
    ]
      .filter(Boolean)
      .join(" "),
  }
}
