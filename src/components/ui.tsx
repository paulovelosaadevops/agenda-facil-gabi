import clsx from "clsx";
import { ChevronRight, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/* ---------- Botões ---------- */

type ButtonVariant = "filled" | "tinted" | "gray" | "plain" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, string> = {
  filled: "bg-accent-strong text-accent-fg hover:brightness-110 active:brightness-95",
  tinted: "bg-accent/12 text-accent hover:bg-accent/18",
  gray: "bg-fill text-label hover:bg-fill/70",
  plain: "text-accent hover:opacity-70",
  destructive: "bg-red/10 text-red hover:bg-red/15",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 rounded-full px-3.5 text-[13px]",
  md: "h-10 rounded-xl px-4 text-[15px]",
  lg: "h-[50px] rounded-[14px] px-5 text-[17px]",
};

export function buttonClass(variant: ButtonVariant = "filled", size: ButtonSize = "md", className?: string) {
  return clsx(
    "inline-flex shrink-0 select-none items-center justify-center gap-1.5 font-semibold whitespace-nowrap transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
    buttonVariants[variant],
    buttonSizes[size],
    variant === "plain" && "!px-0",
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

/** Botão redondo só com ícone (ex.: "+" na barra de navegação). */
export function iconButtonClass(variant: "tinted" | "gray" | "filled" = "tinted", className?: string) {
  return clsx(
    "inline-flex size-8 shrink-0 items-center justify-center rounded-full transition active:scale-95",
    variant === "tinted" && "bg-accent/12 text-accent hover:bg-accent/18",
    variant === "gray" && "bg-fill text-label-2 hover:text-label",
    variant === "filled" && "bg-accent-strong text-accent-fg",
    className,
  );
}

/* ---------- Superfícies ---------- */

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={clsx("rounded-2xl bg-surface p-4", className)} {...props} />;
}

/** Seção de lista agrupada (como no app Ajustes do iPhone). */
export function List({
  header,
  footer,
  children,
  className,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx("mb-7", className)}>
      {header && <h2 className="px-4 pb-1.5 text-[13px] text-label-2 uppercase">{header}</h2>}
      <div className="overflow-hidden rounded-xl bg-surface">{children}</div>
      {footer && <p className="px-4 pt-1.5 text-[13px] leading-snug text-label-2">{footer}</p>}
    </section>
  );
}

const rowBase =
  "relative flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left after:absolute after:right-0 after:bottom-0 after:h-px after:bg-separator last:after:hidden";

export function Row({
  href,
  external,
  onClick,
  leading,
  title,
  subtitle,
  detail,
  chevron,
  tone = "default",
  className,
}: {
  href?: string;
  external?: boolean;
  onClick?: () => void;
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  detail?: ReactNode;
  chevron?: boolean;
  tone?: "default" | "accent" | "destructive" | "muted";
  className?: string;
}) {
  const interactive = Boolean(href || onClick);
  const classes = clsx(
    rowBase,
    leading ? "after:left-[3.75rem]" : "after:left-4",
    interactive && "cursor-pointer transition-colors hover:bg-fill-2 active:bg-fill",
    className,
  );
  const content = (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span
          className={clsx(
            "block truncate text-[16px] md:text-[15px]",
            tone === "accent" && "text-accent",
            tone === "destructive" && "text-red",
            tone === "muted" && "text-label-2",
          )}
        >
          {title}
        </span>
        {subtitle && <span className="mt-0.5 block truncate text-[13px] text-label-2">{subtitle}</span>}
      </span>
      {detail != null && <span className="shrink-0 text-[15px] text-label-2">{detail}</span>}
      {chevron && <ChevronRight className="-mr-1 size-[18px] shrink-0 text-label-3" strokeWidth={2.5} />}
    </>
  );

  if (href) {
    return external ? (
      <a href={href} target="_blank" rel="noreferrer" className={classes}>
        {content}
      </a>
    ) : (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {content}
      </button>
    );
  }
  return <div className={classes}>{content}</div>;
}

/** Ícone colorido de linha de ajustes. */
export function RowIcon({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="flex size-[30px] shrink-0 items-center justify-center rounded-[8px] text-white" style={{ background: color }}>
      {children}
    </span>
  );
}

/* ---------- Formulários em linhas ---------- */

/** Linha de formulário: rótulo à esquerda, controle à direita. */
export function FormRow({ label, children, stacked }: { label: string; children: ReactNode; stacked?: boolean }) {
  return (
    <label
      className={clsx(
        rowBase,
        "after:left-4 focus-within:bg-fill-2",
        stacked && "flex-col !items-stretch gap-1",
      )}
    >
      <span className={clsx("shrink-0 text-[16px] md:text-[15px]", stacked ? "text-[13px] text-label-2 md:text-[13px]" : "w-36")}>
        {label}
      </span>
      <span className="flex min-w-0 flex-1 justify-end">{children}</span>
    </label>
  );
}

// 16px no celular evita o zoom automático do iOS ao focar o campo.
const rowControl =
  "w-full min-w-0 bg-transparent text-right text-[16px] text-label outline-none placeholder:text-label-3 md:text-[15px]";

export function RowInput({ className, ...props }: ComponentProps<"input">) {
  return <input className={clsx(rowControl, className)} {...props} />;
}

export function RowSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <span className="relative flex w-full justify-end">
      <select className={clsx(rowControl, "cursor-pointer appearance-none pr-5 [text-align-last:right]", className)} {...props}>
        {children}
      </select>
      <ChevronsUpDown className="pointer-events-none absolute top-1/2 right-0 size-3.5 -translate-y-1/2 text-label-3" />
    </span>
  );
}

