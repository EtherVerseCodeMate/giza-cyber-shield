package enumerate

import (
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/audit"
)

// CollectSystemIntelligence gathers comprehensive system information
// including processes, services, kernel modules, users, and startup items
func CollectSystemIntelligence() (audit.SystemIntelligence, error) {
	si := audit.SystemIntelligence{
		Processes:         []audit.ProcessInfo{},
		Services:          []audit.ServiceInfo{},
		KernelModules:     []audit.KernelModule{},
		InstalledSoftware: []audit.Software{},
		Users:             []audit.UserInfo{},
		CronJobs:          []audit.CronJob{},
		StartupItems:      []audit.StartupItem{},
	}

	// Collect running processes
	processes, err := collectProcesses()
	if err != nil {
		fmt.Printf("[WARN] Failed to collect processes: %v\n", err)
	} else {
		si.Processes = processes
	}

	// Collect system services
	services, err := collectServices()
	if err != nil {
		fmt.Printf("[WARN] Failed to collect services: %v\n", err)
	} else {
		si.Services = services
	}

	// Collect kernel modules (Linux only)
	if runtime.GOOS == "linux" {
		modules, err := collectKernelModules()
		if err != nil {
			fmt.Printf("[WARN] Failed to collect kernel modules: %v\n", err)
		} else {
			si.KernelModules = modules
		}
	}

	// Collect installed software
	software, err := collectInstalledSoftware()
	if err != nil {
		fmt.Printf("[WARN] Failed to collect installed software: %v\n", err)
	} else {
		si.InstalledSoftware = software
	}

	// Collect user accounts
	users, err := collectUsers()
	if err != nil {
		fmt.Printf("[WARN] Failed to collect users: %v\n", err)
	} else {
		si.Users = users
	}

	// Collect cron jobs
	cronJobs, err := collectCronJobs()
	if err != nil {
		fmt.Printf("[WARN] Failed to collect cron jobs: %v\n", err)
	} else {
		si.CronJobs = cronJobs
	}

	// Collect startup items
	startupItems, err := collectStartupItems()
	if err != nil {
		fmt.Printf("[WARN] Failed to collect startup items: %v\n", err)
	} else {
		si.StartupItems = startupItems
	}

	return si, nil
}

// collectProcesses collects information about running processes
func collectProcesses() ([]audit.ProcessInfo, error) {
	switch runtime.GOOS {
	case "linux":
		return collectProcessesLinux()
	case "windows":
		return collectProcessesWindows()
	case "darwin":
		return collectProcessesDarwin()
	default:
		return nil, fmt.Errorf("unsupported OS: %s", runtime.GOOS)
	}
}

func collectProcessesLinux() ([]audit.ProcessInfo, error) {
	var processes []audit.ProcessInfo

	procs, err := os.ReadDir("/proc")
	if err != nil {
		return nil, err
	}

	for _, proc := range procs {
		if !proc.IsDir() {
			continue
		}

		pid, err := strconv.Atoi(proc.Name())
		if err != nil {
			continue
		}

		procInfo, err := getLinuxProcessInfo(pid)
		if err != nil {
			continue
		}

		processes = append(processes, procInfo)
	}

	return processes, nil
}

