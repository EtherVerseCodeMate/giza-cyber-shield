// Package widgets provides the AdinKhepra ASAF Fyne UI widget library.
//
// §10 rule enforced throughout: no Sephirot / Merkaba / Hypercube state_code
// integers ever appear in rendered widget text, tooltips, or status labels.
// Sacred Geometry vocabulary is confined to Go identifiers and code comments only.
package widgets

import (
	"image/color"
	"math"
	"sync"
	"sync/atomic"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/widget"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/app/models"
	asaftheme "github.com/EtherVerseCodeMate/giza-cyber-shield/app/theme"
)

// Physics constants for the force-directed layout engine.
const (
	physRepulsion  = float64(18000)
	physSpring     = float64(0.006)
	physRestLen    = float64(160)
	physDamping    = float64(0.82)
	physMaxVel     = float64(22)
	physGravity    = float64(0.001)
	physSteps      = int32(800)
	physTickMillis = 16
)

// Pool sizes pre-allocated to avoid per-frame heap allocations.
// Covers Pilot (≤50 assets), Program (≤500), and aggregated Enterprise views.
const (
	maxPoolEdges = 600
	maxPoolNodes = 300
)

// (physics state is models.PhysicsState — see app/models/compliance_model.go)

// GraphCanvas is the force-directed compliance graph widget.
// Physics runs in a dedicated goroutine; rendering runs on the Fyne main thread.
// Thread safety: model is accessed via its own RWMutex; pan/zoom/selection are
// guarded by the canvas-local mu.
type GraphCanvas struct {
	widget.BaseWidget

	model *models.ComplianceGraphModel

	mu         sync.RWMutex
	panX, panY float32
	zoom       float32
	animTick   uint64
	selectedID string

	stepsLeft int32 // atomic: physics steps remaining

	// OnNodeSelect is invoked on the Fyne main thread when the user taps a node.
	// Receives nil to signal deselect (tap on empty canvas).
	OnNodeSelect func(*models.GraphNode)

	// Context menu callbacks — wired by the parent tab view.
	// Nil callbacks silently no-op; each action is optional.
	OnStageFix        func(nodeID string)
	OnOpenPOAM        func(nodeID string)
	OnViewInSSP       func(nodeID string)
	OnImportForFamily func(familyName string)
	OnRescanHost      func(nodeID string)
}

// NewGraphCanvas creates and initialises the compliance graph widget.
func NewGraphCanvas(m *models.ComplianceGraphModel) *GraphCanvas {
	g := &GraphCanvas{
		model: m,
		zoom:  1.0,
	}
	g.ExtendBaseWidget(g)
	g.startPhysics()
	return g
}

// TriggerLayout restarts the physics engine for a full layout pass.
// Call this after adding new nodes to the model.
func (g *GraphCanvas) TriggerLayout() {
	atomic.StoreInt32(&g.stepsLeft, physSteps)
}

// CreateRenderer satisfies fyne.Widget.
func (g *GraphCanvas) CreateRenderer() fyne.WidgetRenderer {
	r := &graphRenderer{parent: g}
	r.init()
	return r
}

// MinSize satisfies fyne.Widget.
func (g *GraphCanvas) MinSize() fyne.Size { return fyne.NewSize(400, 300) }

// hitTest converts a screen position to graph space and returns the nearest node
// within tap radius, or nil if no node is hit.  The model RLock is acquired and
// released inside this call — callers must not hold the model lock.
func (g *GraphCanvas) hitTest(pos fyne.Position) *models.GraphNode {
	size := g.Size()
	cx, cy := size.Width/2, size.Height/2

	g.mu.RLock()
	z := g.zoom
	px, py := g.panX, g.panY
	g.mu.RUnlock()

	gx := float32(float64(pos.X-cx)/float64(z) + float64(px))
	gy := float32(float64(pos.Y-cy)/float64(z) + float64(py))

	g.model.RLock()
	defer g.model.RUnlock()
	var hit *models.GraphNode
	hitDist := float32(math.MaxFloat32)
	for _, n := range g.model.Nodes {
		dx := n.X - gx
		dy := n.Y - gy
		dist := float32(math.Sqrt(float64(dx*dx + dy*dy)))
		if dist <= n.Radius+8 && dist < hitDist {
			hitDist = dist
			hit = n
		}
	}
	return hit
}

