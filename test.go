package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"regexp"
)

var secretFieldPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)"(password|passwd|secret|api[_-]?key|private[_-]?key|token|bearer|credential|auth|priv_key|privkey|kyber_priv|dsa_priv)"\s*:\s*"[^"]*"`),
	regexp.MustCompile(`(?i)"(seed|mnemonic|entropy|iv|salt|hmac|signature|x509|cert|pem)"\s*:\s*"[^"]*"`),
}

const redactedValue = `"[REDACTED]"`

func scrubSecrets(body []byte) []byte {
	out := body
	for _, pat := range secretFieldPatterns {
		out = pat.ReplaceAllFunc(out, func(match []byte) []byte {
			fmt.Printf("Matched: '%s'\n", match)
			colonIdx := bytes.Index(match, []byte(`": "`))
			if colonIdx < 0 {
				colonIdx = bytes.IndexByte(match, ':')
				if colonIdx < 0 {
					return match
				}
				var res []byte
				res = append(res, match[:colonIdx+1]...)
				res = append(res, []byte(` `+redactedValue)...)
				return res
			}
			var res []byte
			res = append(res, match[:colonIdx+2]...)
			res = append(res, []byte(redactedValue)...)
			return res
		})
	}
	return out
}

func main() {
	body := []byte(`[{"id":"node-1","signature":"","verified":false,"action":"GENESIS_CONSTELLATION"}]`)
	scrubbed := scrubSecrets(body)
	fmt.Printf("Original: %s\n", body)
	fmt.Printf("Scrubbed: %s\n", scrubbed)
	fmt.Printf("Valid JSON: %v\n", json.Valid(scrubbed))
}