func getLinuxProcessInfo(pid int) (audit.ProcessInfo, error) {
	procInfo := audit.ProcessInfo{
		PID: pid,
	}

	// Read /proc/PID/stat for basic info
	statPath := fmt.Sprintf("/proc/%d/stat", pid)
	statData, err := os.ReadFile(statPath)
	if err != nil {
		return procInfo, err
	}

	// Parse stat file
	statStr := string(statData)
	// Extract process name (between parentheses)
	start := strings.IndexByte(statStr, '(')
	end := strings.LastIndexByte(statStr, ')')
	if start >= 0 && end > start {
		procInfo.Name = statStr[start+1 : end]
	}

	// Parse PPID (field after process name)
	fields := strings.Fields(statStr[end+1:])
	if len(fields) >= 2 {
		ppid, _ := strconv.Atoi(fields[1])
		procInfo.PPID = ppid
	}

	// Read /proc/PID/cmdline for command line
	cmdlinePath := fmt.Sprintf("/proc/%d/cmdline", pid)
	cmdlineData, err := os.ReadFile(cmdlinePath)
	if err == nil {
		cmdline := string(cmdlineData)
		cmdline = strings.ReplaceAll(cmdline, "\x00", " ")
		procInfo.CmdLine = strings.TrimSpace(cmdline)
	}

	// Read /proc/PID/status for UID and other details
	statusPath := fmt.Sprintf("/proc/%d/status", pid)
	statusData, err := os.ReadFile(statusPath)
	if err == nil {
		lines := strings.Split(string(statusData), "\n")
		for _, line := range lines {
			if strings.HasPrefix(line, "Uid:") {
				fields := strings.Fields(line)
				if len(fields) >= 2 {
					uid, _ := strconv.Atoi(fields[1])
					u, err := user.LookupId(fmt.Sprintf("%d", uid))
					if err == nil {
						procInfo.User = u.Username
					}
				}
			} else if strings.HasPrefix(line, "VmRSS:") {
				fields := strings.Fields(line)
				if len(fields) >= 2 {
					kb, _ := strconv.ParseFloat(fields[1], 64)
					procInfo.MemoryMB = kb / 1024
				}
			}
		}
	}

	// Get executable path
	exePath := fmt.Sprintf("/proc/%d/exe", pid)
	exeTarget, err := os.Readlink(exePath)
	if err == nil {
		procInfo.ExecutablePath = exeTarget

		// Calculate file hash
		if fileData, err := os.ReadFile(exeTarget); err == nil {
			hash := sha256.Sum256(fileData)
			procInfo.FileHash = hex.EncodeToString(hash[:])
		}
	}

	return procInfo, nil
}

func collectProcessesWindows() ([]audit.ProcessInfo, error) {
	cmd := exec.Command("powershell", "-Command",
		"Get-Process | Select-Object Id,ProcessName,Path,StartTime | ConvertTo-Csv -NoTypeInformation")
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var processes []audit.ProcessInfo
	lines := strings.Split(string(output), "\n")

	for i, line := range lines {
		if i == 0 || line == "" {
			continue
		}

		fields := strings.Split(line, ",")
		if len(fields) < 3 {
			continue
		}

		pid, _ := strconv.Atoi(strings.Trim(fields[0], "\""))
		name := strings.Trim(fields[1], "\"")
		path := strings.Trim(fields[2], "\"")

		procInfo := audit.ProcessInfo{
			PID:            pid,
			Name:           name,
			ExecutablePath: path,
		}

		processes = append(processes, procInfo)
	}

	return processes, nil
}

func collectProcessesDarwin() ([]audit.ProcessInfo, error) {
	cmd := exec.Command("ps", "-eo", "pid,ppid,comm,args,user")
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var processes []audit.ProcessInfo
	lines := strings.Split(string(output), "\n")

	for i, line := range lines {
		if i == 0 || line == "" {
			continue
		}

		fields := strings.Fields(line)
		if len(fields) < 4 {
			continue
		}

		pid, _ := strconv.Atoi(fields[0])
		ppid, _ := strconv.Atoi(fields[1])
		name := fields[2]
		user := fields[len(fields)-1]
		cmdline := strings.Join(fields[3:len(fields)-1], " ")

		procInfo := audit.ProcessInfo{
			PID:     pid,
			PPID:    ppid,
			Name:    name,
			CmdLine: cmdline,
			User:    user,
		}

		processes = append(processes, procInfo)
	}

	return processes, nil
}

// collectServices collects information about system services
func collectServices() ([]audit.ServiceInfo, error) {
	switch runtime.GOOS {
	case "linux":
		return collectServicesLinux()
	case "windows":
		return collectServicesWindows()
	case "darwin":
		return collectServicesDarwin()
	default:
		return nil, fmt.Errorf("unsupported OS: %s", runtime.GOOS)
	}
}

func collectServicesLinux() ([]audit.ServiceInfo, error) {
	var services []audit.ServiceInfo

	// Use systemctl to list services
	cmd := exec.Command("systemctl", "list-units", "--type=service", "--all", "--no-pager")
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) < 3 {
			continue
		}

		if !strings.HasSuffix(fields[0], ".service") {
			continue
		}

		name := strings.TrimSuffix(fields[0], ".service")
		state := fields[2]

		service := audit.ServiceInfo{
			Name:  name,
			State: state,
		}

		services = append(services, service)
	}

	return services, nil
}

