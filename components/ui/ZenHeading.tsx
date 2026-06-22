import styles from './ZenHeading.module.css'

interface ZenHeadingProps {
  eyebrow?: string
  title: string
  subtitle?: string
  size?: 'sm' | 'md' | 'lg'
}

export default function ZenHeading({
  title,
  size = 'lg',
}: ZenHeadingProps) {
  return (
    <header className={styles.root}>
      <h1 className={`${styles.title} ${styles[size]}`}>{title}</h1>
    </header>
  )
}
