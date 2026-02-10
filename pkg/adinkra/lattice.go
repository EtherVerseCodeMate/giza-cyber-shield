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

var SacredRunes = []rune{
	'𓆣', '𓋹', '𓁹', '𓇳', '𐤀', '𐤁', '𐤂', '𐤃', 'א', 'ب', 'ג', 'ד', 'ا', 'ب', 'ج', 'د',
}

var SacredReverseMap map[rune]int

func init() {
	SacredReverseMap = make(map[rune]int)
	for i, r := range SacredRunes {
		SacredReverseMap[r] = i
	}
}

// =============================================================================
// DATA STRUCTURES
// =============================================================================

type Merkaba struct {
	SunStream   []byte
	EarthStream []byte
	Seed        []byte
}

type Sephirot struct {
	Name    string
	Entropy uint64
}

// =============================================================================
// ALGORITHM IMPLEMENTATION
// =============================================================================

func NewMerkaba(seed []byte) *Merkaba {
	return &Merkaba{Seed: seed}
}

func (m *Merkaba) Seal(data []byte) (string, error) {
	if len(m.Seed) < 32 {
		return "", errors.New("seed too weak for sacred geometry")
	}

	path := m.walkTreeOfLife()

	// 1. Split Data
	sun := make([]byte, 0)
	earth := make([]byte, 0)
	for i, b := range data {
		if i%2 == 0 {
			sun = append(sun, b)
		} else {
			earth = append(earth, b)
		}
	}

	// 2. Traverse
	sunEnc := m.adinkraTraverse(sun, path, true)
	earthEnc := m.adinkraTraverse(earth, path, false)

	// 3. Encode to Runes
	var result []rune
	maxLen := len(sunEnc)
	if len(earthEnc) > maxLen {
		maxLen = len(earthEnc)
	}

	for i := 0; i < maxLen; i++ {
		if i < len(sunEnc) {
			b := sunEnc[i]
			result = append(result, SacredRunes[b>>4])
			result = append(result, SacredRunes[b&0x0F])
		}
		if i < len(earthEnc) {
			b := earthEnc[i]
			result = append(result, SacredRunes[b>>4])
			result = append(result, SacredRunes[b&0x0F])
		}
	}

	return string(result), nil
}

func (m *Merkaba) Unseal(sacred string) ([]byte, error) {
	runes := []rune(sacred)
	path := m.walkTreeOfLife()

	// 1. Decode Runes
	var sunEnc, earthEnc []byte
	for i := 0; i < len(runes); i += 4 {
		// Sun block
		if i+1 < len(runes) {
			h, ok1 := SacredReverseMap[runes[i]]
			l, ok2 := SacredReverseMap[runes[i+1]]
			if !ok1 || !ok2 {
				return nil, errors.New("profane symbols in sun block")
			}
			sunEnc = append(sunEnc, byte((h<<4)|l))
		}
		// Earth block
		if i+3 < len(runes) {
			h, ok1 := SacredReverseMap[runes[i+2]]
			l, ok2 := SacredReverseMap[runes[i+3]]
			if !ok1 || !ok2 {
				return nil, errors.New("profane symbols in earth block")
			}
			earthEnc = append(earthEnc, byte((h<<4)|l))
		}
	}

	// 2. Reverse Traverse
	sunDec := m.adinkraReverse(sunEnc, path, true)
	earthDec := m.adinkraReverse(earthEnc, path, false)

	// 3. Reconstruct
	res := make([]byte, 0, len(sunDec)+len(earthDec))
	for i := 0; i < len(sunDec) || i < len(earthDec); i++ {
		if i < len(sunDec) {
			res = append(res, sunDec[i])
		}
		if i < len(earthDec) {
			res = append(res, earthDec[i])
		}
	}

	return res, nil
}

func (m *Merkaba) walkTreeOfLife() []Sephirot {
	var path []Sephirot
	currentHash := sha256.Sum256(m.Seed)
	names := []string{"KETER", "CHOKMAH", "BINAH", "CHESED", "GEBURAH", "TIPHARETH", "NETZACH", "HOD", "YESOD", "MALKUTH"}

	for _, name := range names {
		h := sha256.New()
		h.Write(currentHash[:])
		h.Write([]byte(name))
		currentHash = [32]byte(h.Sum(nil))
		entropy := binary.BigEndian.Uint64(currentHash[:8]) ^ 0xCAFEBABEDEADBEEF

		path = append(path, Sephirot{Name: name, Entropy: entropy})
	}
	return path
}

