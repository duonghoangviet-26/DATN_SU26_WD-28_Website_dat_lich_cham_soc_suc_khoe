import type { Variants } from 'framer-motion'

// Dùng một lần ở lớp route: đưa toàn bộ nội dung trang vào nhẹ từ phía trên.
export const pageVariants: Variants = {
  hidden: { opacity: 0, y: -18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
}

// Dùng cho nhóm section/card; chỉ điều phối nhịp, không tự thay đổi giao diện khối cha.
export const containerStagger: Variants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.05,
      staggerChildren: 0.08,
    },
  },
}

// Dùng cho từng section/card con trong AdminMotionGroup.
export const itemVariants: Variants = {
  hidden: { opacity: 0, y: -14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] },
  },
}

// Reduced motion vẫn dùng chung contract variant nhưng hiển thị tức thời, không delay.
export const reducedPageVariants: Variants = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 1, y: 0 },
}

export const reducedContainerStagger: Variants = {
  hidden: {},
  visible: {},
}

export const reducedItemVariants: Variants = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0 },
}
