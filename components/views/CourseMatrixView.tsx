'use client'

import CognitiveLoadMap from '@/components/CognitiveLoadMap'
import styles from './CourseMatrixView.module.css'

export default function CourseMatrixView() {
  return (
    <div className={styles.wrap}>
      <div className="anim-fade-in delay-1">
        <CognitiveLoadMap />
      </div>
    </div>
  )
}
