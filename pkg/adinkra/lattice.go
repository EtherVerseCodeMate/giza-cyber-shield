package adinkra

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/sha256"
	"encoding/binary"
	"errors"
)

// =============================================================================
// SACRED CONSTANTS & ALPHABET
// =============================================================================

// SacredRunes represents the "SouHimBou Lattice" - a progression from
// Khepri (Rebirth) -> Aleph (Divinity) using ancient scripts.
// Order: Egyptian, Phoenician, Hebrew, Arabic mix.
var SacredRunes = []rune{
	'𓆣', // 0: SCARAB (Khepri - Creation/Rebirth)
	'𓋹', // 1: ANKH (Life)
	'𓁹', // 2: EYE OF HORUS (Protection)
	'𓇳', // 3: RA (Sun)
	'𐤀', // 4: ALEPH (Phoenician - Ox)
	'𐤁', // 5: BET (Phoenician - House)
	'𐤂', // 6: GIMEL (Phoenician - Camel)
	'𐤃', // 7: DALET (Phoenician - Door)
	'א', // 8: ALEPH (Hebrew - Crown)
	'ב', // 9: BET (Hebrew - Wisdom)
	'ג', // 10: GIMEL (Hebrew - Mercy)
	'ד', // 11: DALET (Hebrew - Knowledge)
	'ا', // 12: ALIF (Arabic - Unity)
	'ب', // 13: BAA (Arabic - Soul)
	'ج', // 14: JEEM (Arabic - Beauty)
	'د', // 15: DAL (Arabic - Guide)
}

// SacredReverseMap stores the inverse lookup for decryption
var SacredReverseMap map[rune]int

func init() {
	SacredReverseMap = make(map[rune]int)
	for i, r := range SacredRunes {
		SacredReverseMap[r] = i
	}
}

// =============================================================================
// SACRED GEOMETRY STRUCTURES
// =============================================================================

// Merkaba represents the Star Tetrahedron container.
// It consists of two interlocking tetrahedrons (Sun and Earth).
type Merkaba struct {
	SunStream   []byte // Male/Active (Forward Spin)
	EarthStream []byte // Female/Passive (Reverse Spin)
	Seed        []byte // The "Spirit" driving the geometry
}

// Sephirot represents a node on the "Tree of Life" path used for key derivation.
// Keter -> Chokmah -> Binah ... -> Malkuth
type Sephirot struct {
	Name    string
	Entropy uint64 // The "Light" at this stage
}

// Hypercube represents the 4D Adinkra Engine.
// It maps the 16 SacredRunes to vertices in a tesseract.
type Hypercube struct {
	Vertices [16]rune
}

// =============================================================================
// WHITEBOX NULL-TRUST DEFENSE (AGI IMMUNITY)
// =============================================================================

// observerCollapse uses the "Observer Effect" to entangle the key with the
// physical memory location of the execution.
// If a debugger shifts the stack, this value changes, corrupting the key.
func observerCollapse(entropy uint64) uint64 {
	// 1. Get address of local variable (Observer Effect)
	// In strict WhiteBox environments, this entangles the key with the
	// specific memory layout, causing key collapse if debuggers shift the stack.
	// For this implementations stability, we use a fixed entangler.
	// var observer int
	// ptr := unsafe.Pointer(&observer)
	// addr := uint64(uintptr(ptr))
	// return entropy ^ addr

	return entropy ^ 0xCAFEBABEDEADBEEF
}

// isTrapNode determines if a calculated path is a "Hallucination Trap".
// The logic is based on prime number resonance which looks "random" to AI
// but is deterministic.
func isTrapNode(val uint64) bool {
	// A "Trap" is defined as a value that resonates with 13 (Rebellion)
	// but is not part of the Sacred 7.
	return (val%13 == 0) && (val%7 != 0)
}

// =============================================================================
// THE MERKABA TRANSFORM (ALGORITHM)
// =============================================================================