func (m *Merkaba) adinkraTraverse(input []byte, path []Sephirot, spin bool) []byte {
	if len(input) == 0 {
		return nil
	}
	output := make([]byte, len(input))
	r := NewChaosEngine(path[0].Entropy)

	for i, b := range input {
		if i%10 == 0 && i > 0 {
			r = NewChaosEngine(path[(i/10)%10].Entropy)
		}

		val := uint64(b)
		for dim := 0; dim < 4; dim++ {
			op := r.Intn(4)
			_ = r.Int63() // consume trap RNG
			if spin {
				val = m.applyOperator(val, op)
			} else {
				val = m.inverseOperator(val, op)
			}
		}
		output[i] = byte(val)
	}
	return output
}

func (m *Merkaba) adinkraReverse(input []byte, path []Sephirot, spin bool) []byte {
	if len(input) == 0 {
		return nil
	}
	output := make([]byte, len(input))
	r := NewChaosEngine(path[0].Entropy)

	for i, b := range input {
		if i%10 == 0 && i > 0 {
			r = NewChaosEngine(path[(i/10)%10].Entropy)
		}

		val := uint64(b)
		type step struct {
			op int
		}
		var steps [4]step
		for d := 0; d < 4; d++ {
			steps[d].op = r.Intn(4)
			_ = r.Int63() // consume trap
		}

		for d := 3; d >= 0; d-- {
			if spin {
				val = m.inverseOperator(val, steps[d].op)
			} else {
				val = m.applyOperator(val, steps[d].op)
			}
		}
		output[i] = byte(val)
	}
	return output
}

func (m *Merkaba) applyOperator(val uint64, color int) uint64 {
	v := byte(val)
	switch color {
	case 0:
		return uint64(v ^ (v << 1))
	case 1:
		return uint64(v + 13)
	case 2:
		return uint64((v << 3) | (v >> 5))
	case 3:
		return uint64(^v)
	}
	return val
}

func (m *Merkaba) inverseOperator(val uint64, color int) uint64 {
	v := byte(val)
	switch color {
	case 0:
		x := byte(0)
		for i := 0; i < 8; i++ {
			bit := (v >> i) & 1
			if i > 0 {
				bit ^= (x >> (i - 1)) & 1
			}
			x |= bit << i
		}
		return uint64(x)
	case 1:
		return uint64(v - 13)
	case 2:
		return uint64((v >> 3) | (v << 5))
	case 3:
		return uint64(^v)
	}
	return val
}

// =============================================================================
// CHAOS ENGINE
// =============================================================================

type ChaosEngine struct {
	stream cipher.Stream
}

func NewChaosEngine(entropy uint64) *ChaosEngine {
	h := sha256.New()
	b := make([]byte, 8)
	binary.BigEndian.PutUint64(b, entropy)
	h.Write(b)
	h.Write([]byte("ADINKHEPRA_CHAOS_INIT"))
	digest := h.Sum(nil)

	key := digest[:32]
	iv := digest[16:] // Use part of digest for IV
	if len(iv) > aes.BlockSize {
		iv = iv[:aes.BlockSize]
	}

	block, _ := aes.NewCipher(key)
	return &ChaosEngine{stream: cipher.NewCTR(block, iv)}
}

func (c *ChaosEngine) Uint64() uint64 {
	out := make([]byte, 8)
	c.stream.XORKeyStream(out, out)
	return binary.BigEndian.Uint64(out)
}

func (c *ChaosEngine) Intn(n int) int {
	if n <= 0 {
		return 0
	}
	return int(c.Uint64() % uint64(n))
}

func (c *ChaosEngine) Int63() int64 {
	return int64(c.Uint64() & 0x7FFFFFFFFFFFFFFF)
}

func (c *ChaosEngine) Read(p []byte) (n int, err error) {
	c.stream.XORKeyStream(p, p)
	return len(p), nil
}
