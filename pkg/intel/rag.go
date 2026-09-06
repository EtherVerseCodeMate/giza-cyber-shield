package intel

import (
	"embed"
	"fmt"
	"io/fs"
	"strings"
)

//go:embed docs/*.md
var ragDocs embed.FS

// LoadRAGDocs loads the embedded markdown files for RAG context.
func (kb *KnowledgeBase) LoadRAGDocs() string {
	var sb strings.Builder

	files, _ := fs.ReadDir(ragDocs, "docs")
	for _, file := range files {
		if strings.HasSuffix(file.Name(), ".md") {
			content, _ := ragDocs.ReadFile("docs/" + file.Name())
			fmt.Fprintf(&sb, "=== SOURCE: %s ===\n", file.Name())
			sb.Write(content)
			sb.WriteString("\n\n")
		}
	}
	return sb.String()
}
