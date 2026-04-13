// Compress image file to reduce size for upload
export const compressImage = async (file) => {
  return new Promise((resolve, reject) => {
    // If file is already small enough, skip compression
    if (file.size < 5 * 1024 * 1024) { // Less than 5MB
      resolve(file)
      return
    }

    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target.result
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxWidth = 2000
        const maxHeight = 2000
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height
            height = maxHeight
          }
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        // Export as JPEG with 75% quality
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File(
                [blob],
                file.name.replace(/\.[^.]+$/, '.jpg'),
                { type: 'image/jpeg' }
              )
              console.log(`[Compression] ${file.name}: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`)
              resolve(compressedFile)
            } else {
              resolve(file) // If compression fails, use original
            }
          },
          'image/jpeg',
          0.75
        )
      }
      img.onerror = () => resolve(file) // If image fails to load, use original
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
  })
}

// Compress multiple image files
export const compressImages = async (files) => {
  const compressedFiles = []
  for (const file of files) {
    try {
      const compressed = await compressImage(file)
      compressedFiles.push(compressed)
    } catch (err) {
      console.error('Compression error for', file.name, err)
      compressedFiles.push(file) // Use original if compression fails
    }
  }
  return compressedFiles
}
export const convertPdfToImages = async (pdfFile) => {
  // For PDF files, we'll pass them through as-is since the backend can handle them
  // Or convert first page to image preview
  return [pdfFile]
}

// Process uploaded scan files (images or PDFs)
export const processScannedFiles = async (files) => {
  const processedFiles = []
  
  for (const file of files) {
    if (file.type === 'application/pdf') {
      // Keep PDF as-is, backend will handle it
      processedFiles.push(file)
    } else if (file.type.startsWith('image/')) {
      processedFiles.push(file)
    }
  }
  
  return processedFiles
}

// Get scanner instructions based on OS
export const getScannerInstructions = () => {
  const isWindows = navigator.platform.includes('Win')
  const isMac = navigator.platform.includes('Mac')
  
  if (isWindows) {
    return {
      title: 'Windows Scan',
      steps: [
        'Open "Windows Scan" app (search in Start menu)',
        'Or use your scanner\'s app (HP Scan, Canon IJ Scan, etc.)',
        'Select your scanner and scan the document',
        'Save as PNG, JPG, or PDF',
        'Upload the saved file here'
      ],
      tip: 'Tip: Press Win + S and search "Scan" to find Windows Scan app'
    }
  } else if (isMac) {
    return {
      title: 'macOS Preview',
      steps: [
        'Open "Preview" app',
        'Go to File → Import from Scanner',
        'Select your scanner and scan',
        'Save as PNG, JPG, or PDF',
        'Upload the saved file here'
      ],
      tip: 'Tip: You can also use Image Capture app'
    }
  } else {
    return {
      title: 'Scanner App',
      steps: [
        'Open your scanner\'s companion app',
        'Scan the document',
        'Save as PNG, JPG, or PDF',
        'Upload the saved file here'
      ],
      tip: 'Most scanners come with a free scanning app'
    }
  }
}

// Supported file types for scanned documents
export const SUPPORTED_SCAN_TYPES = {
  accept: 'image/png,image/jpeg,image/jpg,image/tiff,application/pdf',
  extensions: ['.png', '.jpg', '.jpeg', '.tiff', '.pdf']
}

// Validate scanned file
export const validateScannedFile = (file) => {
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/tiff', 'application/pdf']
  const maxSize = 50 * 1024 * 1024 // 50MB
  
  if (!validTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Please upload PNG, JPG, TIFF, or PDF.' }
  }
  
  if (file.size > maxSize) {
    return { valid: false, error: 'File too large. Maximum size is 50MB.' }
  }
  
  return { valid: true }
}
