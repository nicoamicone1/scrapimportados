export * from "./types";
export { applyPromotions, computeCart, isCouponActive, isPromotionEligible } from "./engine";
// Agente C: helpers de display (P0-15/P0-20), precios masivos y vigencias.
export { bestPaymentDiscount, netPrice, priceWithDiscount, resolveVatPercent } from "./payment";
export type { BestPaymentDiscount, PaymentMethodDiscountInput } from "./payment";
export {
  applyRounding,
  computeBulkChange,
  describeBulkRule,
  previewBulkUpdate,
  ROUNDING_DIRECTION_LABELS,
  ROUNDING_LABELS,
  SKIP_REASON_LABELS,
} from "./bulk";
export type {
  BulkAction,
  BulkActionType,
  BulkChange,
  BulkPreviewRow,
  BulkPreviewSummary,
  BulkRule,
  BulkSkipReason,
  BulkVariantInput,
  PriceRounding,
  RoundingDirection,
} from "./bulk";
export { isoToZonedLocal, SCHEDULE_STATUS_LABELS, scheduleStatus, zonedLocalToIso } from "./schedule";
export type { ScheduleStatus } from "./schedule";
export {
  categoryDescendants,
  categoryTree,
  COUPON_STATUS_LABELS,
  couponStatus,
  expandCategoryIds,
  summarizeCategorySelection,
} from "./scope";
export type { CategoryLite, CategoryTreeRow, CouponStatus } from "./scope";