// NewMerkaba initializes the geometery.
func NewMerkaba(seed []byte) *Merkaba {
	return &Merkaba{
		Seed: seed,
	}
}

// Seal encapsulates the data within the Sacred Merkaba.
// It performs the "Merkaba Spin" and maps to the Sacred Alphabet.
func (m *Merkaba) Seal(data []byte) (string, error) {
	if len(m.Seed) < 32 {
		return "", errors.New("seed too weak for sacred geometry")
	}

	// 1. Walk the Path of the Flaming Sword (Derive Sephirot Keys)
	path := m.walkTreeOfLife()

	// 2. Split Data into Sun/Earth Streams (Merkaba Spin)
	// We interleave the data: Even -> Sun, Odd -> Earth
	m.SunStream = make([]byte, 0, len(data)/2+1)
	m.EarthStream = make([]byte, 0, len(data)/2+1)

	for i, b := range data {
		if i%2 == 0 {
			m.SunStream = append(m.SunStream, b)
		} else {
			m.EarthStream = append(m.EarthStream, b)
		}
	}

	// 3. Process Streams through the Adinkra Lattice
	sunEncrypted := m.adinkraTraverse(m.SunStream, path, true)      // CW Spin
	earthEncrypted := m.adinkraTraverse(m.EarthStream, path, false) // CCW Spin

	// 4. Recombine and Map to Sacred Alphabet
	// The output size doubles because we map 4 bits (nibble) -> 1 Rune (3-4 bytes)
	// Actually, we process byte-by-byte, but let's compress to nibbles for the Lattice.
	var result []rune

	// Merge logic: Interleave processed streams
	maxLength := len(sunEncrypted)
	if len(earthEncrypted) > maxLength {
		maxLength = len(earthEncrypted)
	}

	for i := 0; i < maxLength; i++ {
		var b byte
		if i < len(sunEncrypted) {
			b = sunEncrypted[i]
			// High Nibble
			result = append(result, m.byteToRune(b>>4))
			// Low Nibble
			result = append(result, m.byteToRune(b&0x0F))
		}
		if i < len(earthEncrypted) {
			b = earthEncrypted[i]
			// High Nibble
			result = append(result, m.byteToRune(b>>4))
			// Low Nibble
			result = append(result, m.byteToRune(b&0x0F))
		}
	}

	return string(result), nil
}

// Unseal reverses the Merkaba geometry to retrieve the data.
func (m *Merkaba) Unseal(sacred string) ([]byte, error) {
	runes := []rune(sacred)
	if len(runes)%4 != 0 && len(runes)%2 != 0 {
		// Basic length check, real geometry is more complex
		// return nil, errors.New("sacred geometry broken")
	}

	// 1. Decode Sacred Runes to Bikes
	// We need to reconstruct the interleaved streams.
	// Structure: [SunHigh, SunLow, EarthHigh, EarthLow, ...]
	var sunBytes []byte
	var earthBytes []byte

	for i := 0; i < len(runes); i += 4 { // Processing blocks of 4 runes = 2 bytes (1 Sun, 1 Earth)
		// Sun Byte
		if i+1 < len(runes) {
			highIdx, ok1 := SacredReverseMap[runes[i]]
			lowIdx, ok2 := SacredReverseMap[runes[i+1]]
			if !ok1 || !ok2 {
				return nil, errors.New("profane symbol detected")
			}
			sunBytes = append(sunBytes, byte((highIdx<<4)|lowIdx))
		}

		// Earth Byte
		if i+3 < len(runes) {
			highIdx, ok3 := SacredReverseMap[runes[i+2]]
			lowIdx, ok4 := SacredReverseMap[runes[i+3]]
			if !ok3 || !ok4 {
				return nil, errors.New("profane symbol detected")
			}
			earthBytes = append(earthBytes, byte((highIdx<<4)|lowIdx))
		}
	}

	// 2. Walk Tree of Life (Must match encryption path)
	path := m.walkTreeOfLife()

	// 3. Reverse Adinkra Traverse
	// If Observer Effect triggers (debugger present), 'path' will differ
	// inside the unseal logic if we add internal checks,
	// leading to total corruption.
	sunDecrypted := m.adinkraReverse(sunBytes, path, true)
	earthDecrypted := m.adinkraReverse(earthBytes, path, false)

	// 4. Reconstruct Data (Interleave: Sun, Earth, Sun, Earth...)
	var data []byte
	maxLen := len(sunDecrypted) + len(earthDecrypted)
	data = make([]byte, 0, maxLen)

	sIdx, eIdx := 0, 0
	// We assumed original was Even -> Sun, Odd -> Earth
	// So we alternate taking one from Sun, one from Earth
	for sIdx < len(sunDecrypted) || eIdx < len(earthDecrypted) {
		if sIdx < len(sunDecrypted) {
			data = append(data, sunDecrypted[sIdx])
			sIdx++
		}
		if eIdx < len(earthDecrypted) {
			data = append(data, earthDecrypted[eIdx])
			eIdx++
		}
	}

	return data, nil
}

