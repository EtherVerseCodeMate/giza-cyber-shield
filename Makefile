APP?=khepra
AGENT?=khepra-agent

all: build

build:
	go mod tidy
	go build -o bin/$(APP) ./cmd/khepra
	go build -o bin/$(AGENT) ./cmd/agent

run-agent: build
	KHEPRA_AGENT_PORT=45444 ./bin/$(AGENT)


secure-build:
	CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -mod=vendor -o bin/$(APP).exe ./cmd/khepra
	CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -mod=vendor -o bin/$(AGENT).exe ./cmd/agent

# Go 1.24+ Native FIPS 140-3 Compliance
# Usage: Set GODEBUG=fips140=on at runtime
fips-build: secure-build
	@echo "[KHEPRA] FIPS-Ready Binaries Built."
	@echo "[KHEPRA] To run in FIPS mode: $$env:GODEBUG='fips140=on' ./bin/$(AGENT).exe"

clean:
	rm -rf bin
