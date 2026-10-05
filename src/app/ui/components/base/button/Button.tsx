import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";
import { buttonClasses as C } from "./button.classes";

export type ButtonVariant = "solid" | "soft" | "outline" | "ghost" | "link";
export type ButtonTone = "accent" | "neutral" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

// DESIGN.md §3 (label): main button = label-lg, small button = label-md (label-sm is
// for badges/captions, not buttons)
const sizeLabel: Record<ButtonSize, string> = {
  sm: "text-label-md",
  md: "text-label-lg",
  lg: "text-label-lg",
  icon: "text-label-md",
};

const COMPONENT_NAME = "Button";
const COMPONENT_PAGE = "/ui/components/base/button";

type OwnProps = {
  variant?: ButtonVariant | (string & {});
  tone?: ButtonTone;
  size?: ButtonSize;
  loading?: boolean;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
  fullWidth?: boolean;
  href?: string;
  className?: string;
  children?: ReactNode;
};

export type ButtonProps = OwnProps &
  Omit<
    ButtonHTMLAttributes<HTMLButtonElement> &
      AnchorHTMLAttributes<HTMLAnchorElement>,
    keyof OwnProps
  >;

const cn = (...xs: Array<string | false | undefined>) =>
  xs.filter(Boolean).join(" ");

export function Button({
  variant = "solid",
  tone = "accent",
  size = "md",
  loading = false,
  iconStart,
  iconEnd,
  fullWidth = false,
  href,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = cn(
    C.base,
    (C.styles as Record<string, Record<string, string>>)[variant]?.[tone] ?? "",
    variant !== "link" && C.size[size],
    fullWidth && "w-full",
    sizeLabel[size],
    className
  );

  const content = (
    <>
      {loading ? (
        <span
          className="inline-block size-[1em] animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      ) : (
        iconStart
      )}
      {children}
      {!loading && iconEnd}
    </>
  );

  if (href !== undefined) {
    return (
      <a
        href={href}
        className={classes}
        aria-disabled={disabled || loading || undefined}
        data-component={COMPONENT_NAME}
        data-component-href={COMPONENT_PAGE}
        {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      data-component={COMPONENT_NAME}
      data-component-href={COMPONENT_PAGE}
      {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {content}
    </button>
  );
}
