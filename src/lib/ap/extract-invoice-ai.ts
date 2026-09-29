import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai"
import { APICallError, generateText, Output, type LanguageModel } from "ai"
import { z } from "zod"

import { parseInvoiceDate, type ParsedInvoice } from "@/lib/ap/parse-invoice-text"
import { GST_TAX_RATES, calcTaxAmount, roundMoney } from "@/types/invoices"

const invoiceExtractSchema = z.object({
  vendorName: z
    .string()
    .describe("Seller/supplier name only. Never the buyer or Bill To party."),
  vendorEmail: z.string(),
  vendorPhone: z.string(),
  vendorTaxId: z.string().describe("Seller GSTIN / tax ID, empty if missing."),
  customerName: z.string().describe("Buyer / Bill To / Consignee name."),
  customerEmail: z.string(),
  customerPhone: z.string(),
  customerTaxId: z.string().describe("Buyer GSTIN / tax ID, empty if missing."),
  billNumber: z.string().describe("Invoice or bill number as printed."),
  invoiceDate: z
    .string()
    .describe("Invoice/bill date as YYYY-MM-DD. Empty if not printed."),
  invoiceDateFoundOnDocument: z
    .boolean()
    .describe("True only if the invoice date is printed on the document."),
  dueDate: z
    .string()
    .describe("Payment due date as YYYY-MM-DD. Empty if not printed."),
  currency: z
    .string()
    .describe("ISO currency of printed amounts, usually INR or USD."),
  subtotal: z
    .number()
    .nullable()
    .describe("Printed taxable subtotal before GST. Null if not printed."),
  totalGst: z
    .number()
    .nullable()
    .describe("Printed GST total (CGST+SGST or IGST). Null if not printed."),
  grandTotal: z
    .number()
    .nullable()
    .describe("Printed grand total / amount payable. Null if not printed."),
  items: z
    .array(
      z.object({
        description: z.string(),
        quantity: z.number(),
        unitPrice: z
          .number()
          .describe("Pre-tax rate per unit. Never the GST amount or line total."),
        taxRate: z
          .number()
          .describe("GST percent for the row: 0, 5, 12, 18, or 28."),
      })
    )
    .describe(
      "Goods/service rows only. Skip CGST, SGST, IGST, HSN tax summary, round-off, and total rows."
    ),
})

export class InvoiceExtractConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvoiceExtractConfigError"
  }
}

function nearestGst(rate: number) {
  if (!Number.isFinite(rate)) return 0
  return GST_TAX_RATES.reduce((best, candidate) =>
    Math.abs(candidate - rate) < Math.abs(best - rate) ? candidate : best
  )
}

function normalizeCurrency(value: string) {
  const code = value.trim().toUpperCase().replace(/[^A-Z]/g, "")
  if (["USD", "EUR", "GBP", "AED", "SGD", "INR"].includes(code)) return code
  if (code === "RS" || code === "RUPEE" || code === "RUPEES") return "INR"
  if (value.includes("$") || /dollar/i.test(value)) return "USD"
  return "INR"
}

function looksLikeAnthropicKey(value: string) {
  return value.startsWith("sk-ant-")
}

function looksLikeOpenAiKey(value: string) {
  return (
    value.startsWith("sk-proj-") ||
    value.startsWith("sk-svcacct-") ||
    (value.startsWith("sk-") && !looksLikeAnthropicKey(value))
  )
}

function resolveInvoiceModel(): LanguageModel {
  const namedAnthropic =
    process.env.ANTHROPIC_API_KEY ||
    process.env.CLAUDE_API_KEY ||
    process.env.claude ||
    ""
  const namedOpenAi = process.env.OPENAI_API_KEY || ""

  if (namedAnthropic && looksLikeAnthropicKey(namedAnthropic)) {
    return createAnthropic({ apiKey: namedAnthropic })("claude-sonnet-4-6")
  }

  const openAiKey =
    (namedOpenAi && looksLikeOpenAiKey(namedOpenAi) ? namedOpenAi : "") ||
    (namedAnthropic && looksLikeOpenAiKey(namedAnthropic) ? namedAnthropic : "")
  if (openAiKey) {
    return createOpenAI({ apiKey: openAiKey }).responses("gpt-5.4")
  }

  if (namedAnthropic) {
    throw new InvoiceExtractConfigError(
      "ANTHROPIC_API_KEY is not a Claude key. Use a key from console.anthropic.com that starts with sk-ant-, or put an OpenAI key in OPENAI_API_KEY."
    )
  }

  if (process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN) {
    return "openai/gpt-5.4"
  }

  const googleKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (googleKey) {
    return createGoogleGenerativeAI({ apiKey: googleKey })("gemini-3.8-flash")
  }

  throw new InvoiceExtractConfigError(
    "Invoice reading is not configured. Add ANTHROPIC_API_KEY or OPENAI_API_KEY to .env.local and restart the server."
  )
}

export function invoiceExtractUserError(error: unknown) {
  if (error instanceof InvoiceExtractConfigError) return error.message
  if (error instanceof Error && error.name === "InvoiceExtractConfigError") {
    return error.message
  }

  if (APICallError.isInstance(error)) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return "The API key was rejected. Use a valid Anthropic key (sk-ant-...) or OpenAI key, then restart the server."
    }
    if (error.statusCode === 429) {
      return "The AI provider rate-limited this request. Wait a moment and upload the file again."
    }
    const detail =
      typeof error.data === "object" &&
      error.data &&
      "error" in error.data &&
      typeof (error.data as { error?: { message?: string } }).error?.message ===
        "string"
        ? (error.data as { error: { message: string } }).error.message
        : error.message
    return `Could not read this file: ${detail}`
  }

  return "Could not read this file. Use a clear PDF or photo, then fill any missing fields."
}