func collectServicesWindows() ([]audit.ServiceInfo, error) {
	cmd := exec.Command("powershell", "-Command",
		"Get-Service | Select-Object Name,DisplayName,Status,StartType | ConvertTo-Csv -NoTypeInformation")
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var services []audit.ServiceInfo
	lines := strings.Split(string(output), "\n")

	for i, line := range lines {
		if i == 0 || line == "" {
			continue
		}

		fields := strings.Split(line, ",")
		if len(fields) < 4 {
			continue
		}

		name := strings.Trim(fields[0], "\"")
		displayName := strings.Trim(fields[1], "\"")
		state := strings.Trim(fields[2], "\"")
		startMode := strings.Trim(fields[3], "\"")

		service := audit.ServiceInfo{
			Name:        name,
			DisplayName: displayName,
			State:       state,
			StartMode:   startMode,
		}

		services = append(services, service)
	}

	return services, nil
}

func collectServicesDarwin() ([]audit.ServiceInfo, error) {
	cmd := exec.Command("launchctl", "list")
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var services []audit.ServiceInfo
	lines := strings.Split(string(output), "\n")

	for i, line := range lines {
		if i == 0 || line == "" {
			continue
		}

		fields := strings.Fields(line)
		if len(fields) < 3 {
			continue
		}

		name := fields[2]
		state := "unknown"
		if fields[0] != "-" {
			state = "running"
		}

		service := audit.ServiceInfo{
			Name:  name,
			State: state,
		}

		services = append(services, service)
	}

	return services, nil
}

// collectKernelModules collects loaded kernel modules (Linux only)
func collectKernelModules() ([]audit.KernelModule, error) {
	var modules []audit.KernelModule

	file, err := os.Open("/proc/modules")
	if err != nil {
		return nil, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		fields := strings.Fields(line)
		if len(fields) < 3 {
			continue
		}

		name := fields[0]
		size, _ := strconv.Atoi(fields[1])

		// Parse "used by" list
		var usedBy []string
		if len(fields) >= 4 && fields[3] != "-" {
			usedBy = strings.Split(strings.Trim(fields[3], ","), ",")
		}

		module := audit.KernelModule{
			Name:   name,
			Size:   size,
			UsedBy: usedBy,
			Hidden: false, // Will be detected by rootkit scanner
		}

		modules = append(modules, module)
	}

	// Detect hidden modules by comparing /proc/modules with /sys/module
	sysModules, err := os.ReadDir("/sys/module")
	if err == nil {
		procModuleNames := make(map[string]bool)
		for _, m := range modules {
			procModuleNames[m.Name] = true
		}

		for _, sysModule := range sysModules {
			if !procModuleNames[sysModule.Name()] {
				// Hidden module detected!
				modules = append(modules, audit.KernelModule{
					Name:   sysModule.Name(),
					Hidden: true,
				})
			}
		}
	}

	return modules, scanner.Err()
}

// collectInstalledSoftware collects list of installed software
func collectInstalledSoftware() ([]audit.Software, error) {
	switch runtime.GOOS {
	case "linux":
		return collectInstalledSoftwareLinux()
	case "windows":
		return collectInstalledSoftwareWindows()
	case "darwin":
		return collectInstalledSoftwareDarwin()
	default:
		return nil, fmt.Errorf("unsupported OS: %s", runtime.GOOS)
	}
}

func collectInstalledSoftwareLinux() ([]audit.Software, error) {
	var software []audit.Software

	// Try dpkg for Debian-based systems
	cmd := exec.Command("dpkg", "-l")
	output, err := cmd.Output()
	if err == nil {
		lines := strings.Split(string(output), "\n")
		for _, line := range lines {
			if !strings.HasPrefix(line, "ii") {
				continue
			}

			fields := strings.Fields(line)
			if len(fields) >= 3 {
				software = append(software, audit.Software{
					Name:    fields[1],
					Version: fields[2],
				})
			}
		}
		return software, nil
	}

	// Try rpm for Red Hat-based systems
	cmd = exec.Command("rpm", "-qa", "--queryformat", "%{NAME} %{VERSION}\n")
	output, err = cmd.Output()
	if err == nil {
		lines := strings.Split(string(output), "\n")
		for _, line := range lines {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				software = append(software, audit.Software{
					Name:    fields[0],
					Version: fields[1],
				})
			}
		}
		return software, nil
	}

	return software, nil
}

