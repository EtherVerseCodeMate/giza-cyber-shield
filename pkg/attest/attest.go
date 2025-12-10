package attest

import "time"

type Semantics struct {
	Boundary       string `json:"boundary"`
	Purpose        string `json:"purpose"`
	LeastPrivilege bool   `json:"least_privilege"`
}

type Lifecycle struct {
	Journey        string    `json:"journey"`
	CreatedAt      time.Time `json:"created_at"`
	RotationAfterND int      `json:"rotation_after_days"`
}

type Binding struct {
	OpenSSHPubSHA256 string `json:"openssh_pub_sha256"`
	Comment          string `json:"comment"`
}

type Assertion struct {
	Schema    string    `json:"schema"`
	Symbol    string    `json:"symbol"`
	Semantics Semantics `json:"semantics"`
	Lifecycle Lifecycle `json:"lifecycle"`
	Binding   Binding   `json:"binding"`
}
