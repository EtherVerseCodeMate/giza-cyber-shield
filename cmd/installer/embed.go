package main

import _ "embed"

// Payload binaries are populated by scripts/build-installer.ps1 before this
// package is compiled. Build order:
//  1. Build adinkhepra.exe, asaf-daemon.exe, adinkhepra-desktop.exe
//  2. Copy them into cmd/installer/payload/
//  3. go build ./cmd/installer  → picks them up here
//
// Stub check: if len(embeddedDesktop) < 10 KB, the installer detects a
// dev/stub build and skips binary extraction, showing a warning instead.

//go:embed payload/adinkhepra-desktop.exe
var embeddedDesktop []byte

//go:embed payload/adinkhepra.exe
var embeddedCLI []byte

//go:embed payload/asaf-daemon.exe
var embeddedDaemon []byte

//go:embed assets/EULA.txt
var eulaText string

//go:embed assets/icon.svg
var iconSVGBytes []byte
