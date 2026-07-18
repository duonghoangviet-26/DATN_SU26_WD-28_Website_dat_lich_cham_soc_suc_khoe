import { Children, isValidElement, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

import {
  containerStagger,
  itemVariants,
  reducedContainerStagger,
  reducedItemVariants,
} from '@/animations/adminMotion'

type MotionBlockProps = {
  children: ReactNode
  className?: string
}

// Nhóm dùng chung cho các section/card cấp cao; chỉ chạy ở lần mount của nhóm.
export function AdminMotionGroup({ children, className = '' }: MotionBlockProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      className={className}
      variants={shouldReduceMotion ? reducedContainerStagger : containerStagger}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  )
}

// Mỗi child trực tiếp của AdminMotionGroup dùng item này; không dùng cho từng hàng bảng.
export function AdminMotionItem({ children, className = '' }: MotionBlockProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      className={className}
      variants={shouldReduceMotion ? reducedItemVariants : itemVariants}
    >
      {children}
    </motion.div>
  )
}

// Dùng cho các trang danh sách chuẩn: stagger block cấp cao đúng một lần, không đụng từng row.
export function AdminAutoStagger({ children, className = '' }: MotionBlockProps) {
  const shouldReduceMotion = useReducedMotion()
  const [hasEntered, setHasEntered] = useState(false)
  const childVariants = shouldReduceMotion ? reducedItemVariants : itemVariants

  return (
    <motion.div
      className={className}
      variants={shouldReduceMotion ? reducedContainerStagger : containerStagger}
      initial="hidden"
      animate="visible"
      onAnimationComplete={() => setHasEntered(true)}
    >
      {Children.map(children, (child, index) => (
        <motion.div
          key={isValidElement(child) && child.key != null ? child.key : index}
          variants={hasEntered ? undefined : childVariants}
          initial={hasEntered ? false : undefined}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  )
}
