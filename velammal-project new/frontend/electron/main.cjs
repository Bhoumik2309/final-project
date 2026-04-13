const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const http = require('http')
const { execSync } = require('child_process')

// Scanner module (Windows WIA)
let scannerModule = null
let server = null

// Check if running in development
const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production'

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
}

// Start local server for production
function startServer() {
  return new Promise((resolve, reject) => {
    const appPath = app.getAppPath()
    const distPath = path.join(appPath, 'dist')

    server = http.createServer((req, res) => {
      let filePath = req.url === '/' ? '/index.html' : req.url
      filePath = path.join(distPath, filePath)

      const ext = path.extname(filePath)
      const contentType = mimeTypes[ext] || 'application/octet-stream'

      fs.readFile(filePath, (err, data) => {
        if (err) {
          // Try index.html for SPA routing
          fs.readFile(path.join(distPath, 'index.html'), (err2, data2) => {
            if (err2) {
              res.writeHead(404)
              res.end('Not found')
            } else {
              res.writeHead(200, { 'Content-Type': 'text/html' })
              res.end(data2)
            }
          })
        } else {
          res.writeHead(200, { 'Content-Type': contentType })
          res.end(data)
        }
      })
    })

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      console.log('Server running on port:', port)
      resolve(port)
    })

    server.on('error', reject)
  })
}

function createWindow(port) {
  const iconPath = path.join(__dirname, '../dist/app-logo.png')

  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    show: false,
    backgroundColor: '#8B1A1A',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    icon: iconPath,
    title: 'ExamScan AI - Velammal Engineering College',
    autoHideMenuBar: true
  })

  // Show window immediately when ready - avoids white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadURL(`http://127.0.0.1:${port}`)
  }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription)
  })
}

// Initialize scanner module
function initScanner() {
  try {
    // Use PowerShell to interact with WIA on Windows
    return true
  } catch (err) {
    console.error('Scanner init error:', err)
    return false
  }
}

