import { useState, useEffect, useRef } from 'react'

export function useDraggable(initialPosition = { x: 0, y: 0 }) {
  const [position, setPosition] = useState(initialPosition)
  const [isDragging, setIsDragging] = useState(false)
  
  // Lưu tọa độ ban đầu khi bắt đầu kéo
  const dragStartPos = useRef({ x: 0, y: 0 })
  // Lưu tọa độ của cửa sổ trước khi kéo
  const windowStartPos = useRef({ x: 0, y: 0 })

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    // Chỉ kích hoạt khi click chuột trái
    if ('button' in e && e.button !== 0) return

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY

    setIsDragging(true)
    dragStartPos.current = { x: clientX, y: clientY }
    windowStartPos.current = { ...position }

    // Ngăn bôi đen chữ khi đang kéo
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return

      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY

      const deltaX = clientX - dragStartPos.current.x
      const deltaY = clientY - dragStartPos.current.y

      setPosition({
        x: windowStartPos.current.x + deltaX,
        y: windowStartPos.current.y + deltaY,
      })
    }

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false)
        document.body.style.userSelect = ''
      }
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.addEventListener('touchmove', handleMouseMove, { passive: false })
      document.addEventListener('touchend', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('touchmove', handleMouseMove)
      document.removeEventListener('touchend', handleMouseUp)
    }
  }, [isDragging])

  return {
    position,
    isDragging,
    handleMouseDown
  }
}
