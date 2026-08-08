import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

const ease = [0.22, 1, 0.36, 1] as const

export function RouteTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, ease }}
    >
      {children}
    </motion.div>
  )
}

export function Reveal({ children, className = '', delay = 0, y = 30 }: { children: ReactNode; className?: string; delay?: number; y?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1, margin: '0px 0px -5% 0px' }}
      transition={{ duration: 0.7, delay, ease }}
    >
      {children}
    </motion.div>
  )
}

export function ContentTransition({ transitionKey, children }: { transitionKey: string | number; children: ReactNode }) {
  return (
    <motion.div
      key={transitionKey}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35, ease }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerContainer({ children, className = '', staggerDelay = 0.1, delayChildren = 0.1, viewportMargin = '-5% 0px' }: { children: ReactNode; className?: string; staggerDelay?: number; delayChildren?: number; viewportMargin?: string }) {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: delayChildren,
      }
    }
  }

  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.1, margin: viewportMargin as any }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className = '', y = 30 }: { children: ReactNode; className?: string; y?: number }) {
  const itemVariants = {
    hidden: { opacity: 0, y },
    show: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.7, ease }
    }
  }

  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  )
}