// Get list of scanners using PowerShell WIA
function getScanners() {
  try {
    // Write PowerShell script to temp file to avoid escaping issues
    const tempDir = app.getPath('temp')
    const scriptPath = path.join(tempDir, 'detect_scanner.ps1')
    
    const scriptContent = `
try {
    $deviceManager = New-Object -ComObject WIA.DeviceManager
    $scanners = @()
    foreach ($deviceInfo in $deviceManager.DeviceInfos) {
        if ($deviceInfo.Type -eq 1) {
            $scanners += @{
                id = $deviceInfo.DeviceID
                name = $deviceInfo.Properties.Item("Name").Value
            }
        }
    }
    if ($scanners.Count -eq 0) {
        Write-Output "[]"
    } elseif ($scanners.Count -eq 1) {
        Write-Output ("[" + ($scanners | ConvertTo-Json -Compress) + "]")
    } else {
        Write-Output ($scanners | ConvertTo-Json -Compress)
    }
} catch {
    Write-Output "[]"
}
`
    fs.writeFileSync(scriptPath, scriptContent, 'utf8')
    
    const result = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`, {
      encoding: 'utf8',
      timeout: 15000,
      windowsHide: true
    })
    
    // Clean up temp file
    try { fs.unlinkSync(scriptPath) } catch (e) {}
    
    const trimmed = result.trim()
    console.log('Scanner detection result:', trimmed)
    
    if (!trimmed || trimmed === '') {
      return []
    }
    
    const parsed = JSON.parse(trimmed)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch (err) {
    console.error('Get scanners error:', err.message)
    return []
  }
}

// Scan document using PowerShell WIA with compression
function scanDocument(scannerId = null) {
  try {
    const outputDir = app.getPath('temp')
    const tempFileName = `scan_temp_${Date.now()}.bmp`
    const tempPath = path.join(outputDir, tempFileName)
    const fileName = `scan_${Date.now()}.jpg`
    const outputPath = path.join(outputDir, fileName)

    // Write PowerShell script to scan and compress
    const scriptPath = path.join(outputDir, 'scan_document.ps1')
    const scriptContent = `
Add-Type -AssemblyName System.Drawing

try {
    # Scan document at lower DPI (150 instead of 200) to reduce file size
    $deviceManager = New-Object -ComObject WIA.DeviceManager
    $scanner = $null
    foreach ($deviceInfo in $deviceManager.DeviceInfos) {
        if ($deviceInfo.Type -eq 1) {
            try {
                # Set scanner properties for lower resolution
                $item = $deviceInfo.Connect().Items(1)

                # Try to set DPI to 150 (0x00060016 = DPI, 0x00060017 = horizontal DPI)
                try {
                    $item.Properties.Item("6016").Value = 150
                } catch {}

                $scanner = $deviceInfo.Connect()
            } catch {
                $scanner = $deviceInfo.Connect()
            }
            break
        }
    }

    if ($scanner -eq $null) {
        throw "No scanner found"
    }

    # Scan to BMP (faster than PNG)
    $item = $scanner.Items(1)
    $image = $item.Transfer("{B96B3CAF-0728-11D3-9D7B-0000F81EF32E}")
    $image.SaveFile("${tempPath.replace(/\\/g, '\\')}")

    # Load and compress to JPEG
    $bitmap = [System.Drawing.Image]::FromFile("${tempPath.replace(/\\/g, '\\')}")
    $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
    $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 75)

    $bitmap.Save("${outputPath.replace(/\\/g, '\\')}", $jpegCodec, $encoderParams)
    $bitmap.Dispose()

    # Clean up temp BMP
    Remove-Item "${tempPath.replace(/\\/g, '\\')}" -Force -ErrorAction SilentlyContinue

    Write-Output "${outputPath.replace(/\\/g, '\\')}"
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
`
    fs.writeFileSync(scriptPath, scriptContent, 'utf8')

    const result = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`, {
      encoding: 'utf8',
      timeout: 90000,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 50
    })

    // Clean up script file
    try { fs.unlinkSync(scriptPath) } catch (e) {}

    const scannedPath = result.trim()
    console.log('[Scanner] Scan successful (compressed):', scannedPath)

    // Verify file exists and check size
    if (fs.existsSync(scannedPath)) {
      const stats = fs.statSync(scannedPath)
      console.log(`[Scanner] File size: ${(stats.size / 1024 / 1024).toFixed(2)}MB`)
    }

    return {
      success: true,
      filePath: scannedPath,
      error: null
    }
  } catch (err) {
    let errorMsg = err.message || 'Unknown error'
    console.error('[Scanner] Scan error:', errorMsg)

    if (errorMsg.includes('0x80210006')) {
      errorMsg = 'Scanner is busy or paper not loaded'
    } else if (errorMsg.includes('0x80210001')) {
      errorMsg = 'Scanner not ready'
    } else if (errorMsg.includes('No scanner found')) {
      errorMsg = 'No scanner found. Please connect a scanner.'
    }

    return {
      success: false,
      filePath: null,
      error: errorMsg
    }
  }
}

// IPC Handlers
ipcMain.handle('scanner:check', async () => {
  const scanners = getScanners()
  return {
    available: scanners.length > 0,
    scanners: scanners
  }
})

ipcMain.handle('scanner:list', async () => {
  return getScanners()
})

ipcMain.handle('scanner:scan', async (event, options = {}) => {
  return scanDocument(options.scannerId)
})

ipcMain.handle('scanner:getFile', async (event, filePath) => {
  const fs = require('fs')
  try {
    const data = fs.readFileSync(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png'

    return {
      success: true,
      data: data.toString('base64'),
      mimeType: mimeType
    }
  } catch (err) {
    return {
      success: false,
      error: err.message
    }
  }
})

// App lifecycle
app.whenReady().then(async () => {
  let port = null
  if (!isDev) {
    port = await startServer()
  }
  initScanner()
  createWindow(port)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(port)
    }
  })
})

app.on('window-all-closed', () => {
  if (server) {
    server.close()
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