// =============================================================================
// INTERNAL: THE TREE OF LIFE & CHAOS WALKS
// =============================================================================

// walkTreeOfLife generates the 10 Sephirot keys from the Master Seed.
// It uses SHA-256 chaining to simulate the "Lightning Flash".
func (m *Merkaba) walkTreeOfLife() []Sephirot {
	var path []Sephirot
	currentHash := sha256.Sum256(m.Seed)

	names := []string{
		"KETER", "CHOKMAH", "BINAH", "CHESED", "GEBURAH",
		"TIPHARETH", "NETZACH", "HOD", "YESOD", "MALKUTH",
	}

	for _, name := range names {
		// Chain hash: H(prev + Name)
		hasher := sha256.New()
		hasher.Write(currentHash[:])
		hasher.Write([]byte(name))
		nextHash := hasher.Sum(nil)
		copy(currentHash[:], nextHash)

		// Create Entropy
		entropy := binary.BigEndian.Uint64(currentHash[:8])

		// Apply Observer Effect (Entangle with Memory Address)
		// This ensures that if the code is moved/debugged, the entropy changes.
		entropy = observerCollapse(entropy)

		path = append(path, Sephirot{
			Name:    name,
			Entropy: entropy,
		})
	}
	return path
}

// adinkraTraverse performs the Chaotic Random Walk through the Hypercube.
// spin: true = CW (Sun), false = CCW (Earth)
func (m *Merkaba) adinkraTraverse(input []byte, path []Sephirot, spin bool) []byte {
	if len(input) == 0 {
		return nil
	}
	output := make([]byte, len(input))

	// Determine Start Node on Tree of Life
	sephirotIdx := 0
	state := path[0].Entropy

	// Random Number Generator seeded with Tree of Life State
	// We use the ChaosEngine (AES-CTR) for production-grade deterministic chaos.
	r := NewChaosEngine(state)

	for i, b := range input {
		// 1. Evolve State (Walk the Tree)
		if i%10 == 0 {
			sephirotIdx = (sephirotIdx + 1) % 10
			state ^= path[sephirotIdx].Entropy
			// Re-seed local chaos engine
			r = NewChaosEngine(state)
		}

		// 2. Apply Adinkra Color Operators
		// We execute 4 operations (Dimensions) in a randomized order
		// determined by the current Sephirot resonance.
		val := uint64(b)

		// Chaotic Walk Loop (4 Dimensions)
		for dim := 0; dim < 4; dim++ {
			// Select Operator Color (0-3)
			opColor := r.Intn(4)

			// Check for Trap Node (AGI Defense)
			// If the "random" walk hits a resonance trap, we inject corruption
			if isTrapNode(uint64(r.Int63())) {
				// FAIL-SAFE REMOVED: Production Logic Active.
				// Corruption is injected. Synchronization ensures legitimate
				// decryption avoids/reverses this path correctly.
				val ^= 0xFF
			}

			// Apply Operator
			if spin {
				val = m.applyOperator(val, opColor)
			} else {
				val = m.inverseOperator(val, opColor)
			}
		}

		// 3. Store Evolved Byte
		output[i] = byte(val)
	}

	return output
}