func collectInstalledSoftwareWindows() ([]audit.Software, error) {
	cmd := exec.Command("powershell", "-Command",
		"Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | Select-Object DisplayName,DisplayVersion,Publisher | ConvertTo-Csv -NoTypeInformation")
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var software []audit.Software
	lines := strings.Split(string(output), "\n")

	for i, line := range lines {
		if i == 0 || line == "" {
			continue
		}

		fields := strings.Split(line, ",")
		if len(fields) >= 3 {
			name := strings.Trim(fields[0], "\"")
			version := strings.Trim(fields[1], "\"")
			publisher := strings.Trim(fields[2], "\"")

			if name != "" {
				software = append(software, audit.Software{
					Name:      name,
					Version:   version,
					Publisher: publisher,
				})
			}
		}
	}

	return software, nil
}

func collectInstalledSoftwareDarwin() ([]audit.Software, error) {
	cmd := exec.Command("system_profiler", "SPApplicationsDataType", "-xml")
	if _, err := cmd.Output(); err != nil {
		return nil, err
	}

	// Simple XML parsing would be needed here
	// For now, return limited info from /Applications
	var software []audit.Software

	apps, err := os.ReadDir("/Applications")
	if err != nil {
		return nil, err
	}

	for _, app := range apps {
		if strings.HasSuffix(app.Name(), ".app") {
			software = append(software, audit.Software{
				Name: strings.TrimSuffix(app.Name(), ".app"),
			})
		}
	}

	return software, nil
}

// collectUsers collects system user accounts
func collectUsers() ([]audit.UserInfo, error) {
	switch runtime.GOOS {
	case "linux", "darwin":
		return collectUsersUnix()
	case "windows":
		return collectUsersWindows()
	default:
		return nil, fmt.Errorf("unsupported OS: %s", runtime.GOOS)
	}
}

func collectUsersUnix() ([]audit.UserInfo, error) {
	file, err := os.Open("/etc/passwd")
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var users []audit.UserInfo
	scanner := bufio.NewScanner(file)

	for scanner.Scan() {
		line := scanner.Text()
		fields := strings.Split(line, ":")
		if len(fields) < 7 {
			continue
		}

		username := fields[0]
		uid, _ := strconv.Atoi(fields[2])
		gid, _ := strconv.Atoi(fields[3])
		homeDir := fields[5]
		shell := fields[6]

		// Determine if user is privileged
		privileged := (uid == 0)

		// Get groups
		groups := []string{}
		groupsCmd := exec.Command("id", "-Gn", username)
		if groupsOutput, err := groupsCmd.Output(); err == nil {
			groups = strings.Fields(string(groupsOutput))
		}

		userInfo := audit.UserInfo{
			Username:   username,
			UID:        uid,
			GID:        gid,
			Groups:     groups,
			HomeDir:    homeDir,
			Shell:      shell,
			Privileged: privileged,
		}

		users = append(users, userInfo)
	}

	return users, scanner.Err()
}

func collectUsersWindows() ([]audit.UserInfo, error) {
	cmd := exec.Command("net", "user")
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var users []audit.UserInfo
	lines := strings.Split(string(output), "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		usernames := strings.Fields(line)
		for _, username := range usernames {
			if username == "" || username == "User" || username == "accounts" {
				continue
			}

			userInfo := audit.UserInfo{
				Username: username,
			}

			users = append(users, userInfo)
		}
	}

	return users, nil
}

// collectCronJobs collects scheduled tasks
func collectCronJobs() ([]audit.CronJob, error) {
	switch runtime.GOOS {
	case "linux":
		return collectCronJobsLinux()
	case "darwin":
		return collectCronJobsDarwin()
	case "windows":
		return collectCronJobsWindows()
	default:
		return nil, fmt.Errorf("unsupported OS: %s", runtime.GOOS)
	}
}

func collectCronJobsLinux() ([]audit.CronJob, error) {
	var cronJobs []audit.CronJob

	// System crontab
	if data, err := os.ReadFile("/etc/crontab"); err == nil {
		jobs := parseCrontab(string(data), "root")
		cronJobs = append(cronJobs, jobs...)
	}

	// System cron.d directory
	cronDFiles, err := os.ReadDir("/etc/cron.d")
	if err == nil {
		for _, file := range cronDFiles {
			if file.IsDir() {
				continue
			}
			data, err := os.ReadFile(filepath.Join("/etc/cron.d", file.Name()))
			if err == nil {
				jobs := parseCrontab(string(data), "root")
				cronJobs = append(cronJobs, jobs...)
			}
		}
	}

	// User crontabs
	users, _ := collectUsersUnix()
	for _, u := range users {
		cmd := exec.Command("crontab", "-u", u.Username, "-l")
		output, err := cmd.Output()
		if err == nil {
			jobs := parseCrontab(string(output), u.Username)
			cronJobs = append(cronJobs, jobs...)
		}
	}

	return cronJobs, nil
}

