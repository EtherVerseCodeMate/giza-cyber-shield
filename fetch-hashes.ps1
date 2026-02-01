$ProgressPreference = 'SilentlyContinue'
$resources = @(
    @{ name = "circl-v1.6.2.zip"; url = "https://proxy.golang.org/github.com/cloudflare/circl/@v/v1.6.2.zip" },
    @{ name = "gin-v1.10.0.zip"; url = "https://proxy.golang.org/github.com/gin-gonic/gin/@v/v1.10.0.zip" },
    @{ name = "uuid-v1.6.0.zip"; url = "https://proxy.golang.org/github.com/google/uuid/@v/v1.6.0.zip" },
    @{ name = "websocket-v1.5.3.zip"; url = "https://proxy.golang.org/github.com/gorilla/websocket/@v/v1.5.3.zip" },
    @{ name = "golang-crypto-v0.46.0.zip"; url = "https://proxy.golang.org/golang.org/x/crypto/@v/v0.46.0.zip" },
    @{ name = "golang-sys-v0.39.0.zip"; url = "https://proxy.golang.org/golang.org/x/sys/@v/v0.39.0.zip" },
    @{ name = "tailscale-v1.92.3.zip"; url = "https://proxy.golang.org/tailscale.com/@v/v1.92.3.zip" },
    @{ name = "excelize-v2.10.0.zip"; url = "https://proxy.golang.org/github.com/xuri/excelize/v2/@v/v2.10.0.zip" },
    @{ name = "fsnotify-v1.9.0.zip"; url = "https://proxy.golang.org/github.com/fsnotify/fsnotify/@v/v1.9.0.zip" },
    @{ name = "edkey-20170222072505-3356ea4e686a.zip"; url = "https://proxy.golang.org/github.com/mikesmitty/edkey/@v/v0.0.0-20170222072505-3356ea4e686a.zip" }
)

Write-Host "Fetching SHA256 hashes (Fast Mode)..."
foreach ($res in $resources) {
    $file = "tempzip.zip"
    try {
        Start-BitsTransfer -Source $res.url -Destination $file
        $h = (Get-FileHash -Path $file -Algorithm SHA256).Hash.ToLower()
        Write-Host "$($res.name) : $h"
        Remove-Item $file
    }
    catch {
        # Fallback to Invoke-WebRequest if BITS fails
        try {
            Invoke-WebRequest -Uri $res.url -OutFile $file -ErrorAction Stop
            $h = (Get-FileHash -Path $file -Algorithm SHA256).Hash.ToLower()
            Write-Host "$($res.name) : $h"
            Remove-Item $file
        }
        catch {
            Write-Host "$($res.name) : FAILED"
        }
    }
}