// Tapped satisfies fyne.Tappable — left-click selects a node.
func (g *GraphCanvas) Tapped(ev *fyne.PointEvent) {
	hit := g.hitTest(ev.Position)
	g.mu.Lock()
	if hit != nil {
		g.selectedID = hit.ID
	} else {
		g.selectedID = ""
	}
	g.mu.Unlock()
	if g.OnNodeSelect != nil {
		g.OnNodeSelect(hit)
	}
	canvas.Refresh(g)
}

// TappedSecondary satisfies fyne.SecondaryTappable — right-click shows a
// contextual action menu relevant to the node type.
func (g *GraphCanvas) TappedSecondary(ev *fyne.PointEvent) {
	node := g.hitTest(ev.Position)
	if node == nil {
		return
	}

	// Select the node so the sidebar reflects the right-click target.
	g.mu.Lock()
	g.selectedID = node.ID
	g.mu.Unlock()
	if g.OnNodeSelect != nil {
		g.OnNodeSelect(node)
	}

	// Capture stable copies of node fields before the model can mutate.
	nodeID := node.ID
	nodeKind := node.Kind
	nodeStatus := node.Status
	stigFamily := node.STIGFamily

	items := []*fyne.MenuItem{
		fyne.NewMenuItem("Inspect", func() {
			if g.OnNodeSelect != nil {
				g.OnNodeSelect(node)
			}
		}),
	}

	switch nodeKind {
	case models.NodeTiphereth: // Finding node
		items = append(items, fyne.NewMenuItemSeparator())
		if nodeStatus == models.StatusNotMet {
			items = append(items, fyne.NewMenuItem("Stage Fix", func() {
				if g.OnStageFix != nil {
					g.OnStageFix(nodeID)
				}
			}))
		}
		items = append(items, fyne.NewMenuItem("Open POA&M", func() {
			if g.OnOpenPOAM != nil {
				g.OnOpenPOAM(nodeID)
			}
		}))
		items = append(items, fyne.NewMenuItem("View in SSP", func() {
			if g.OnViewInSSP != nil {
				g.OnViewInSSP(nodeID)
			}
		}))

	case models.NodeChokmah: // STIG family aggregate node
		items = append(items, fyne.NewMenuItemSeparator())
		items = append(items, fyne.NewMenuItem("Import Checklist for This Family", func() {
			if g.OnImportForFamily != nil {
				g.OnImportForFamily(stigFamily)
			}
		}))

	case models.NodeChesed: // Asset node
		items = append(items, fyne.NewMenuItemSeparator())
		items = append(items, fyne.NewMenuItem("Re-scan Host", func() {
			if g.OnRescanHost != nil {
				g.OnRescanHost(nodeID)
			}
		}))

	default: // Domain, Practice, etc.
		items = append(items, fyne.NewMenuItemSeparator())
		items = append(items, fyne.NewMenuItem("View in SSP", func() {
			if g.OnViewInSSP != nil {
				g.OnViewInSSP(nodeID)
			}
		}))
		items = append(items, fyne.NewMenuItem("Open POA&M", func() {
			if g.OnOpenPOAM != nil {
				g.OnOpenPOAM(nodeID)
			}
		}))
	}

	menu := fyne.NewMenu("", items...)
	c := fyne.CurrentApp().Driver().CanvasForObject(g)
	if c != nil {
		widget.ShowPopUpMenuAtPosition(menu, c, ev.AbsolutePosition)
	}
}

// Scrolled implements fyne.Scrollable — mouse wheel / trackpad scroll → zoom.
// Scroll up (negative DY) zooms in; scroll down (positive DY) zooms out.
func (g *GraphCanvas) Scrolled(ev *fyne.ScrollEvent) {
	factor := float32(math.Exp(float64(-ev.Scrolled.DY) * 0.008))
	g.mu.Lock()
	g.zoom *= factor
	if g.zoom < 0.05 {
		g.zoom = 0.05
	}
	if g.zoom > 20 {
		g.zoom = 20
	}
	g.mu.Unlock()
	canvas.Refresh(g)
}

// Dragged implements fyne.Draggable — click-drag pans the viewport.
func (g *GraphCanvas) Dragged(ev *fyne.DragEvent) {
	g.mu.Lock()
	z := g.zoom
	g.panX -= ev.Dragged.DX / z
	g.panY -= ev.Dragged.DY / z
	g.mu.Unlock()
	canvas.Refresh(g)
}

// DragEnd satisfies fyne.Draggable.
func (g *GraphCanvas) DragEnd() {}