function reconcileExtractedInvoice(
  raw: z.infer<typeof invoiceExtractSchema>
): ParsedInvoice {
  const items = raw.items
    .map((item) => {
      const description = item.description.trim()
      if (!description) return null
      const quantity = Number.isFinite(item.quantity)
        ? Math.max(item.quantity, 0)
        : 0
      const unitPrice = Number.isFinite(item.unitPrice) ? item.unitPrice : 0
      if (quantity <= 0 || unitPrice < 0) return null
      return {
        description,
        quantity,
        unitPrice,
        taxRate: nearestGst(item.taxRate),
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  const lineSubtotal = roundMoney(
    items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  )
  const lineGst = roundMoney(
    items.reduce(
      (sum, item) =>
        sum + calcTaxAmount(item.quantity, item.unitPrice, item.taxRate),
      0
    )
  )
  const lineGrand = roundMoney(lineSubtotal + lineGst)
  const reasons: string[] = []

  if (raw.subtotal != null && Math.abs(lineSubtotal - raw.subtotal) > 1) {
    reasons.push(
      `Line subtotal ${lineSubtotal} does not match invoice subtotal ${raw.subtotal}`
    )
  }
  if (raw.totalGst != null && Math.abs(lineGst - raw.totalGst) > 1) {
    reasons.push(
      `Line GST ${lineGst} does not match invoice GST ${raw.totalGst}`
    )
  }
  if (raw.grandTotal != null && Math.abs(lineGrand - raw.grandTotal) > 1) {
    reasons.push(
      `Calculated total ${lineGrand} does not match invoice total ${raw.grandTotal}`
    )
  }

  const gstUsedAsPrice = items.some((item) => {
    const gst = calcTaxAmount(item.quantity, item.unitPrice, item.taxRate)
    return gst > 0 && Math.abs(item.unitPrice - gst) <= 1 && item.unitPrice < lineGrand
  })
  if (gstUsedAsPrice) {
    reasons.push("GST amount was read as the unit price")
  }

  const invoiceDate = parseInvoiceDate(raw.invoiceDate)
  const dueDate = parseInvoiceDate(raw.dueDate)
  const invoiceDateVerified = Boolean(
    invoiceDate && raw.invoiceDateFoundOnDocument
  )

  let confidence = items.length ? 92 : 50
  if (items.length && reasons.length === 0) {
    confidence =
      raw.grandTotal != null || raw.subtotal != null ? 98 : 96
  }
  if (!invoiceDateVerified) confidence = Math.min(confidence, 80)

  return {
    vendorName: raw.vendorName.trim(),
    vendorEmail: raw.vendorEmail.trim(),
    vendorPhone: raw.vendorPhone.trim(),
    vendorTaxId: raw.vendorTaxId.trim(),
    customerName: raw.customerName.trim(),
    customerEmail: raw.customerEmail.trim(),
    customerPhone: raw.customerPhone.trim(),
    customerTaxId: raw.customerTaxId.trim(),
    billNumber: raw.billNumber.trim(),
    invoiceDate,
    invoiceDateVerified,
    dueDate,
    currency: normalizeCurrency(raw.currency),
    subtotal: raw.subtotal ?? (items.length ? lineSubtotal : null),
    totalGst: raw.totalGst ?? (items.length ? lineGst : null),
    grandTotal: raw.grandTotal ?? (items.length ? lineGrand : null),
    confidence,
    requiresReview: reasons.length > 0 || confidence < 95,
    reviewReason: reasons.join(". "),
    items,
  }
}

export async function extractInvoiceWithAi(input: {
  bytes: Uint8Array
  mediaType: string
  fileName: string
  knownVendors?: string[]
  knownCustomers?: string[]
}): Promise<ParsedInvoice> {
  const model = resolveInvoiceModel()
  const knownVendors = (input.knownVendors ?? []).filter(Boolean).slice(0, 40)
  const knownCustomers = (input.knownCustomers ?? [])
    .filter(Boolean)
    .slice(0, 40)

  const { output } = await generateText({
    model,
    output: Output.object({
      name: "InvoiceExtract",
      description: "Structured fields from an Indian or USD tax invoice.",
      schema: invoiceExtractSchema,
    }),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: [
              "Read this invoice or vendor bill and extract the fields.",
              "Vendor is the seller/supplier, never the buyer (Bill To / Consignee).",
              "Customer is the buyer.",
              "Line items are goods or services only. Ignore HSN tax-summary tables, CGST, SGST, IGST, round-off, and total rows.",
              "unitPrice is the pre-tax rate per unit from the rate column, not amount or GST.",
              "taxRate is the GST percent on that row (usually 18 for India).",
              "Copy numbers exactly. Do not invent missing values; use empty string or null.",
              knownVendors.length
                ? `Known vendors: ${knownVendors.join("; ")}`
                : "",
              knownCustomers.length
                ? `Known customers: ${knownCustomers.join("; ")}`
                : "",
              `File name: ${input.fileName}`,
            ]
              .filter(Boolean)
              .join("\n"),
          },
          {
            type: "file",
            data: input.bytes,
            mediaType: input.mediaType,
            filename: input.fileName,
          },
        ],
      },
    ],
  })

  if (!output) {
    throw new Error("The model returned no invoice fields.")
  }

  return reconcileExtractedInvoice(output)
}