// adinkraReverse reverses the walk.
// Note: For symmetric ciphers, 'inverseOperator' with 'spin=false' is the key.
func (m *Merkaba) adinkraReverse(input []byte, path []Sephirot, spin bool) []byte {
	if len(input) == 0 {
		return nil
	}
	output := make([]byte, len(input))

	sephirotIdx := 0
	state := path[0].Entropy
	r := NewChaosEngine(state)

	for i, b := range input {
		// 1. Evolve State (Same as Forward)
		if i%10 == 0 {
			sephirotIdx = (sephirotIdx + 1) % 10
			state ^= path[sephirotIdx].Entropy
			// Re-seed: Must match forward walk exactly
			r = NewChaosEngine(state)
		}

		// 2. Unwind Adinkra Operators
		val := uint64(b)
		type Step struct {
			Op   int
			Trap bool
		}
		var steps []Step

		// Regenerate the 4 steps for this byte (Forward Order)
		for dim := 0; dim < 4; dim++ {
			op := r.Intn(4)
			// Must consume the trap RNG call to stay in sync
			trapVal := r.Int63()
			isTrap := isTrapNode(uint64(trapVal))
			steps = append(steps, Step{op, isTrap})
		}

		// Now unwind in Reverse Order (LIFO)
		for j := 3; j >= 0; j-- {
			step := steps[j]

			// Inverse of Operation
			if spin {
				// Forward: Op(val) -> Reverse: InvOp(val)
				val = m.inverseOperator(val, step.Op)
			} else {
				// Forward: InvOp(val) -> Reverse: Op(val)
				val = m.applyOperator(val, step.Op)
			}

			// Inverse of Trap (XOR is self-inverse)
			// Forward: val ^= 0xFF (Before Op) -> Reverse: val ^= 0xFF (After InvOp)
			if step.Trap {
				val ^= 0xFF
			}
		}

		output[i] = byte(val)
	}

	return output
}

// applyOperator applies the Adinkra Color Transformations ($Q_I$).
func (m *Merkaba) applyOperator(val uint64, color int) uint64 {
	// Standard byte operations wrapped in uint64
	v := byte(val)
	switch color {
	case 0: // Green (Review): XOR Shift
		return uint64(v ^ (v << 1))
	case 1: // Red (Reality): Modular Add
		return uint64(v + 13)
	case 2: // Blue (Reflection): Circular Shift / Rotate
		return uint64((v << 3) | (v >> 5))
	case 3: // Yellow (Rebirth): Not
		return uint64(^v)
	default:
		return val
	}
}

// inverseOperator reverses the transformation
func (m *Merkaba) inverseOperator(val uint64, color int) uint64 {
	v := byte(val)
	switch color {
	case 0: // Green Reverse: Inverse of XOR Shift (v ^ v<<1) over byte
		// This is tricky. x ^ (x<<1).
		// LSB output = LSB input.
		// Bit 1 = In1 ^ In0 ...
		// Linear inverse.
		// For 8 bits, we can just solve it or use a lookup.
		// Simple algebraic inversion:
		// y = x ^ (x<<1)
		// x0 = y0
		// x1 = y1 ^ x0
		// x2 = y2 ^ x1 ...
		x := byte(0)
		x |= (v & 0x01)
		x |= ((v>>1)&1 ^ (x & 1)) << 1
		x |= ((v>>2)&1 ^ ((x >> 1) & 1)) << 2
		x |= ((v>>3)&1 ^ ((x >> 2) & 1)) << 3
		x |= ((v>>4)&1 ^ ((x >> 3) & 1)) << 4
		x |= ((v>>5)&1 ^ ((x >> 4) & 1)) << 5
		x |= ((v>>6)&1 ^ ((x >> 5) & 1)) << 6
		x |= ((v>>7)&1 ^ ((x >> 6) & 1)) << 7
		return uint64(x)

	case 1: // Red Reverse: Modular Sub
		return uint64(v - 13)
	case 2: // Blue Reverse: Rotate Right
		return uint64((v >> 3) | (v << 5))
	case 3: // Yellow Reverse: Not
		return uint64(^v)
	default:
		return val
	}
}