func parseCrontab(content, user string) []audit.CronJob {
	var jobs []audit.CronJob
	lines := strings.Split(content, "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		fields := strings.Fields(line)
		if len(fields) < 6 {
			continue
		}

		schedule := strings.Join(fields[0:5], " ")
		command := strings.Join(fields[5:], " ")

		job := audit.CronJob{
			User:     user,
			Schedule: schedule,
			Command:  command,
		}

		jobs = append(jobs, job)
	}

	return jobs
}

func collectCronJobsDarwin() ([]audit.CronJob, error) {
	return collectCronJobsLinux() // macOS uses similar cron system
}

func collectCronJobsWindows() ([]audit.CronJob, error) {
	cmd := exec.Command("schtasks", "/query", "/fo", "LIST", "/v")
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var cronJobs []audit.CronJob
	lines := strings.Split(string(output), "\n")

	var currentTask audit.CronJob
	for _, line := range lines {
		line = strings.TrimSpace(line)

		if strings.HasPrefix(line, "TaskName:") {
			if currentTask.Command != "" {
				cronJobs = append(cronJobs, currentTask)
			}
			currentTask = audit.CronJob{}
		} else if strings.HasPrefix(line, "Run As User:") {
			currentTask.User = strings.TrimSpace(strings.TrimPrefix(line, "Run As User:"))
		} else if strings.HasPrefix(line, "Task To Run:") {
			currentTask.Command = strings.TrimSpace(strings.TrimPrefix(line, "Task To Run:"))
		} else if strings.HasPrefix(line, "Schedule:") {
			currentTask.Schedule = strings.TrimSpace(strings.TrimPrefix(line, "Schedule:"))
		}
	}

	if currentTask.Command != "" {
		cronJobs = append(cronJobs, currentTask)
	}

	return cronJobs, nil
}

// collectStartupItems collects autostart mechanisms
func collectStartupItems() ([]audit.StartupItem, error) {
	switch runtime.GOOS {
	case "linux":
		return collectStartupItemsLinux()
	case "windows":
		return collectStartupItemsWindows()
	case "darwin":
		return collectStartupItemsDarwin()
	default:
		return nil, fmt.Errorf("unsupported OS: %s", runtime.GOOS)
	}
}

func collectStartupItemsLinux() ([]audit.StartupItem, error) {
	var items []audit.StartupItem

	// Systemd services
	cmd := exec.Command("systemctl", "list-unit-files", "--type=service", "--state=enabled", "--no-pager")
	output, err := cmd.Output()
	if err == nil {
		lines := strings.Split(string(output), "\n")
		for _, line := range lines {
			fields := strings.Fields(line)
			if len(fields) >= 2 && fields[1] == "enabled" {
				items = append(items, audit.StartupItem{
					Name: fields[0],
					Type: "systemd",
				})
			}
		}
	}

	// /etc/rc.local
	if _, err := os.Stat("/etc/rc.local"); err == nil {
		items = append(items, audit.StartupItem{
			Name: "rc.local",
			Path: "/etc/rc.local",
			Type: "rc.local",
		})
	}

	return items, nil
}

func collectStartupItemsWindows() ([]audit.StartupItem, error) {
	var items []audit.StartupItem

	// Registry Run keys
	runKeys := []string{
		"HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
		"HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce",
		"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
		"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce",
	}

	for _, key := range runKeys {
		cmd := exec.Command("reg", "query", key)
		output, err := cmd.Output()
		if err != nil {
			continue
		}

		lines := strings.Split(string(output), "\n")
		for _, line := range lines {
			fields := strings.Fields(line)
			if len(fields) >= 3 {
				items = append(items, audit.StartupItem{
					Name: fields[0],
					Path: strings.Join(fields[2:], " "),
					Type: "registry",
				})
			}
		}
	}

	return items, nil
}

func collectStartupItemsDarwin() ([]audit.StartupItem, error) {
	var items []audit.StartupItem

	// LaunchAgents and LaunchDaemons
	launchPaths := []string{
		"/Library/LaunchAgents",
		"/Library/LaunchDaemons",
		"/System/Library/LaunchAgents",
		"/System/Library/LaunchDaemons",
	}

	for _, dir := range launchPaths {
		files, err := os.ReadDir(dir)
		if err != nil {
			continue
		}

		for _, file := range files {
			if strings.HasSuffix(file.Name(), ".plist") {
				items = append(items, audit.StartupItem{
					Name: strings.TrimSuffix(file.Name(), ".plist"),
					Path: filepath.Join(dir, file.Name()),
					Type: "launchd",
				})
			}
		}
	}

	return items, nil
}

