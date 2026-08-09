package theme

import (
	"os"
	"path/filepath"

	"fyne.io/fyne/v2"
)

var (
	headingFont fyne.Resource // Space Grotesk Variable
	monoFont    fyne.Resource // JetBrains Mono Regular
)

func init() {
	headingFont = loadFontFromDisk("SpaceGrotesk-Variable.ttf")
	monoFont = loadFontFromDisk("JetBrainsMono-Regular.ttf")
}

// loadFontFromDisk searches well-known paths for a font file.
// Returns nil on failure — the ASAFTheme falls back to Fyne's built-in font.
// Font search order:
//  1. fonts/ next to the running executable (production install)
//  2. assets/fonts/ next to the running executable
//  3. assets/fonts/ in the working directory (dev builds)
func loadFontFromDisk(name string) fyne.Resource {
	var paths []string

	if exe, err := os.Executable(); err == nil {
		dir := filepath.Dir(exe)
		paths = append(paths,
			filepath.Join(dir, "fonts", name),
			filepath.Join(dir, "assets", "fonts", name),
		)
	}

	cwd, _ := os.Getwd()
	paths = append(paths,
		filepath.Join(cwd, "assets", "fonts", name),
		filepath.Join(cwd, "fonts", name),
	)

	for _, p := range paths {
		data, err := os.ReadFile(p)
		if err == nil && len(data) > 1024 { // sanity check: real TTF is > 1 KB
			return &fyne.StaticResource{StaticName: name, StaticContent: data}
		}
	}
	return nil // theme.Font() will fall back to Fyne default
}