// startPhysics launches the background physics+animation goroutine.
func (g *GraphCanvas) startPhysics() {
	atomic.StoreInt32(&g.stepsLeft, physSteps)
	go func() {
		ticker := time.NewTicker(physTickMillis * time.Millisecond)
		defer ticker.Stop()
		for range ticker.C {
			if atomic.LoadInt32(&g.stepsLeft) > 0 {
				g.stepPhysics()
				atomic.AddInt32(&g.stepsLeft, -1)
			}
			g.mu.Lock()
			g.animTick++
			g.mu.Unlock()
			fyne.Do(func() { canvas.Refresh(g) })
		}
	}()
}

// stepPhysics executes one force-directed physics step.
//
// Thread safety pattern (avoids double-lock deadlock):
//   1. Call model.Snapshot() — acquires + releases one read lock, returns copies
//   2. Compute forces on local data (no lock held)
//   3. Call model.ApplyPhysics() — acquires + releases one write lock
func (g *GraphCanvas) stepPhysics() {
	snap, edges := g.model.Snapshot()

	idxByID := make(map[string]int, len(snap))
	for i, s := range snap {
		idxByID[s.ID] = i
	}

	type vec2 struct{ x, y float64 }
	forces := make([]vec2, len(snap))

	// Repulsion between every pair of nodes
	for i := 0; i < len(snap); i++ {
		for j := i + 1; j < len(snap); j++ {
			dx := snap[j].X - snap[i].X
			dy := snap[j].Y - snap[i].Y
			d2 := dx*dx + dy*dy
			if d2 < 1 {
				d2 = 1
			}
			d := math.Sqrt(d2)
			mag := physRepulsion / d2
			ux, uy := dx/d, dy/d
			forces[i].x -= mag * ux
			forces[i].y -= mag * uy
			forces[j].x += mag * ux
			forces[j].y += mag * uy
		}
	}

	// Spring attraction along edges
	for _, e := range edges {
		fi, ok1 := idxByID[e[0]]
		ti, ok2 := idxByID[e[1]]
		if !ok1 || !ok2 {
			continue
		}
		dx := snap[ti].X - snap[fi].X
		dy := snap[ti].Y - snap[fi].Y
		d := math.Sqrt(dx*dx + dy*dy)
		if d < 1 {
			d = 1
		}
		mag := physSpring * (d - physRestLen)
		ux, uy := dx/d, dy/d
		forces[fi].x += mag * ux
		forces[fi].y += mag * uy
		forces[ti].x -= mag * ux
		forces[ti].y -= mag * uy
	}

	// Velocity and position integration
	for i := range snap {
		if snap[i].Pinned {
			continue
		}
		snap[i].VX = (snap[i].VX + forces[i].x - physGravity*snap[i].X) * physDamping
		snap[i].VY = (snap[i].VY + forces[i].y - physGravity*snap[i].Y) * physDamping
		clamp := func(v float64) float64 {
			if v > physMaxVel {
				return physMaxVel
			}
			if v < -physMaxVel {
				return -physMaxVel
			}
			return v
		}
		snap[i].VX = clamp(snap[i].VX)
		snap[i].VY = clamp(snap[i].VY)
		snap[i].X += snap[i].VX
		snap[i].Y += snap[i].VY
	}

	g.model.ApplyPhysics(snap)
}

// graphRenderer is the Fyne WidgetRenderer for GraphCanvas.
// Owns a fixed-size object pool — no per-frame allocation.
type graphRenderer struct {
	parent *GraphCanvas

	edgeLines  [maxPoolEdges]*canvas.Line
	nodeCircs  [maxPoolNodes]*canvas.Circle
	nodeTxts   [maxPoolNodes]*canvas.Text
	selRing    *canvas.Circle

	allObjs []fyne.CanvasObject
}

// init pre-allocates all canvas objects and builds the flat objects slice.
func (r *graphRenderer) init() {
	cap := maxPoolEdges + maxPoolNodes*2 + 1
	r.allObjs = make([]fyne.CanvasObject, 0, cap)

	for i := range r.edgeLines {
		l := canvas.NewLine(color.Transparent)
		l.StrokeWidth = 1
		r.edgeLines[i] = l
		r.allObjs = append(r.allObjs, l)
	}
	for i := range r.nodeCircs {
		c := &canvas.Circle{FillColor: color.Transparent, StrokeColor: color.Transparent, StrokeWidth: 2}
		r.nodeCircs[i] = c
		r.allObjs = append(r.allObjs, c)
	}
	r.selRing = &canvas.Circle{FillColor: color.Transparent, StrokeColor: color.Transparent, StrokeWidth: 3}
	r.allObjs = append(r.allObjs, r.selRing)

	for i := range r.nodeTxts {
		t := &canvas.Text{Text: "", Color: color.Transparent, TextSize: 10}
		r.nodeTxts[i] = t
		r.allObjs = append(r.allObjs, t)
	}
}

