APP?=khepra
AGENT?=khepra-agent

all: build

build:
	go mod tidy
	go build -o bin/$(APP) ./cmd/khepra
	go build -o bin/$(AGENT) ./cmd/agent

run-agent: build
	KHEPRA_AGENT_PORT=45444 ./bin/$(AGENT)

clean:
	rm -rf bin
