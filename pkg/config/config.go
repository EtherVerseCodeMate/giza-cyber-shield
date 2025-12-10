package config

import (
	"os"
	"strconv"
)

type Config struct {
	ExternalIP      string
	SSHExternalPort int
	AgentListenPort int
	Username        string
	Tenant          string
	Comment         string
	RotateDays      int
	RepoSSH         string
	RepoName        string
	GitEmail        string
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
func getenvInt(k string, def int) int {
	if v := os.Getenv(k); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func Load() Config {
	return Config{
		ExternalIP:      getenv("KHEPRA_EXTERNAL_IP", "127.0.0.1"),
		SSHExternalPort: getenvInt("KHEPRA_SSH_PORT", 22),
		AgentListenPort: getenvInt("KHEPRA_AGENT_PORT", 45444),
		Username:        getenv("KHEPRA_USER", "khepra"),
		Tenant:          getenv("KHEPRA_TENANT", "khepra://edge-node-1"),
		Comment:         getenv("KHEPRA_COMMENT", "skone@alumni.albany.edu eban:prod nkyinkyim:v1"),
		RotateDays:      getenvInt("KHEPRA_ROTATE_DAYS", 90),
		RepoSSH:         getenv("KHEPRA_REPO_SSH", "git@github.com:EtherVerseCodeMate/giza-cyber-shield.git"),
		RepoName:        getenv("KHEPRA_REPO_NAME", "EtherVerseCodeMate/giza-cyber-shield"),
		GitEmail:        getenv("KHEPRA_GIT_EMAIL", "skone@alumni.albany.edu"),
	}
}