func (r *graphRenderer) Layout(_ fyne.Size) { r.Refresh() }
func (r *graphRenderer) MinSize() fyne.Size  { return r.parent.MinSize() }
func (r *graphRenderer) Objects() []fyne.CanvasObject { return r.allObjs }
func (r *graphRenderer) Destroy()                     {}

// Refresh updates all canvas objects from current model state.
// Runs on the Fyne main thread.
func (r *graphRenderer) Refresh() {
	size := r.parent.Size()
	if size.Width <= 0 || size.Height <= 0 {
		return
	}

	r.parent.mu.RLock()
	z := r.parent.zoom
	px := r.parent.panX
	py := r.parent.panY
	frame := r.parent.animTick
	selID := r.parent.selectedID
	r.parent.mu.RUnlock()

	cx, cy := size.Width/2, size.Height/2

	toScreen := func(gx, gy float32) (float32, float32) {
		return cx + (gx-px)*z, cy + (gy-py)*z
	}

	r.parent.model.RLock()
	nodes := r.parent.model.Nodes
	edges := r.parent.model.EdgesSnapshot()
	r.parent.model.RUnlock()

	// Build index for edge resolution
	idxByID := make(map[string]int, len(nodes))
	for i, n := range nodes {
		idxByID[n.ID] = i
	}

	// --- Edges ---
	for i := range r.edgeLines {
		if i >= len(edges) {
			r.edgeLines[i].StrokeColor = color.Transparent
			continue
		}
		e := edges[i]
		fi, ok1 := idxByID[e[0]]
		ti, ok2 := idxByID[e[1]]
		if !ok1 || !ok2 {
			r.edgeLines[i].StrokeColor = color.Transparent
			continue
		}
		fn, tn := nodes[fi], nodes[ti]
		sx1, sy1 := toScreen(fn.X, fn.Y)
		sx2, sy2 := toScreen(tn.X, tn.Y)
		r.edgeLines[i].Position1 = fyne.NewPos(sx1, sy1)
		r.edgeLines[i].Position2 = fyne.NewPos(sx2, sy2)
		r.edgeLines[i].StrokeColor = glEdgeColor(fn, tn)
		r.edgeLines[i].StrokeWidth = glEdgeWidth(fn, tn)
	}

	// --- Nodes (circles) ---
	for i := range r.nodeCircs {
		if i >= len(nodes) {
			r.nodeCircs[i].FillColor = color.Transparent
			r.nodeCircs[i].StrokeColor = color.Transparent
			continue
		}
		n := nodes[i]
		sx, sy := toScreen(n.X, n.Y)
		rad := n.Radius * z
		r.nodeCircs[i].Position1 = fyne.NewPos(sx-rad, sy-rad)
		r.nodeCircs[i].Position2 = fyne.NewPos(sx+rad, sy+rad)
		r.nodeCircs[i].FillColor = glNodeFill(n, frame)
		r.nodeCircs[i].StrokeColor = glNodeStroke(n)
		r.nodeCircs[i].StrokeWidth = glNodeStrokeW(n)
	}

	// --- Labels ---
	for i := range r.nodeTxts {
		if i >= len(nodes) {
			r.nodeTxts[i].Text = ""
			r.nodeTxts[i].Color = color.Transparent
			continue
		}
		n := nodes[i]
		sx, sy := toScreen(n.X, n.Y)
		r.nodeTxts[i].Text = glLabel(n, z)
		r.nodeTxts[i].Color = glLabelColor(n)
		r.nodeTxts[i].TextSize = glLabelSize(n, z)
		r.nodeTxts[i].Move(fyne.NewPos(sx-60, sy+n.Radius*z+2))
		r.nodeTxts[i].Resize(fyne.NewSize(120, 18))
	}

	// --- Selection ring ---
	if selID != "" {
		if idx, ok := idxByID[selID]; ok && idx < len(nodes) {
			sn := nodes[idx]
			sx, sy := toScreen(sn.X, sn.Y)
			rad := (sn.Radius + 6) * z
			r.selRing.Position1 = fyne.NewPos(sx-rad, sy-rad)
			r.selRing.Position2 = fyne.NewPos(sx+rad, sy+rad)
			r.selRing.StrokeColor = asaftheme.AKGold
			r.selRing.StrokeWidth = 3
		}
	} else {
		r.selRing.StrokeColor = color.Transparent
	}
}

