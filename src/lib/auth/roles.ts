export const USER_ROLES = [
  "admin",
  "accountant",
  "auditor",
  "requester",
  "procurement",
  "manager",
  "director_cfo",
  "compliance",
  "warehouse",
  "finance",
  "accounts_payable",
  "accounts_receivable",
  "management",
  "vendor",
] as const

export type UserRole = (typeof USER_ROLES)[number]

export type AppModule =
  | "overview"
  | "ar"
  | "p2p"
  | "rfq"
  | "ap"
  | "approvals"
  | "contacts"
  | "accounting"
  | "audit"
  | "admin"

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  accountant: "Accountant",
  auditor: "Auditor",
  requester: "Requester",
  procurement: "Procurement",
  manager: "Manager",
  director_cfo: "Director / CFO",
  compliance: "Compliance",
  warehouse: "Warehouse",
  finance: "Finance",
  accounts_payable: "Accounts Payable",
  accounts_receivable: "Accounts Receivable",
  management: "Management",
  vendor: "Vendor",
}

/** Roles a person can pick when creating an account. */
export const ASSIGNABLE_ROLES: UserRole[] = [
  "admin",
  "requester",
  "procurement",
  "manager",
  "director_cfo",
  "compliance",
  "warehouse",
  "finance",
  "accounts_payable",
  "accounts_receivable",
  "management",
  "vendor",
]

export const MODULE_PATHS: Record<AppModule, string> = {
  overview: "/dashboard",
  ar: "/dashboard/ar",
  p2p: "/dashboard/p2p",
  rfq: "/dashboard/rfq",
  ap: "/dashboard/ap",
  approvals: "/dashboard/approvals",
  contacts: "/dashboard/contacts",
  accounting: "/dashboard/accounting",
  audit: "/dashboard/audit",
  admin: "/dashboard/admin",
}

const ALL_MODULES: AppModule[] = [
  "overview",
  "ar",
  "p2p",
  "rfq",
  "ap",
  "approvals",
  "contacts",
  "accounting",
  "audit",
  "admin",
]

const ROLE_MODULES: Record<UserRole, AppModule[]> = {
  admin: ALL_MODULES,
  accountant: ["overview", "ar", "ap", "p2p", "contacts", "accounting"],
  auditor: ["overview", "accounting", "audit"],
  requester: ["p2p", "rfq", "contacts"],
  procurement: ["p2p", "rfq", "contacts", "ap"],
  manager: ["overview", "p2p", "rfq", "approvals"],
  director_cfo: ["overview", "p2p", "approvals", "accounting"],
  compliance: ["contacts", "audit"],
  warehouse: ["p2p"],
  finance: ["overview", "p2p", "contacts", "accounting"],
  accounts_payable: ["p2p", "ap", "contacts"],
  accounts_receivable: ["ar", "contacts"],
  management: ["overview", "p2p", "accounting"],
  vendor: ["rfq"],
}

/** Manager band from the spec; Director / CFO covers every amount above this. */
export const MANAGER_APPROVAL_LIMIT = 50_000

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value)
}

export function parseAssignableRole(value: unknown): UserRole | null {
  const role = String(value ?? "").trim()
  if (!isUserRole(role)) return null
  if (!ASSIGNABLE_ROLES.includes(role)) return null
  return role
}

export function roleLabel(role: UserRole | string | null | undefined) {
  if (!role) return "Unknown"
  if (isUserRole(role)) return ROLE_LABELS[role]
  return role
}

export function modulesForRole(role: UserRole): AppModule[] {
  return ROLE_MODULES[role]
}

export function canAccessModule(role: UserRole, module: AppModule) {
  return modulesForRole(role).includes(module)
}

export function homePathForRole(role: UserRole) {
  const [first] = modulesForRole(role)
  return MODULE_PATHS[first ?? "overview"]
}

export function moduleFromPathname(pathname: string): AppModule | null {
  if (pathname === "/dashboard" || pathname === "/dashboard/") return "overview"
  const ranked = (Object.entries(MODULE_PATHS) as [AppModule, string][])
    .filter(([module]) => module !== "overview")
    .sort((left, right) => right[1].length - left[1].length)
  for (const [module, path] of ranked) {
    if (pathname === path || pathname.startsWith(`${path}/`)) return module
  }
  return null
}

