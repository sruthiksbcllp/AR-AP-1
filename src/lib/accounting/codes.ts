export const ACCOUNT_CODES = {
  bank: "110000",
  accountsReceivable: "120000",
  inventory: "130000",
  inputGst: "140000",
  accountsPayable: "210000",
  gstPayable: "220000",
  sales: "410000",
  operatingExpense: "510000",
} as const

export type AccountCode = (typeof ACCOUNT_CODES)[keyof typeof ACCOUNT_CODES]

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense"

export type JournalSource = "manual" | "ap_bill" | "ar_invoice" | "ar_payment" | "ap_payment"

export const JOURNAL_SOURCE_LABEL: Record<JournalSource, string> = {
  manual: "Manual journal",
  ap_bill: "Vendor bill",
  ar_invoice: "Customer invoice",
  ar_payment: "Customer receipt",
  ap_payment: "Vendor payment",
}