// CollectHostInfo collects detailed host system information
func CollectHostInfo() (audit.InfoHost, error) {
	info := audit.InfoHost{
		OS:   runtime.GOOS,
		Arch: runtime.GOARCH,
	}

	// Get hostname
	hostname, err := os.Hostname()
	if err == nil {
		info.Hostname = hostname
	}

	// Get OS version and family
	osVersion, osFamily := getOSVersion()
	info.OSVersion = osVersion
	info.OSFamily = osFamily

	// Get kernel version
	info.Kernel = getKernelVersion()

	// Get private IPs
	info.PrivateIPs = getPrivateIPs()

	// Get uptime and boot time
	uptime, bootTime := getUptimeInfo()
	info.Uptime = uptime
	info.BootTime = bootTime

	return info, nil
}

func getOSVersion() (string, string) {
	switch runtime.GOOS {
	case "linux":
		if data, err := os.ReadFile("/etc/os-release"); err == nil {
			var version, family string
			lines := strings.Split(string(data), "\n")
			for _, line := range lines {
				if strings.HasPrefix(line, "VERSION=") {
					version = strings.Trim(strings.TrimPrefix(line, "VERSION="), "\"")
				} else if strings.HasPrefix(line, "ID=") {
					family = strings.Trim(strings.TrimPrefix(line, "ID="), "\"")
				}
			}
			return version, family
		}
		return "unknown", "linux"

	case "windows":
		cmd := exec.Command("cmd", "/c", "ver")
		output, _ := cmd.Output()
		return strings.TrimSpace(string(output)), "windows"

	case "darwin":
		cmd := exec.Command("sw_vers", "-productVersion")
		output, _ := cmd.Output()
		return strings.TrimSpace(string(output)), "darwin"

	default:
		return "unknown", runtime.GOOS
	}
}

func getKernelVersion() string {
	switch runtime.GOOS {
	case "linux", "darwin":
		cmd := exec.Command("uname", "-r")
		output, err := cmd.Output()
		if err == nil {
			return strings.TrimSpace(string(output))
		}
	case "windows":
		cmd := exec.Command("cmd", "/c", "ver")
		output, err := cmd.Output()
		if err == nil {
			return strings.TrimSpace(string(output))
		}
	}
	return "unknown"
}

func getPrivateIPs() []string {
	var ips []string
	interfaces, err := net.Interfaces()
	if err != nil {
		return ips
	}

	for _, iface := range interfaces {
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}

		for _, addr := range addrs {
			ipNet, ok := addr.(*net.IPNet)
			if !ok {
				continue
			}

			if ipNet.IP.IsLoopback() {
				continue
			}

			ips = append(ips, ipNet.IP.String())
		}
	}

	return ips
}

func getUptimeInfo() (int64, time.Time) {
	switch runtime.GOOS {
	case "linux":
		data, err := os.ReadFile("/proc/uptime")
		if err == nil {
			fields := strings.Fields(string(data))
			if len(fields) > 0 {
				uptime, _ := strconv.ParseFloat(fields[0], 64)
				bootTime := time.Now().Add(-time.Duration(uptime) * time.Second)
				return int64(uptime), bootTime
			}
		}

	case "windows":
		// Windows uptime collection not implemented here; return zero values.
		// Implement with Windows-specific APIs if precise uptime is required.
		return 0, time.Time{}

	case "darwin":
		cmd := exec.Command("sysctl", "-n", "kern.boottime")
		output, err := cmd.Output()
		if err == nil {
			// Parse output like: { sec = 1234567890, usec = 0 }
			line := string(output)
			if strings.Contains(line, "sec =") {
				parts := strings.Split(line, "sec = ")
				if len(parts) > 1 {
					secStr := strings.TrimSpace(strings.Split(parts[1], ",")[0])
					sec, _ := strconv.ParseInt(secStr, 10, 64)
					bootTime := time.Unix(sec, 0)
					uptime := time.Since(bootTime).Seconds()
					return int64(uptime), bootTime
				}
			}
		}
	}

	return 0, time.Time{}
}