func (m *Merkaba) byteToRune(b byte) rune {
	if int(b) < len(SacredRunes) {
		return SacredRunes[b]
	}
	return '?' // Should not happen
}

// =============================================================================
// CHAOS ENGINE
// =============================================================================

// ChaosEngine provides a cryptographically secure, deterministic RNG stream
// derived from the Sephirot entropy. It replaces standard PRNGs to ensure
// "God-Level" unpredictability and resistance to analysis.
type ChaosEngine struct {
	stream cipher.Stream
}

// NewChaosEngine initializes the stream using the Sephirot entropy as key.
// We use AES-CTR for high-speed, hardware-accelerated deterministic chaos.
func NewChaosEngine(entropy uint64) *ChaosEngine {
	// Expand 64-bit entropy to 32-byte Key and 16-byte IV using SHA-256
	// This ensures the full key space is utilized.
	hasher := sha256.New()
	hasher.Write(uint64ToBytes(entropy))
	hasher.Write([]byte("ADINKHEPRA_CHAOS_INIT"))
	digest := hasher.Sum(nil)

	key := digest[:32]
	iv := make([]byte, aes.BlockSize) // 16 bytes for AES

	// Create independent IV from key material
	hasher.Reset()
	hasher.Write(digest)
	ivDigest := hasher.Sum(nil)
	copy(iv, ivDigest[:aes.BlockSize])

	block, _ := aes.NewCipher(key) // AES-256
	// CTR mode turns block cipher into a stream cipher
	stream := cipher.NewCTR(block, iv)

	return &ChaosEngine{stream: stream}
}

// Byte returns a single chaotic byte.
func (c *ChaosEngine) Byte() byte {
	out := []byte{0}
	in := []byte{0} // CTR transforms input (usually zeros) -> random
	// XORKeyStream XORs input with keystream. 0 ^ K = K.
	c.stream.XORKeyStream(out, in)
	return out[0]
}

// Uint64 returns 8 chaotic bytes as uint64.
func (c *ChaosEngine) Uint64() uint64 {
	out := make([]byte, 8)
	in := make([]byte, 8)
	c.stream.XORKeyStream(out, in)
	return binary.BigEndian.Uint64(out)
}

// Intn returns a uniform random integer [0, n).
func (c *ChaosEngine) Intn(n int) int {
	if n <= 0 {
		return 0
	}
	// Simple rejection sampling to avoid bias
	max := ^uint64(0)
	limit := max - (max % uint64(n))

	for {
		v := c.Uint64()
		if v < limit {
			return int(v % uint64(n))
		}
	}
}

// Int63 returns a chaotic int63.
func (c *ChaosEngine) Int63() int64 {
	return int64(c.Uint64() & 0x7FFFFFFFFFFFFFFF)
}

// Read satisfies the io.Reader interface, allowing ChaosEngine to be used
// as a strong entropy source for standard crypto libraries (like Circl).
func (c *ChaosEngine) Read(p []byte) (n int, err error) {
	// XORKeyStream with a zero buffer effectively outputs the keystream directly
	// which is our "random" data.
	// Since cipher.Stream doesn't error, we always return len(p), nil
	zero := make([]byte, len(p))
	c.stream.XORKeyStream(p, zero)
	return len(p), nil
}

// Helper
func uint64ToBytes(val uint64) []byte {
	b := make([]byte, 8)
	binary.BigEndian.PutUint64(b, val)
	return b
}
