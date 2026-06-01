import styles from './ZenHeading.module.css'

interface ZenHeadingProps {
  eyebrow?: string
  title: string
  subtitle?: string
  size?: 'sm' | 'md' | 'lg'
}

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