export function canCreateRfq(role: UserRole) {
  return role === "admin" || role === "requester" || role === "procurement"
}

export function canQuoteRfq(role: UserRole) {
  return role === "admin" || role === "procurement" || role === "vendor"
}

export function canEvaluateRfq(role: UserRole) {
  return role === "admin" || role === "procurement"
}

export function canWriteAp(role: UserRole) {
  return (
    role === "admin" ||
    role === "accountant" ||
    role === "accounts_payable" ||
    role === "procurement"
  )
}

export function canWriteAr(role: UserRole) {
  return (
    role === "admin" ||
    role === "accountant" ||
    role === "accounts_receivable"
  )
}

export function canRecordArPayment(role: UserRole) {
  return canWriteAr(role) || role === "finance"
}

export function canPostJournals(role: UserRole) {
  return role === "admin" || role === "accountant" || role === "finance"
}

export function canSubmitVendorOnboarding(role: UserRole) {
  return role === "admin" || role === "requester"
}

export function canCreateVendor(role: UserRole) {
  return canSubmitVendorOnboarding(role)
}

export function canReviewVendorStatus(
  role: UserRole,
  status: string | null | undefined
) {
  if (status === "procurement_review") {
    return role === "admin" || role === "procurement"
  }
  if (status === "finance_review") {
    return role === "admin" || role === "finance"
  }
  if (status === "compliance_check") {
    return role === "admin" || role === "compliance"
  }
  return false
}

export function canResubmitVendor(role: UserRole) {
  return role === "admin" || role === "requester"
}

export function canWriteCatalog(role: UserRole) {
  return role === "admin" || role === "procurement" || role === "requester"
}

export function canCreatePr(role: UserRole) {
  return role === "admin" || role === "requester"
}

export function canApprovePr(role: UserRole) {
  return role === "admin" || role === "manager"
}

export function canCreatePo(role: UserRole) {
  return role === "admin" || role === "procurement"
}

export const PO_MANAGER_LIMIT = 50_000
export const PO_DIRECTOR_LIMIT = 500_000

export function canApprovePoAmount(role: UserRole, amount: number) {
  if (role === "admin" || role === "director_cfo") return true
  if (role === "manager") return amount <= PO_MANAGER_LIMIT
  return false
}

export function poApproverLabel(amount: number) {
  if (amount <= PO_MANAGER_LIMIT) return "Manager"
  if (amount <= PO_DIRECTOR_LIMIT) return "Director"
  return "CFO"
}

export function canCreateGrn(role: UserRole) {
  return role === "admin" || role === "warehouse"
}

export function canCreateSes(role: UserRole) {
  return role === "admin" || role === "requester" || role === "procurement"
}

export function canReviewSes(role: UserRole, status: string) {
  if (status === "performed") {
    return role === "admin" || role === "requester" || role === "procurement"
  }
  if (status === "confirmed" || status === "manager_review") {
    return role === "admin" || role === "manager"
  }
  return false
}

export function canMatchInvoice(role: UserRole) {
  return (
    role === "admin" ||
    role === "accounts_payable" ||
    role === "procurement" ||
    role === "finance"
  )
}

export function canProposePayment(role: UserRole) {
  return role === "admin" || role === "accounts_payable" || role === "accountant"
}

export function canApprovePayment(role: UserRole) {
  return role === "admin" || role === "finance"
}

export function canPayVendor(role: UserRole) {
  return role === "admin" || role === "finance" || role === "accounts_payable"
}

export function canCreateCustomer(role: UserRole) {
  return (
    role === "admin" ||
    role === "accountant" ||
    role === "accounts_receivable"
  )
}

export function canReviewApprovals(role: UserRole) {
  return (
    role === "admin" ||
    role === "manager" ||
    role === "director_cfo"
  )
}

export function canApproveBillAmount(role: UserRole, amount: number) {
  if (role === "admin" || role === "director_cfo") return true
  if (role === "manager") return amount <= MANAGER_APPROVAL_LIMIT
  return false
}

export function canApproveBills(role: UserRole) {
  return canReviewApprovals(role)
}

export function canManageCompanies(role: UserRole) {
  return role === "admin"
}

export function deniedMessage(action: string) {
  return `Your role cannot ${action}.`
}
