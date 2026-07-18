import { describe, expect, it } from 'vitest'

import {
  containerStagger,
  itemVariants,
  pageVariants,
  reducedContainerStagger,
  reducedItemVariants,
  reducedPageVariants,
} from '@/animations/adminMotion'

describe('admin motion contract', () => {
  it('keeps page and stagger motion short and subtle', () => {
    expect(pageVariants).toMatchObject({
      hidden: { opacity: 0, y: -18 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
    })
    expect(containerStagger).toMatchObject({
      visible: { transition: { delayChildren: 0.05, staggerChildren: 0.08 } },
    })
    expect(itemVariants).toMatchObject({
      hidden: { opacity: 0, y: -14 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] } },
    })
  })

  it('renders immediately without transitions when reduced motion is requested', () => {
    expect(reducedPageVariants).toEqual({
      hidden: { opacity: 1, y: 0 },
      visible: { opacity: 1, y: 0 },
      exit: { opacity: 1, y: 0 },
    })
    expect(reducedContainerStagger).toEqual({ hidden: {}, visible: {} })
    expect(reducedItemVariants).toEqual({
      hidden: { opacity: 1, y: 0 },
      visible: { opacity: 1, y: 0 },
    })
  })
})