/** Área de texto que ocupa a linha inteira. */
export function TextAreaRow({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <div className="relative px-4 py-3 after:absolute after:right-0 after:bottom-0 after:left-4 after:h-px after:bg-separator last:after:hidden">
      <textarea
        className={clsx(
          "block min-h-24 w-full resize-none bg-transparent text-[16px] outline-none placeholder:text-label-3 md:text-[15px]",
          className,
        )}
        {...props}
      />
    </div>
  );
}

/** Campo solto (fora de lista), preenchido com cinza como no iOS. */
export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={clsx(
        "h-11 w-full rounded-xl bg-fill px-3.5 text-[16px] outline-none placeholder:text-label-3 focus:ring-2 focus:ring-accent/40 md:text-[15px]",
        className,
      )}
      {...props}
    />
  );
}

export function Switch({
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { className?: string }) {
  return (
    <span className={clsx("relative inline-flex shrink-0", className)}>
      <input type="checkbox" role="switch" className="peer sr-only" {...props} />
      <span className="h-[31px] w-[51px] rounded-full bg-fill transition-colors duration-200 peer-checked:bg-green-bright peer-focus-visible:ring-2 peer-focus-visible:ring-accent/50 peer-disabled:opacity-50" />
      <span className="pointer-events-none absolute top-[2px] left-[2px] size-[27px] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.15),0_3px_1px_rgb(0_0_0/0.06)] transition-transform duration-200 peer-checked:translate-x-5" />
    </span>
  );
}

/** Linha com texto e switch; tocar na linha liga/desliga. */
export function SwitchRow({ label, subtitle, ...props }: Omit<ComponentProps<"input">, "type"> & { label: string; subtitle?: string }) {
  return (
    <label className={clsx(rowBase, "cursor-pointer after:left-4")}>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] md:text-[15px]">{label}</span>
        {subtitle && <span className="mt-0.5 block text-[13px] text-label-2">{subtitle}</span>}
      </span>
      <Switch {...props} />
    </label>
  );
}

/** Controle segmentado que funciona dentro de formulários (rádios). */
export function Segmented({
  name,
  options,
  defaultValue,
}: {
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
}) {
  return (
    <div role="radiogroup" className="grid auto-cols-fr grid-flow-col rounded-[9px] bg-fill p-0.5">
      {options.map((o) => (
        <label
          key={o.value}
          className="flex h-8 cursor-pointer items-center justify-center rounded-[7px] px-2 text-center text-[13px] font-medium transition has-[:checked]:bg-segment has-[:checked]:font-semibold has-[:checked]:shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/50"
        >
          <input type="radio" className="sr-only" name={name} value={o.value} defaultChecked={o.value === defaultValue} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

/* ---------- Diversos ---------- */

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#a8adb9] to-[#868a96] font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {initials || "?"}
    </span>
  );
}

export function Alert({ tone = "error", children }: { tone?: "error" | "success" | "info"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={clsx(
        "rounded-xl px-3.5 py-2.5 text-[13px] leading-snug",
        tone === "error" && "bg-red/10 text-red",
        tone === "success" && "bg-green/10 text-green",
        tone === "info" && "bg-blue/10 text-blue",
      )}
    >
      {children}
    </p>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon && <div className="mb-3 text-label-3">{icon}</div>}
      <p className="text-[17px] font-semibold">{title}</p>
      {children && <p className="mt-1 max-w-xs text-[15px] text-label-2">{children}</p>}
    </div>
  );
}

/** Marca do app: quadrado arredondado com brilho. */
export function AppMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span
      className={clsx("flex shrink-0 items-center justify-center bg-gradient-to-br from-[#ff8fb5] via-[#e5396f] to-[#b8245a] text-white", className)}
      style={{ width: size, height: size, borderRadius: size * 0.225 }}
      aria-hidden
    >
      <svg width={size * 0.52} height={size * 0.52} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 1.5c.5 4.9 2.6 8 7.5 9.3.6.2.6.9 0 1.1-4.9 1.3-7 4.4-7.5 9.3-.1.6-.9.6-1 0-.5-4.9-2.6-8-7.5-9.3-.6-.2-.6-.9 0-1.1 4.9-1.3 7-4.4 7.5-9.3.1-.6.9-.6 1 0Z" />
      </svg>
    </span>
  );
}
