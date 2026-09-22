/**
 * Primitivas del ADMIN (tokens `--adm-*`, ver src/app/admin/admin.css y
 * docs/DESIGN.md §7). No usar en el storefront (tiene su propio sistema).
 */
export { Button, ButtonLink, buttonClass, type ButtonProps, type ButtonVariant, type ButtonSize } from "./Button";
export { Input, Textarea, Select, Checkbox, Label, controlClass, type InputProps, type SelectProps } from "./Input";
export { Switch, type SwitchProps } from "./Switch";
export { Badge, StatusBadge, STATUS_BADGES, type BadgeTone, type StatusKind } from "./Badge";
export { Card, CardHeader, CardBody, CardFooter, FormSection } from "./Card";
export { Table, THead, TBody, TR, TH, TD, TableEmpty } from "./Table";
export { Dialog, Drawer, type DialogProps, type DrawerProps } from "./Dialog";
export { ConfirmDialog, type ConfirmDialogProps } from "./ConfirmDialog";
export { DropdownMenu, DropdownItem, DropdownSeparator, DropdownLabel } from "./DropdownMenu";
export { Tabs, TabsNav, type TabItem, type TabsNavItem } from "./Tabs";
export { Tooltip } from "./Tooltip";
export { EmptyState, PageHeader, Skeleton, Kbd, Stat, StatStrip, type Crumb } from "./display";
export { Field, type FieldProps } from "./Field";
export { SearchInput } from "./SearchInput";
export { Pagination } from "./Pagination";
export { Toaster } from "./Toaster";
export { toast } from "sonner";