// --- Visual helper functions (§10: no Sephirot strings in return values) ---

func glNodeFill(n *models.GraphNode, frame uint64) color.Color {
	switch n.Glow {
	case models.GlowGreen:
		return asaftheme.NodeGreen
	case models.GlowRedFast:
		a := uint8(170 + int(55*math.Abs(math.Sin(float64(frame)*0.22))))
		return color.NRGBA{R: 0xcc, G: 0x2a, B: 0x36, A: a}
	case models.GlowOrangeSlow:
		a := uint8(155 + int(65*math.Abs(math.Sin(float64(frame)*0.09))))
		return color.NRGBA{R: 0xf9, G: 0x73, B: 0x16, A: a}
	case models.GlowYellow:
		return asaftheme.NodeYellow
	case models.GlowWhite:
		return color.NRGBA{R: 0xff, G: 0xff, B: 0xff, A: 0xcc}
	case models.GlowBlueOutline:
		return color.NRGBA{R: 0x1a, G: 0x9f, B: 0xe8, A: 0x55}
	case models.GlowRoot:
		return asaftheme.NXBlue
	default:
		return asaftheme.NodeGray
	}
}

func glNodeStroke(n *models.GraphNode) color.Color {
	switch n.Glow {
	case models.GlowBlueOutline:
		return asaftheme.NXBlue
	case models.GlowWhite:
		return color.White
	case models.GlowRoot:
		return asaftheme.AKGold
	case models.GlowGreen:
		return color.NRGBA{R: 0x16, G: 0xa3, B: 0x4a, A: 0xff}
	case models.GlowRedFast:
		return color.NRGBA{R: 0xff, G: 0x45, B: 0x50, A: 0xff}
	case models.GlowOrangeSlow:
		return color.NRGBA{R: 0xff, G: 0x8c, B: 0x00, A: 0xff}
	default:
		return color.NRGBA{R: 0x3d, G: 0x5a, B: 0x78, A: 0xff}
	}
}

func glNodeStrokeW(n *models.GraphNode) float32 {
	switch n.Kind {
	case models.NodeKeter:
		return 3
	case models.NodeChokmah:
		return 2
	default:
		return 1.5
	}
}

func glEdgeColor(from, to *models.GraphNode) color.Color {
	if from.Glow == models.GlowRedFast || to.Glow == models.GlowRedFast {
		return color.NRGBA{R: 0xcc, G: 0x2a, B: 0x36, A: 0x66}
	}
	if from.Glow == models.GlowOrangeSlow || to.Glow == models.GlowOrangeSlow {
		return color.NRGBA{R: 0xf9, G: 0x73, B: 0x16, A: 0x55}
	}
	return color.NRGBA{R: 0x1a, G: 0x2e, B: 0x46, A: 0xcc}
}

func glEdgeWidth(from, to *models.GraphNode) float32 {
	if from.Kind == models.NodeKeter || to.Kind == models.NodeKeter {
		return 1.5
	}
	return 1
}

// glLabel returns the user-facing label text per §10.
// Domain code abbreviations ("AC", "AT", …) are not Sephirot vocabulary
// and may be displayed directly.
func glLabel(n *models.GraphNode, zoom float32) string {
	if zoom < 0.5 {
		return ""
	}
	switch n.Kind {
	case models.NodeKeter:
		return "Governance Root" // §10
	case models.NodeChokmah:
		return n.DomainCode
	case models.NodeTiphereth:
		id := n.FindingID
		if len(id) > 18 {
			id = id[:18] + "…"
		}
		return id
	case models.NodeChesed:
		return n.Hostname
	}
	return ""
}

func glLabelColor(n *models.GraphNode) color.Color {
	switch n.Kind {
	case models.NodeKeter:
		return asaftheme.AKGold
	case models.NodeChokmah:
		return asaftheme.TextPrimary
	case models.NodeTiphereth:
		if n.Glow == models.GlowRedFast {
			return asaftheme.NodeRed
		}
		return asaftheme.TextMuted
	}
	return asaftheme.TextMuted
}

func glLabelSize(n *models.GraphNode, zoom float32) float32 {
	base := float32(10)
	if n.Kind == models.NodeKeter || n.Kind == models.NodeChokmah {
		base = 11
	}
	s := base * zoom
	if s < 8 {
		return 8
	}
	if s > 14 {
		return 14
	}
	return s
}
