import styles from './ZenHeading.module.css'

interface ZenHeadingProps {
  eyebrow?: string
  title: string
  subtitle?: string
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Display heading primitive.
 *
 * `eyebrow` and `subtitle` were part of the type, had styles in the CSS
 * module, and were passed by six views — but the component destructured
 * only `title` and `size`, so both were silently dropped everywhere. The
 * props typechecked, the callers looked right, and nothing rendered.
 *
 * The eyebrow inherits `--cat-accent`, so it picks up the active
 * category's colour (purple in Essentials, green in Creator's Choice,
 * slate in the Vault) with no per-view wiring.
 */
export default function ZenHeading({
  eyebrow,
  title,
  subtitle,
  size = 'lg',
}: ZenHeadingProps) {
  return (
    <header className={styles.root}>
      {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
      <h1 className={`${styles.title} ${styles[size]}`}>{title}</h1>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </header>
  )
}
