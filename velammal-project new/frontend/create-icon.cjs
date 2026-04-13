const fs = require('fs')
const path = require('path')

// Read PNG file
const pngPath = path.join(__dirname, 'public', 'app-logo.png')
const icoPath = path.join(__dirname, 'public', 'app-icon.ico')

const pngBuffer = fs.readFileSync(pngPath)
const pngSize = pngBuffer.length

// ICO format: ICONDIR + ICONDIRENTRY + PNG data
// We embed the PNG directly into ICO (works for 256x256)
const headerSize = 6
const entrySize = 16
const dataOffset = headerSize + entrySize

// ICONDIR header
const iconDir = Buffer.alloc(6)
iconDir.writeUInt16LE(0, 0)       // Reserved
iconDir.writeUInt16LE(1, 2)       // Type: 1 = ICO
iconDir.writeUInt16LE(1, 4)       // Count: 1 image

// ICONDIRENTRY
const entry = Buffer.alloc(16)
entry.writeUInt8(0, 0)            // Width (0 = 256)
entry.writeUInt8(0, 1)            // Height (0 = 256)
entry.writeUInt8(0, 2)            // Color count (0 = no palette)
entry.writeUInt8(0, 3)            // Reserved
entry.writeUInt16LE(1, 4)         // Planes
entry.writeUInt16LE(32, 6)        // Bit count
entry.writeUInt32LE(pngSize, 8)   // Image data size
entry.writeUInt32LE(dataOffset, 12) // Offset to image data

const icoBuffer = Buffer.concat([iconDir, entry, pngBuffer])
fs.writeFileSync(icoPath, icoBuffer)
console.log('ICO created:', icoPath)
